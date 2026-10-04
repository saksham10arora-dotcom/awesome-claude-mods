import type { EngineInterface, Register } from 'claude-code'

// lofi: a soundtrack that follows the session.
//   calm  while Claude is idle (then silence after a few minutes)
//   focus while a turn runs
//   flow  when Claude is editing hard (3+ edits inside a minute)
//   cues: a chime when a test command passes, a low note when it fails,
//         a soft chord when a long turn finishes.
// Off until /lofi on. Every sound is the mod's own file (audio/, synthesised
// by scripts/make_audio.py), played through the system player.

type Mood = 'calm' | 'focus' | 'flow'
type Cue = 'pass' | 'fail' | 'done'

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const TEST_COMMAND = /\b(pytest|jest|vitest|mocha|go test|cargo test|npm (run )?test|pnpm (run )?test|yarn test|bun test|claude plugin test|unittest|rspec|phpunit)\b/
const FLOW_EDITS = 3
const FLOW_WINDOW_MS = 60_000
const LONG_TURN_MS = 45_000
const OVERLAP_MS = 250 // the old loop keeps playing this long under the new one

// Module state: a hot reload starts the music over.
let enabled = false
let volume = 30
let mood: Mood | null = null
let loop: AbortController | null = null
let idleTimer: { cancel: () => void } | null = null
let turnStartedAt = 0
let edits: number[] = []

const gain = () => Math.max(0, Math.min(100, volume)) / 100

async function setMood($: EngineInterface, next: Mood | null) {
  if (next === mood && (next === null || loop)) return
  const old = loop
  mood = next
  loop = null
  if (next) {
    const c = new AbortController()
    loop = c
    $.audio.play({ asset: `audio/${next}.mp3` }, { shouldLoop: true, gain: gain(), signal: c.signal }).catch(() => {
      if (loop === c) loop = null // the player failed: let the next mood try again
    })
  }
  if (old) {
    if (next) $.clock.after(OVERLAP_MS, () => old.abort())
    else old.abort()
  }
}

async function cue($: EngineInterface, name: Cue) {
  $.audio.play({ asset: `audio/${name}.mp3` }, { gain: Math.min(1, gain() * 1.6) }).catch(() => {})
}

export const register: Register = (on, options) => {
  const idleMs = Math.max(0, Number(options.idleMinutes ?? 3)) * 60_000

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    enabled = (await $.store.get('enabled')) === true
    const saved = Number(await $.store.get('volume'))
    volume = Number.isFinite(saved) && saved > 0 ? saved : Number(options.volume ?? 30)
    await $.command.register({
      name: 'lofi',
      description: 'lofi: a soundtrack that follows the session (on, off, vol 0-100, status)',
      argumentHint: '[on | off | vol <0-100> | status]',
      immediate: true,
    })
    return r
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      turnStartedAt = await $.clock.now()
      idleTimer?.cancel()
      idleTimer = null
      if (enabled) await setMood($, 'focus')
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (!enabled || ran.deny !== undefined) return ran
    if (EDIT_TOOLS.has(e.tool) && ran.isError !== true) {
      const now = await $.clock.now()
      edits = [...edits.filter(t => now - t < FLOW_WINDOW_MS), now]
      if (edits.length >= FLOW_EDITS && mood !== 'flow') await setMood($, 'flow')
    } else if (e.tool === 'Bash') {
      const command = String((e as unknown as { command?: unknown }).command ?? '')
      if (TEST_COMMAND.test(command)) await cue($, ran.isError === true ? 'fail' : 'pass')
    }
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId || !enabled) return r
    const now = await $.clock.now()
    if (!e.isAborted && now - turnStartedAt > LONG_TURN_MS) await cue($, 'done')
    edits = []
    await setMood($, 'calm')
    idleTimer?.cancel()
    idleTimer = $.clock.after(idleMs, () => {
      idleTimer = null
      void setMood($, null)
    })
    return r
  })

  on('command.run', { command: 'lofi' }, async ($, e) => {
    const [word, value] = String(e.args ?? '').trim().toLowerCase().split(/\s+/)
    if (word === 'on') {
      enabled = true
      await $.store.set('enabled', true)
      await setMood($, 'calm')
      return { text: `lofi is on at volume ${volume}. calm now, focus while Claude works, flow when it edits hard.` }
    }
    if (word === 'off') {
      enabled = false
      await $.store.set('enabled', false)
      idleTimer?.cancel()
      idleTimer = null
      await setMood($, null)
      return { text: 'lofi is off.' }
    }
    if (word === 'vol') {
      const v = Number(value)
      if (!(v >= 0 && v <= 100)) return { text: 'Give a volume from 0 to 100, like /lofi vol 25.' }
      volume = v
      await $.store.set('volume', v)
      if (mood) {
        const playing = mood
        await setMood($, null) // restart the loop at the new volume
        await setMood($, playing)
      }
      return { text: `Volume ${v}.` }
    }
    if (word && word !== 'status') return { text: 'Try /lofi on, /lofi off, /lofi vol 25 or /lofi status.' }
    return { text: enabled ? `lofi is on, volume ${volume}, playing ${mood ?? 'nothing (idle)'}.` : 'lofi is off. /lofi on starts it.' }
  })
}
