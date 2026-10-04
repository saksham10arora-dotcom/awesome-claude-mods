import { test, expect, mock } from 'claude-code/testing'

// An in-memory disk, and an engine whose Edit and Write tools really change it,
// so the mod's before/after snapshots see what a session would.
function engine(on: any) {
  const disk: Record<string, string> = {}
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', ($: any, e: any) => ({ value: { command: e.name } }))
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 5, 2, 0, 0) })
  on('fs.exists', ($: any, e: any) => ({ value: e.path in disk }))
  on('fs.read', ($: any, e: any) => ({ value: disk[e.path] }))
  on('fs.write', ($: any, e: any) => {
    disk[e.path] = e.text
    return { value: undefined }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('tool.call', ($: any, e: any) => {
    if (e.tool === 'Write') disk[e.file_path] = e.content
    else if (e.tool === 'Edit') {
      if (!disk[e.file_path]?.includes(e.old_string)) return { isError: true, result: 'old_string not found', text: 'old_string not found' }
      disk[e.file_path] = disk[e.file_path].replace(e.old_string, e.new_string)
    }
    return { result: {}, text: 'ok' }
  })
  return { disk, clock }
}

const start = ($: any) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
const cmd = ($: any, args: string) =>
  $.command.run({ command: 'vhs', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
const F = '/work/api.ts'
const V1 = 'function getUser(id) {\n  return fetchUser(id)\n}\n'
const V2 = 'const cache = new Map()\nfunction getUser(id) {\n  if (cache.has(id)) return cache.get(id)\n  return fetchUser(id)\n}\n'

async function twoEdits($: any) {
  await $.tool.call({ tool: 'Write', file_path: F, content: V1 })
  await $.tool.call({ tool: 'Edit', file_path: F, old_string: V1, new_string: V2 })
}

test('every edit lands on the tape, failed ones do not', async ($: any, on: any) => {
  engine(on)
  await start($)
  expect(String((await cmd($, '')).text)).toContain('tape is empty')
  await twoEdits($)
  await $.tool.call({ tool: 'Edit', file_path: F, old_string: 'not there', new_string: 'x' })
  expect(String((await cmd($, 'list')).text)).toBe(`1. ${F} (2 edits)`)
})

test('the pane replays the change and rewinds the file on a double r', async ($: any, on: any) => {
  const eng = engine(on)
  await start($)
  await twoEdits($)
  expect(String((await cmd($, 'api')).text)).toContain('Playing api.ts')
  const ui = await $.ui.mount({ plugin: 'vhs', surface: 'terminal', component: 'Pane', requestId: 'vhs', props: { bodyColumns: 100 } as any, viewport: { columns: 100, rows: 22 } as any })
  expect(await ui.find({ type: 'Text', text: /step 1\/2/ }), 'step 1').toBeDefined()
  expect(await ui.find({ type: 'Text', text: /return fetchUser/ }), 'nothing typed yet').toBeUndefined()
  await eng.clock.advance(1500) // past the typing time, short of the next step
  expect(await ui.find({ type: 'Text', text: /\+   return fetchUser\(id\)/ }), 'typed in').toBeDefined()
  await ui.press({ key: 'next' })
  expect(await ui.find({ type: 'Text', text: /step 2\/2/ }), 'step 2').toBeDefined()
  await ui.press({ key: 'prev' })
  await ui.press({ key: 'restore' })
  expect(eng.disk[F]).toBe(V2) // one press only arms it
  expect(await ui.find({ type: 'Text', text: /Press r again/ }), 'armed notice').toBeDefined()
  await ui.press({ key: 'restore' })
  expect(eng.disk[F]).toBe(V1)
  expect(String((await cmd($, 'list')).text)).toBe(`1. ${F} (3 edits)`) // the rewind is taped too
  await ui.unmount()
})

test('/vhs with an unknown file says so', async ($: any, on: any) => {
  engine(on)
  await start($)
  await twoEdits($)
  expect(String((await cmd($, 'nope')).text)).toContain('No taped file matches "nope"')
})
