import type { EngineInterface, Register } from 'claude-code'

// vhs: a tape of every edit Claude makes this session.
// Each Edit/Write/MultiEdit/NotebookEdit is snapshotted before and after, so
// every file has its versions in order. /vhs opens a pane that replays them:
// each step shows the change in context with the new lines typing themselves
// in. h/l step, p plays, f switches file, r twice rewinds the file.

const PANE = 'vhs'
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const MAX_FILE = 400_000 // characters; bigger files are not taped
const MAX_TAPE = 6_000_000 // characters across the whole tape
const CONTEXT = 3 // unchanged lines shown around a change
const TYPE_MS = 1400 // how long a step's new lines take to type in
const HOLD_MS = 900 // pause on a finished step while playing
const TICK_MS = 50

const RED = '#ef5a5a'
const GREEN = '#3ecf8e'
const AMBER = '#f8b45a'
const MUTED = '#7d828c'
const CREAM = '#e9e4dc'

type Version = { at: number; tool: string; text: string }
type Op = { kind: ' ' | '-' | '+'; text: string }
type Hunk = { start: number; ops: Op[]; addedCount: number; removedCount: number }

// The tape and the player. Module state: a hot reload starts the tape over.
const tape = new Map<string, Version[]>()
let tapeChars = 0
const player = { file: 0, step: 1, isPlaying: false, typedFrom: 0, armedRestore: false, notice: '' }
let ticker: { cancel: () => void } | null = null

const files = () => [...tape.keys()]
const base = (p: string) => p.split('/').pop() || p
const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 8)

// The change between two versions as a line diff, the way git shows it: the
// common head and tail are trimmed, the middle is diffed by longest common
// subsequence (so a line that did not change is shown as context, not as
// removed and added again), with CONTEXT unchanged lines around it.
function hunk(a: string, b: string): Hunk {
  const x = a.split('\n')
  const y = b.split('\n')
  let pre = 0
  while (pre < x.length && pre < y.length && x[pre] === y[pre]) pre++
  let suf = 0
  while (suf < x.length - pre && suf < y.length - pre && x[x.length - 1 - suf] === y[y.length - 1 - suf]) suf++
  const xs = x.slice(pre, x.length - suf)
  const ys = y.slice(pre, y.length - suf)
  const mid: Op[] = []
  if (xs.length * ys.length <= 250_000) {
    const L = Array.from({ length: xs.length + 1 }, () => new Array<number>(ys.length + 1).fill(0))
    for (let i = xs.length - 1; i >= 0; i--)
      for (let j = ys.length - 1; j >= 0; j--) L[i][j] = xs[i] === ys[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    let i = 0
    let j = 0
    while (i < xs.length || j < ys.length) {
      if (i < xs.length && j < ys.length && xs[i] === ys[j]) mid.push({ kind: ' ', text: xs[i++] }), j++
      else if (j < ys.length && (i >= xs.length || L[i][j + 1] > L[i + 1][j])) mid.push({ kind: '+', text: ys[j++] }) // ties go to '-', so removals come first, as in git
      else mid.push({ kind: '-', text: xs[i++] })
    }
  } else {
    // too big to diff line by line: show it as one replaced block
    for (const t of xs) mid.push({ kind: '-', text: t })
    for (const t of ys) mid.push({ kind: '+', text: t })
  }
  const head = x.slice(Math.max(0, pre - CONTEXT), pre).map(text => ({ kind: ' ' as const, text }))
  const tail = y.slice(y.length - suf, Math.min(y.length, y.length - suf + CONTEXT)).map(text => ({ kind: ' ' as const, text }))
  return {
    start: Math.max(0, pre - CONTEXT) + 1,
    ops: [...head, ...mid, ...tail],
    addedCount: mid.filter(o => o.kind === '+').length,
    removedCount: mid.filter(o => o.kind === '-').length,
  }
}

async function snapshot($: EngineInterface, path: string): Promise<string | null> {
  try {
    if (!(await $.fs.exists(path))) return ''
    const t = String(await $.fs.read(path))
    return t.length > MAX_FILE ? null : t
  } catch {
    return null
  }
}

function add(path: string, v: Version) {
  const list = tape.get(path) ?? []
  list.push(v)
  tape.set(path, list)
  tapeChars += v.text.length
  // Over budget: drop the oldest middle versions, never a file's first or last.
  for (const [p, l] of tape) {
    while (tapeChars > MAX_TAPE && l.length > 2) {
      const [gone] = l.splice(1, 1)
      tapeChars -= gone.text.length
    }
    if (tapeChars <= MAX_TAPE) break
    void p
  }
}

function stopTicker() {
  ticker?.cancel()
  ticker = null
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({
      name: 'vhs',
      description: "vhs: replay every edit Claude made this session (/vhs, /vhs list, /vhs <file>)",
      argumentHint: '[list | <file> | close]',
      immediate: true,
    })
    return r
  })

  on('tool.call', async ($, e, next) => {
    if (!EDIT_TOOLS.has(e.tool)) return next(e)
    const input = e as unknown as { file_path?: unknown; notebook_path?: unknown }
    const path = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : ''
    const before = path ? await snapshot($, path) : null
    const ran = await next(e)
    if (!path || before === null || ran.deny !== undefined || ran.isError === true) return ran
    const after = await snapshot($, path)
    if (after === null || after === before) return ran
    const now = await $.clock.now()
    if (!tape.has(path)) add(path, { at: now, tool: before === '' ? 'new file' : 'original', text: before })
    add(path, { at: now, tool: e.tool, text: after })
    return ran
  })

  on('command.run', { command: 'vhs' }, async ($, e) => {
    const arg = String(e.args ?? '').trim()
    const names = files()
    if (arg === 'close') {
      stopTicker()
      await $.ui.close({ id: PANE })
      return { text: 'Tape ejected.' }
    }
    if (names.length === 0) return { text: 'The tape is empty: no edits yet this session.' }
    if (arg === 'list') {
      return { text: names.map((p, i) => `${i + 1}. ${p} (${(tape.get(p)?.length ?? 1) - 1} edits)`).join('\n') }
    }
    let idx = names.length - 1 // the file touched most recently
    if (arg) {
      const n = Number(arg)
      const found = n >= 1 && n <= names.length ? n - 1 : names.findIndex(p => p.toLowerCase().includes(arg.toLowerCase()))
      if (found < 0) return { text: `No taped file matches "${arg}". Try /vhs list.` }
      idx = found
    }
    Object.assign(player, { file: idx, step: 1, isPlaying: true, typedFrom: await $.clock.now(), armedRestore: false, notice: '' })
    const opened = await $.ui.open({ id: PANE, title: 'vhs', focus: true, rows: 22 })
    if (!opened.isPlaced) return { text: `The replay pane could not open (${opened.reason}). /vhs list shows the tape.` }
    return { text: `Playing ${base(names[idx])}. h and l step, p plays or pauses, f next file, r twice rewinds, Esc returns to the prompt.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const names = files()
    const path = names[player.file]
    const versions = path ? tape.get(path) ?? [] : []
    if (!path || versions.length < 2) {
      stopTicker()
      return Text({ color: MUTED, children: 'The tape is empty: no edits yet this session.' })
    }
    player.step = Math.min(Math.max(1, player.step), versions.length - 1)
    const cur = versions[player.step]
    const prev = versions[player.step - 1]
    const h = hunk(prev.text, cur.text)
    const now = await $.clock.now()
    const typed = Math.min(1, (now - player.typedFrom) / TYPE_MS)
    const width = Math.max(30, (e.props.bodyColumns ?? 80) - 4)
    const room = Math.max(4, (e.viewport?.rows ?? 22) - 7)

    // Keep the clock running while a step types in or the tape plays.
    if ((typed < 1 || player.isPlaying) && !ticker) {
      ticker = $.clock.every(TICK_MS, () => {
        void (async () => {
          const t = await $.clock.now()
          const list = tape.get(files()[player.file] ?? '') ?? []
          if (player.isPlaying && t - player.typedFrom > TYPE_MS + HOLD_MS) {
            if (player.step < list.length - 1) {
              player.step += 1
              player.typedFrom = t
            } else {
              player.isPlaying = false
            }
          }
          if (!player.isPlaying && t - player.typedFrom > TYPE_MS) stopTicker()
          $.ui.invalidate('ui.render')
        })()
      })
    }

    const go = async (step: number, isPlaying = false) => {
      Object.assign(player, { step, isPlaying, typedFrom: await $.clock.now(), armedRestore: false, notice: '' })
      $.ui.invalidate('ui.render')
    }

    // The diff, with the added lines revealed by `typed`, in order.
    const total = h.ops.reduce((n, o) => n + (o.kind === '+' ? o.text.length + 1 : 0), 0)
    let budget = Math.round(total * typed)
    const lines: ReturnType<typeof Text>[] = []
    let n = h.start
    const row = (mark: string, text: string, color: string, num: number | null) =>
      Text({ wrap: 'truncate', children: [Text({ color: MUTED, children: `${num === null ? '    ' : String(num).padStart(4)} ` }), Text({ color, children: `${mark} ${text}`.slice(0, width) })] })
    for (const o of h.ops) {
      if (o.kind === '-') {
        lines.push(row('-', o.text, RED, null))
      } else if (o.kind === '+') {
        if (budget <= 0) break
        const shown = o.text.slice(0, budget)
        budget -= o.text.length + 1
        lines.push(row('+', shown + (budget < 0 ? '█' : ''), GREEN, n++))
      } else {
        lines.push(row(' ', o.text, MUTED, n++))
      }
    }
    const clipped = lines.length > room ? [...lines.slice(0, room - 1), Text({ color: MUTED, children: `     ... ${lines.length - room + 1} more lines` })] : lines

    const rec = Math.floor(now / 500) % 2 === 0 ? '●' : ' '
    const header = Text({
      wrap: 'truncate',
      children: [
        Text({ color: RED, bold: true, children: `${rec} ${player.isPlaying ? 'PLAY' : 'PAUSE'} ` }),
        Text({ color: CREAM, bold: true, children: `${base(path)} ` }),
        Text({ color: MUTED, children: `step ${player.step}/${versions.length - 1} · ${clock(cur.at)} · ${cur.tool} · ` }),
        Text({ color: GREEN, children: `+${h.addedCount} ` }),
        Text({ color: RED, children: `-${h.removedCount}` }),
        Text({ color: MUTED, children: names.length > 1 ? ` · file ${player.file + 1}/${names.length}` : '' }),
      ],
    })

    const restore = async () => {
      if (!player.armedRestore) {
        player.armedRestore = true
        player.notice = `Press r again to rewind ${base(path)} to step ${player.step} (${clock(cur.at)}).`
        $.ui.invalidate('ui.render')
        return
      }
      await $.fs.write(path, cur.text)
      const t = await $.clock.now()
      add(path, { at: t, tool: `rewind to step ${player.step}`, text: cur.text })
      Object.assign(player, { armedRestore: false, notice: `Rewound ${base(path)} to step ${player.step}. That rewind is on the tape too.` })
      $.ui.invalidate('ui.render')
    }

    const controls = Box({
      flexDirection: 'row',
      gap: 1,
      children: [
        Button({ key: 'prev', label: 'h ◀', hotkey: 'h', onPress: () => go(Math.max(1, player.step - 1)) }),
        Button({ key: 'play', label: player.isPlaying ? 'p ❚❚' : 'p ▶', hotkey: 'p', variant: 'primary', onPress: () => (player.isPlaying ? go(player.step, false) : go(player.step >= versions.length - 1 ? 1 : player.step, true)) }),
        Button({ key: 'next', label: 'l ▶', hotkey: 'l', onPress: () => go(Math.min(versions.length - 1, player.step + 1)) }),
        Button({ key: 'file', label: 'f file', hotkey: 'f', onPress: async () => { player.file = (player.file + 1) % files().length; await go(1, true) } }),
        Button({ key: 'restore', label: player.armedRestore ? 'r confirm' : 'r rewind', hotkey: 'r', onPress: restore }),
        Button({ key: 'close', label: 'c close', hotkey: 'c', role: 'dismiss', onPress: async () => { stopTicker(); await $.ui.close({ id: PANE }) } }),
      ],
    })

    return Box({
      flexDirection: 'column',
      children: [header, Text({ color: MUTED, children: '─'.repeat(Math.min(width, 60)) }), ...clipped, ...(player.notice ? [Text({ color: AMBER, children: player.notice })] : []), controls],
    })
  })
}
