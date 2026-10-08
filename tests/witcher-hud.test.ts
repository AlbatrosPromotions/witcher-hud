import { expect, test } from 'claude-code/testing'

import { adrenalineOf, bar, levelOf, signOf } from '../hooks/register'

const usage = (input: number, output: number) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: 1000,
  cache_creation_input_tokens: 0,
  model: 'claude-opus-5-5',
})

const props = {
  hasSurvey: false,
  isWorking: true,
  maxRows: 20,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
}

test('levels double', () => {
  expect(levelOf(0)).toEqual({ level: 1, title: 'Kaer Morhen Trainee', into: 0, need: 5000 })
  expect(levelOf(5000)).toEqual({ level: 2, title: 'Survivor of the Grasses', into: 0, need: 10000 })
  expect(levelOf(10 ** 9).title).toBe('White Wolf')
})

test('draws bars, adrenaline and signs', () => {
  expect(bar(0.5, 10)).toBe('█████░░░░░')
  expect(adrenalineOf({ input: 50, output: 0, cacheRead: 950, cacheWrite: 0, calls: 1 })).toBe(3)
  expect(adrenalineOf({ input: 1000, output: 0, cacheRead: 0, cacheWrite: 0, calls: 1 })).toBe(0)
  expect(signOf('Bash')).toBe('Igni')
  expect(signOf('Edit')).toBe('Yrden')
  expect(signOf('mcp__x__y')).toBe('Witcher Senses')
})

test('sums model requests into the HUD and levels up', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  let n = 0
  on('turn.step', async function* (_, e) {
    n += 1
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: n === 1 ? usage(1200, 300) : usage(3000, 800),
    }
  })

  const step = { turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 }
  for await (const _ of $.turn.step(step));
  for await (const _ of $.turn.step({ ...step, index: 1 }));

  expect(toasts).toEqual(['⚔ LEVEL UP! Ability point gained. Level 2: Survivor of the Grasses'])

  for (const surface of ['terminal', 'desktop'] as const) {
    const hud = await $.ui.mount({ plugin: 'witcher-hud', surface, component: 'AbovePrompt', props })
    expect(await hud.find({ text: 'LEVEL 2' })).toBeDefined()
    expect(await hud.find({ text: 'Survivor of the Grasses' })).toBeDefined()
    expect(await hud.find({ text: '2 contracts' })).toBeDefined()
    expect(await hud.find({ text: 'medallion humming' })).toBeDefined()
    expect(await hud.find({ text: '↑4.2k ↓1.1k' })).toBeDefined()
  }
})
