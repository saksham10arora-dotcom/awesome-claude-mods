import type { EngineInterface, Register } from 'claude-code'

// frugal: spend Claude on thinking, not on chores.
//  1. Helper subagents (Explore and the like) that don't ask for a model run on
//     the helper model, Haiku by default.
//  2. A summarize_free tool: Claude hands a big file or log to a free Gemini
//     model and gets back only what it needs, instead of reading it whole.
// A one-line band above the prompt counts what was offloaded this session.

const TOOL = 'summarize_free'
const MAX_CHARS = 600_000 // what one Gemini call is sent at most
const MUTED = '#8a8f98'
const GREEN = '#3ecf8e'

type Counts = { helpers: number; summaries: number; chars: number }
const ZERO: Counts = { helpers: 0, summaries: 0, chars: 0 }

const list = (v: unknown, fallback: string) =>
  String(typeof v === 'string' && v.trim() ? v : fallback)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

const asCounts = (v: unknown): Counts => {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Counts>
  return { helpers: Number(o.helpers) || 0, summaries: Number(o.summaries) || 0, chars: Number(o.chars) || 0 }
}

// This session's counts. Module state, like the pet's animation loop: a hot
// reload starts it over.
let session: Counts = { ...ZERO }

async function bump($: EngineInterface, add: Partial<Counts>) {
  session = {
    helpers: session.helpers + (add.helpers ?? 0),
    summaries: session.summaries + (add.summaries ?? 0),
    chars: session.chars + (add.chars ?? 0),
  }
  const life = asCounts(await $.store.get('lifetime'))
  await $.store.set('lifetime', {
    helpers: life.helpers + (add.helpers ?? 0),
    summaries: life.summaries + (add.summaries ?? 0),
    chars: life.chars + (add.chars ?? 0),
  })
  $.ui.invalidate('ui.render')
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const kchars = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

export const register: Register = (on, options) => {
  const helperModel = String(options.helperModel || 'haiku')
  const helperTypes = new Set(list(options.helperTypes, 'Explore,claude-code-guide,statusline-setup'))
  const geminiModels = list(options.geminiModels, 'gemini-flash-lite-latest,gemini-3.5-flash-lite,gemini-flash-latest')
  const configuredKey = typeof options.geminiKey === 'string' ? options.geminiKey.trim() : ''

  let enabled = true

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    enabled = (await $.store.get('enabled')) !== false
    await $.command.register({
      name: 'frugal',
      description: 'Cost-free mode: helper agents on Haiku, big reads on free Gemini (on, off, status)',
      argumentHint: '[on | off | status]',
      immediate: true,
    })
    await $.tool.register({
      name: TOOL,
      description:
        'Summarise, or answer a question about, a LARGE file or text (logs, build or test output, long docs, ' +
        'generated files, anything over about 500 lines) using a free model, so the main context and the ' +
        "user's plan limits are spared. Pass `path` (a file) or `text`, and `question`: what you need from it. " +
        'Returns only that. Prefer it to reading a huge file whole when you need the gist or one fact; ' +
        'read the exact lines yourself when you need precise code to edit.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'A file to read, relative to the working directory or absolute' },
          text: { type: 'string', description: 'The text itself, when there is no file' },
          question: { type: 'string', description: 'What you need from it; empty means a short summary' },
        },
      },
    })
    return r
  })

  on('command.run', { command: 'frugal' }, async ($, e) => {
    const arg = String(e.args ?? '').trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      enabled = arg === 'on'
      await $.store.set('enabled', enabled)
      $.ui.invalidate('ui.render')
    } else if (arg && arg !== 'status') {
      return { text: 'Try /frugal on, /frugal off or /frugal status.' }
    }
    const life = asCounts(await $.store.get('lifetime'))
    const key = configuredKey || (await $.env.get('GEMINI_API_KEY'))
    const state = enabled ? `on: helper agents run on ${helperModel}` : 'off: every agent keeps the model it asks for'
    return {
      text:
        `frugal is ${state}.\n` +
        `This session: ${plural(session.helpers, 'helper agent')} on ${helperModel}, ` +
        `${plural(session.summaries, 'big read')} on free Gemini (${kchars(session.chars)} characters kept out of context).\n` +
        `All time: ${plural(life.helpers, 'helper agent')}, ${plural(life.summaries, 'big read')}, ${kchars(life.chars)} characters.\n` +
        (key ? '' : 'No Gemini key yet: set GEMINI_API_KEY, or `claude plugin configure frugal`.'),
    }
  })


  // A helper that names no model gets the cheap one. One that asks for a model
  // keeps it, and forks always inherit their parent's.
  on('agent.spawn', async ($, e, next) => {
    if (!enabled || e.fork || e.model || !helperTypes.has(e.subagentType)) return next(e)
    const r = await next({ ...e, model: helperModel })
    await bump($, { helpers: 1 })
    return r
  })

  on('tool.call', { tool: 'mcp__frugal__summarize_free' }, async ($, e) => {
    const input = e as unknown as { path?: unknown; text?: unknown; question?: unknown }
    const key = configuredKey || (await $.env.get('GEMINI_API_KEY'))
    if (!key) return { result: 'summarize_free has no Gemini key. Read the file directly instead.', isError: true }

    let body = typeof input.text === 'string' ? input.text : ''
    const path = typeof input.path === 'string' ? input.path : ''
    if (!body && path) {
      try {
        body = String(await $.fs.read(path))
      } catch (err) {
        return { result: `Could not read ${path}: ${String(err)}`, isError: true }
      }
    }
    if (!body) return { result: 'Pass `path` or `text`.', isError: true }

    const question = typeof input.question === 'string' && input.question.trim() ? input.question.trim() : 'Summarise it in under 200 words: what it is, and anything that looks wrong.'
    const clipped = body.length > MAX_CHARS
    const prompt =
      'You are helping a coding agent that cannot afford to read this whole thing. ' +
      'Answer only from the content below. Be concise and concrete: quote exact names, ' +
      'numbers, error messages and line fragments when they matter. If the answer is not in it, say so.\n\n' +
      `Question: ${question}\n\n----- ${path || 'text'}${clipped ? ` (first ${MAX_CHARS} characters of ${body.length})` : ''} -----\n` +
      body.slice(0, MAX_CHARS)

    for (const model of geminiModels) {
      const res = await $.http.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      })
      if (!res.ok) continue // busy or out of quota: try the next model
      let answer = ''
      try {
        const j = JSON.parse(res.text) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        answer = (j.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim()
      } catch {
        continue
      }
      if (!answer) continue
      await bump($, { summaries: 1, chars: Math.min(body.length, MAX_CHARS) })
      return { result: `${answer}\n\n(summarised by ${model} from ${body.length} characters${clipped ? ', clipped' : ''})` }
    }
    return { result: 'Every Gemini model was busy or out of quota. Read the file directly instead.', isError: true }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const original = await next(e)
    if (!enabled || session.helpers + session.summaries === 0) return original
    const { Box, Text } = $.ui.resolve(e)
    const parts = [
      session.helpers ? `${plural(session.helpers, 'helper')} on ${helperModel}` : '',
      session.summaries ? `${plural(session.summaries, 'big read')} on free Gemini, ${kchars(session.chars)} chars kept out` : '',
    ].filter(Boolean)
    const line = Text({ wrap: 'truncate', children: [Text({ color: GREEN, children: '● frugal ' }), Text({ color: MUTED, children: parts.join(' · ') })] })
    return original ? Box({ flexDirection: 'column', children: [original, line] }) : line
  })
}
