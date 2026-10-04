import type { EngineInterface, Register } from 'claude-code'

// teach-me: Claude writes the code, you learn what it did.
// Edits made during a turn are collected; when the turn ends (and the cooldown
// allows) a small model writes one multiple-choice question about that exact
// change. It sits above the prompt until you answer with /a 1-4 or /a skip.
// Scores are kept per concept, so /teach stats shows what to revise.

const CORAL = '#e8603c'
const CREAM = '#f3eee6'
const MUTED = '#8a8f98'
const GREEN = '#3ecf8e'
const RED = '#ef5a5a'

type Change = { path: string; before: string; after: string }
type Quiz = { concept: string; question: string; choices: string[]; answer: number; why: string; path: string }
type Score = { right: number; wrong: number }
type Verdict = { isCorrect: boolean; text: string } | null

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const CLIP = 1600 // characters of each side of a change sent to the model

// Module state for this session (a hot reload starts it over).
let changes: Change[] = []
let pending: Quiz | null = null
let lastVerdict: Verdict = null
let lastQuizAt = 0
let isMaking = false

const clip = (s: string) => (s.length > CLIP ? `${s.slice(0, CLIP)}\n...(${s.length - CLIP} more characters)` : s)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

function changeFrom(e: Record<string, unknown>): Change | null {
  const path = str(e.file_path) || str(e.notebook_path)
  if (!path) return null
  if (Array.isArray(e.edits)) {
    const edits = e.edits as { old_string?: unknown; new_string?: unknown }[]
    return { path, before: clip(edits.map(x => str(x.old_string)).join('\n...\n')), after: clip(edits.map(x => str(x.new_string)).join('\n...\n')) }
  }
  if (typeof e.content === 'string') return { path, before: '', after: clip(e.content) }
  return { path, before: clip(str(e.old_string)), after: clip(str(e.new_string) || str(e.new_source)) }
}

function parseQuiz(text: string, path: string): Quiz | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0]) as Partial<Quiz>
    const choices = Array.isArray(j.choices) ? j.choices.map(c => String(c)).slice(0, 4) : []
    const answer = Number(j.answer)
    if (!j.question || choices.length !== 4 || !(answer >= 1 && answer <= 4)) return null
    return { concept: String(j.concept || 'this change').slice(0, 40), question: String(j.question), choices, answer, why: String(j.why || ''), path }
  } catch {
    return null
  }
}

async function makeQuiz($: EngineInterface, batch: Change[], model: string, language: string) {
  isMaking = true
  try {
    const shown = batch.slice(-3)
    const diff = shown
      .map(c => `FILE ${c.path}\n${c.before ? `--- before\n${c.before}\n` : ''}+++ after\n${c.after}`)
      .join('\n\n')
    const r = await $.model.complete({
      model,
      effort: 'low',
      maxTokens: 700,
      timeoutMs: 25000,
      system:
        'You write one quiz question that teaches a student developer what an AI coding agent just changed. ' +
        'The student did not write this code and is learning to understand and judge it.',
      prompt:
        'Here is the change the agent just made:\n\n' +
        diff +
        '\n\nWrite ONE multiple-choice question about WHY this change was made or what it does: the idea behind it ' +
        '(a design choice, a concept, a bug it fixes, a trade-off), not trivia like variable names or line numbers. ' +
        'Exactly four choices, one clearly right, three plausible but wrong. Keep the question under 25 words and each choice under 14 words. ' +
        `Write the question, the choices and "why" in ${language === 'Hinglish' ? 'casual Hinglish (Hindi in Latin script mixed with English tech terms)' : 'plain English'}; "why" is 2 short sentences. ` +
        'Reply with JSON only: {"concept": "2-4 words, e.g. caching, race condition", "question": "...", "choices": ["...","...","...","..."], "answer": 1-4, "why": "..."}',
    })
    if (!r.isAnswered) return
    const quiz = parseQuiz(r.text ?? '', shown[shown.length - 1].path)
    if (!quiz) return
    pending = quiz
    lastVerdict = null
    lastQuizAt = await $.clock.now()
    await $.store.set('pending', quiz)
    $.ui.invalidate('ui.render')
  } finally {
    isMaking = false
  }
}

async function record($: EngineInterface, concept: string, isCorrect: boolean) {
  const raw = (await $.store.get('scores')) as Record<string, Score> | undefined
  const scores: Record<string, Score> = raw && typeof raw === 'object' ? raw : {}
  const s = scores[concept] ?? { right: 0, wrong: 0 }
  scores[concept] = isCorrect ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 }
  await $.store.set('scores', scores)
  const streak = Number(await $.store.get('streak')) || 0
  await $.store.set('streak', isCorrect ? streak + 1 : 0)
}

async function stats($: EngineInterface) {
  const raw = (await $.store.get('scores')) as Record<string, Score> | undefined
  const rows = Object.entries(raw && typeof raw === 'object' ? raw : {})
  if (rows.length === 0) return 'No answers yet. Questions appear after Claude changes code.'
  const right = rows.reduce((n, [, s]) => n + s.right, 0)
  const total = rows.reduce((n, [, s]) => n + s.right + s.wrong, 0)
  const weak = rows
    .filter(([, s]) => s.wrong > 0)
    .sort((a, b) => b[1].wrong / (b[1].right + b[1].wrong) - a[1].wrong / (a[1].right + a[1].wrong) || b[1].wrong - a[1].wrong)
    .slice(0, 5)
    .map(([c, s]) => `  ${c}: ${s.right}/${s.right + s.wrong}`)
  const strong = rows
    .filter(([, s]) => s.wrong === 0 && s.right >= 2)
    .map(([c]) => c)
    .slice(0, 6)
  const streak = Number(await $.store.get('streak')) || 0
  return (
    `${right}/${total} right (${Math.round((right / total) * 100)}%), streak ${streak}.\n` +
    (weak.length ? `Revise these:\n${weak.join('\n')}\n` : 'Nothing weak yet.\n') +
    (strong.length ? `Solid: ${strong.join(', ')}` : '')
  )
}

export const register: Register = (on, options) => {
  const language = String(options.language || 'Hinglish')
  const model = String(options.quizModel || 'haiku')
  const cooldownMs = Math.max(0, Number(options.cooldownMinutes ?? 4)) * 60_000
  let enabled = true

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    enabled = (await $.store.get('enabled')) !== false
    const saved = await $.store.get('pending')
    if (saved && typeof saved === 'object') pending = saved as Quiz
    await $.command.register({ name: 'a', description: 'teach-me: answer the question above the prompt (1-4, or skip)', argumentHint: '<1-4 | skip>', immediate: true })
    await $.command.register({ name: 'teach', description: 'teach-me: on, off, stats, or now (a question about the last change)', argumentHint: '[on | off | stats | now]', immediate: true })
    return r
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      changes = []
      if (lastVerdict) {
        lastVerdict = null // the result line stays until the next turn starts
        $.ui.invalidate('ui.render')
      }
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (!EDIT_TOOLS.has(e.tool) || ran.deny !== undefined || ran.isError === true) return ran
    const c = changeFrom(e as unknown as Record<string, unknown>)
    if (c) changes.push(c)
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId || e.isAborted || !enabled || pending || isMaking || changes.length === 0) return r
    if ((await $.clock.now()) - lastQuizAt < cooldownMs) return r
    void makeQuiz($, changes.slice(), model, language)
    return r
  })

  on('command.run', { command: 'a' }, async ($, e) => {
    const arg = String(e.args ?? '').trim().toLowerCase()
    if (!pending) return { text: 'No question waiting. One appears after Claude changes code.' }
    const quiz = pending
    if (arg === 'skip') {
      pending = null
      await $.store.set('pending', null)
      $.ui.invalidate('ui.render')
      return { text: `Skipped. The answer was ${quiz.answer}) ${quiz.choices[quiz.answer - 1]}. ${quiz.why}` }
    }
    const n = Number(arg)
    if (!(n >= 1 && n <= 4)) return { text: 'Answer with /a 1, /a 2, /a 3 or /a 4 (or /a skip).' }
    const isCorrect = n === quiz.answer
    await record($, quiz.concept, isCorrect)
    pending = null
    await $.store.set('pending', null)
    const text = isCorrect
      ? `Sahi! ${quiz.why}`
      : `Not quite: it was ${quiz.answer}) ${quiz.choices[quiz.answer - 1]}. ${quiz.why}`
    lastVerdict = { isCorrect, text }
    $.ui.invalidate('ui.render')
    return { text: `${isCorrect ? '✓' : '✗'} ${text}` }
  })

  on('command.run', { command: 'teach' }, async ($, e) => {
    const arg = String(e.args ?? '').trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      enabled = arg === 'on'
      await $.store.set('enabled', enabled)
      if (!enabled) pending = null
      $.ui.invalidate('ui.render')
      return { text: enabled ? 'teach-me is on: a question appears after turns that change code.' : 'teach-me is off.' }
    }
    if (arg === 'stats') return { text: await stats($) }
    if (arg === 'now') {
      if (changes.length === 0) return { text: 'No changes in the last turn to ask about.' }
      if (isMaking) return { text: 'Already writing one.' }
      void makeQuiz($, changes.slice(), model, language)
      return { text: 'Writing a question about the last change...' }
    }
    return { text: `teach-me is ${enabled ? 'on' : 'off'}. ${await stats($)}\nTry /teach on, off, stats or now.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const original = await next(e)
    if (!enabled || (!pending && !lastVerdict)) return original
    const { Box, Text } = $.ui.resolve(e)
    const rows: ReturnType<typeof Text>[] = []
    if (pending) {
      const q = pending
      rows.push(
        Text({ wrap: 'truncate', children: [Text({ color: CORAL, bold: true, children: '◆ teach-me ' }), Text({ color: MUTED, children: `${q.concept} · ${q.path.split('/').pop()}` })] }),
        Text({ color: CREAM, bold: true, children: q.question }),
        ...q.choices.map((c, i) => Text({ color: CREAM, wrap: 'truncate', children: `  ${i + 1}) ${c}` })),
        Text({ color: MUTED, children: '  answer with /a 1-4, or /a skip' }),
      )
    } else if (lastVerdict) {
      rows.push(Text({ color: lastVerdict.isCorrect ? GREEN : RED, children: `◆ teach-me ${lastVerdict.isCorrect ? '✓' : '✗'} ${lastVerdict.text}` }))
    }
    const band = Box({ flexDirection: 'column', marginTop: 1, children: rows })
    return original ? Box({ flexDirection: 'column', children: [original, band] }) : band
  })
}
