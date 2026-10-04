import { test, expect } from 'claude-code/testing'

const QUIZ = {
  concept: 'caching',
  question: 'Why does the new code keep results in a Map?',
  choices: ['To sort them', 'To avoid repeating the same slow API call', 'To make it async', 'To log errors'],
  answer: 2,
  why: 'Same input pe dobara API call nahi hoti, result Map se mil jaata hai.',
}

function engine(on: any, reply: string = JSON.stringify(QUIZ)) {
  const store: Record<string, unknown> = {}
  const prompts: string[] = []
  let now = 1_000_000
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', ($: any, e: any) => ({ value: { command: e.name } }))
  on('store.get', ($: any, e: any) => ({ value: store[e.key] }))
  on('store.set', ($: any, e: any) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('clock.now', () => ({ value: (now += 1000) }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', ($: any, e: any) => ({ text: '' }))
  on('tool.call', ($: any, e: any) => ({ result: {}, text: 'ok' }))
  on('model.complete', ($: any, e: any) => {
    prompts.push(e.prompt)
    return { value: { isAnswered: true, text: reply, usage: {} } }
  })
  return { store, prompts, skip: (ms: number) => (now += ms) }
}

const settle = async () => {
  for (let i = 0; i < 60; i++) await Promise.resolve()
}
const start = ($: any) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
const turn = async ($: any, edit?: Record<string, unknown>) => {
  await $.turn.start({ turnId: 't', prompt: 'add caching' })
  if (edit) await $.tool.call(edit)
  await $.turn.complete({ turnId: 't', answer: 'done', reason: 'end_turn', isAborted: false })
  await settle()
}
const cmd = ($: any, command: string, args: string) =>
  $.command.run({ command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
const EDIT = { tool: 'Edit', file_path: '/work/api.ts', old_string: 'return fetchUser(id)', new_string: 'if (cache.has(id)) return cache.get(id)\nconst u = await fetchUser(id)\ncache.set(id, u)\nreturn u' }

test('a turn that edits code produces a question about that change', async ($: any, on: any) => {
  const eng = engine(on)
  await start($)
  await turn($, EDIT)
  expect(eng.prompts.length).toBe(1)
  expect(eng.prompts[0]).toContain('cache.set(id, u)')
  expect(eng.prompts[0]).toContain('Hinglish')
  expect((eng.store.pending as any).question).toBe(QUIZ.question)
})

test('a turn without edits asks nothing', async ($: any, on: any) => {
  const eng = engine(on)
  await start($)
  await turn($)
  expect(eng.prompts.length).toBe(0)
})

test('right and wrong answers are scored per concept and show in stats', async ($: any, on: any) => {
  const eng = engine(on)
  await start($)
  await turn($, EDIT)
  const right = await cmd($, 'a', '2')
  expect(String(right.text)).toContain('Sahi!')
  eng.skip(10 * 60_000) // past the cooldown
  await turn($, EDIT)
  const wrong = await cmd($, 'a', '1')
  expect(String(wrong.text)).toContain('it was 2) To avoid repeating the same slow API call')
  expect(eng.store.scores).toEqual({ caching: { right: 1, wrong: 1 } })
  const s = await cmd($, 'teach', 'stats')
  expect(String(s.text)).toContain('1/2 right (50%)')
  expect(String(s.text)).toContain('caching: 1/2')
})

test('the cooldown holds back a second question', async ($: any, on: any) => {
  const eng = engine(on)
  await start($)
  await turn($, EDIT)
  await cmd($, 'a', 'skip')
  await turn($, EDIT)
  expect(eng.prompts.length).toBe(1)
})

test('a reply that is not a valid quiz is ignored, not shown', async ($: any, on: any) => {
  const eng = engine(on, 'sorry, I cannot do that')
  await start($)
  await turn($, EDIT)
  expect(eng.store.pending).toBeUndefined()
  const r = await cmd($, 'a', '1')
  expect(String(r.text)).toContain('No question waiting')
})
