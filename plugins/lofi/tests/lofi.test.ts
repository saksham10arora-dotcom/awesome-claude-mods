import { test, expect, mock } from 'claude-code/testing'

// The engine beneath: a mocked clock and store, a player that records what it
// was asked to play, and tools that succeed unless told to fail.
function engine(on: any, enabled = false) {
  const plays: { asset: string; loop: boolean; gain?: number }[] = []
  mock.store(on, enabled ? { enabled: true } : {})
  const clock = mock.clock(on, { now: 0 })
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', ($: any, e: any) => ({ value: { command: e.name } }))
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', ($: any, e: any) => (e.command === 'npm test -- broken' ? { isError: true, result: 'exit 1', text: 'exit 1' } : { result: {}, text: 'ok' }))
  on('audio.play', ($: any, e: any) => {
    plays.push({ asset: e.clip.asset, loop: e.shouldLoop === true, gain: e.gain })
    return { value: undefined }
  })
  return { plays, clock }
}

const start = ($: any) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
const lofi = ($: any, args: string) =>
  $.command.run({ command: 'lofi', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
const turnStart = ($: any) => $.turn.start({ turnId: 't', prompt: 'go' })
const turnEnd = ($: any) => $.turn.complete({ turnId: 't', answer: 'done', reason: 'end_turn', isAborted: false })
const edit = ($: any, n: number) => $.tool.call({ tool: 'Edit', file_path: `/work/f${n}.ts`, old_string: 'a', new_string: 'b' })
const loops = (eng: any) => eng.plays.filter((p: any) => p.loop).map((p: any) => p.asset)
const cues = (eng: any) => eng.plays.filter((p: any) => !p.loop).map((p: any) => p.asset)

test('silent until /lofi on', async ($: any, on: any) => {
  const eng = engine(on)
  await start($)
  await turnStart($)
  await edit($, 1)
  await turnEnd($)
  expect(eng.plays).toEqual([])
})

test('the music follows the session: calm, focus, flow, a chord for a long turn, then calm', async ($: any, on: any) => {
  const eng = engine(on)
  await start($)
  await lofi($, 'on')
  await turnStart($)
  await edit($, 1)
  await edit($, 2)
  expect(loops(eng)).toEqual(['audio/calm.mp3', 'audio/focus.mp3'])
  await edit($, 3) // three edits inside a minute
  expect(loops(eng)).toEqual(['audio/calm.mp3', 'audio/focus.mp3', 'audio/flow.mp3'])
  await eng.clock.advance(50_000) // a long turn
  await turnEnd($)
  expect(cues(eng)).toEqual(['audio/done.mp3'])
  expect(loops(eng).at(-1)).toBe('audio/calm.mp3')
  expect(String((await lofi($, 'status')).text)).toContain('playing calm')
  await eng.clock.advance(3 * 60_000 + 1000) // idle long enough
  expect(String((await lofi($, 'status')).text)).toContain('nothing (idle)')
})

test('test commands get a chime when they pass and a low note when they fail', async ($: any, on: any) => {
  const eng = engine(on, true)
  await start($)
  await turnStart($)
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- broken' })
  await $.tool.call({ tool: 'Bash', command: 'ls -la' })
  expect(cues(eng)).toEqual(['audio/pass.mp3', 'audio/fail.mp3'])
})

test('/lofi vol restarts the loop at the new volume and remembers it', async ($: any, on: any) => {
  const eng = engine(on)
  await start($)
  await lofi($, 'on')
  expect(eng.plays[0].gain).toBe(0.3)
  expect(String((await lofi($, 'vol 50')).text)).toBe('Volume 50.')
  expect(eng.plays.at(-1)).toEqual({ asset: 'audio/calm.mp3', loop: true, gain: 0.5 })
  expect(String((await lofi($, 'vol 200')).text)).toContain('0 to 100')
})
