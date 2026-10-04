import { test, expect } from 'claude-code/testing'

// The engine beneath the mod: an in-memory store, an env with or without a key,
// a fake Gemini, and an agent spawner that records the model it was handed.
function engine(on: any, opts: { key?: string; gemini?: (model: string) => { ok: boolean; status: number; text: string } } = {}) {
  const store: Record<string, unknown> = {}
  const spawned: { type: string; model?: string }[] = []
  const fetched: string[] = []
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', ($: any, e: any) => ({ value: { command: e.name } }))
  on('tool.register', ($: any, e: any) => ({ value: { tool: `mcp__frugal__${e.name}` } }))
  on('store.get', ($: any, e: any) => ({ value: store[e.key] }))
  on('store.set', ($: any, e: any) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('env.get', ($: any, e: any) => ({ value: e.name === 'GEMINI_API_KEY' ? opts.key : undefined }))
  on('fs.read', ($: any, e: any) => ({ value: e.path === 'big.log' ? 'ERROR: disk full at 03:12\n'.repeat(2000) : undefined }))
  on('http.fetch', ($: any, e: any) => {
    const model = String(e.url).split('/models/')[1].split(':')[0]
    fetched.push(model)
    return { value: opts.gemini ? opts.gemini(model) : { ok: false, status: 500, text: '' } }
  })
  on('agent.spawn', ($: any, e: any) => {
    spawned.push({ type: e.subagentType, model: e.model })
    return { model: e.model ?? e.parentModel }
  })
  return { store, spawned, fetched }
}

const start = ($: any) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
const spawn = ($: any, subagentType: string, model?: string) =>
  $.agent.spawn({ prompt: 'look around', description: 'look', subagentType, model, parentModel: 'fable', background: false, fork: false, provider: { kind: 'model' } })
const command = ($: any, args: string) =>
  $.command.run({ command: 'frugal', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })

test('helper agents that name no model run on haiku; others are left alone', async ($: any, on: any) => {
  const eng = engine(on)
  await start($)
  await spawn($, 'Explore')
  await spawn($, 'general-purpose')
  await spawn($, 'Explore', 'opus')
  expect(eng.spawned).toEqual([
    { type: 'Explore', model: 'haiku' },
    { type: 'general-purpose', model: undefined },
    { type: 'Explore', model: 'opus' },
  ])
})

test('/frugal off stops the rewrite and is remembered', async ($: any, on: any) => {
  const eng = engine(on)
  await start($)
  const r = await command($, 'off')
  expect(String(r.text)).toContain('frugal is off')
  expect(eng.store.enabled).toBe(false)
  await spawn($, 'Explore')
  expect(eng.spawned[0].model).toBeUndefined()
})

test('summarize_free reads the file and falls through to the next model when one is busy', async ($: any, on: any) => {
  const eng = engine(on, {
    key: 'k',
    gemini: model =>
      model === 'gemini-flash-lite-latest'
        ? { ok: false, status: 429, text: '' }
        : { ok: true, status: 200, text: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'The disk filled up at 03:12.' }] } }] }) },
  })
  await start($)
  const r: any = await $.tool.call({ tool: 'mcp__frugal__summarize_free', path: 'big.log', question: 'why did it fail?' })
  expect(String(r.result)).toContain('The disk filled up at 03:12.')
  expect(String(r.result)).toContain('gemini-3.5-flash-lite')
  expect(eng.fetched).toEqual(['gemini-flash-lite-latest', 'gemini-3.5-flash-lite'])
  const status = await command($, 'status')
  expect(String(status.text)).toContain('1 big read on free Gemini')
})

test('without a key, summarize_free says so instead of failing silently', async ($: any, on: any) => {
  engine(on)
  await start($)
  const r: any = await $.tool.call({ tool: 'mcp__frugal__summarize_free', text: 'hello' })
  expect(r.isError).toBe(true)
  expect(String(r.result)).toContain('no Gemini key')
})
