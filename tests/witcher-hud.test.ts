import { expect, mock, test } from 'claude-code/testing'

import { clusterSvg, questSvg } from '../hooks/art'
import type { ClusterArt } from '../hooks/art'
import { clip, detailOf, durationRu, levelOf, money, pastWord, questLine, questTitle, signOf, spinnerWord } from '../hooks/lore'

const usage = (input: number, output: number) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: 1000,
  cache_creation_input_tokens: 0,
  model: 'claude-opus-5-5',
})

const band = (isWorking: boolean, bodyColumns = 140) => ({
  hasSurvey: false,
  isWorking,
  maxRows: 20,
  bodyColumns,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
})

const art: ClusterArt = {
  lang: 'en',
  sign: null,
  isWorking: false,
  vitality: 66,
  ghostFrom: null,
  stamina: 78,
  adrenaline: 2,
  level: 5,
  xpFraction: 0.3,
  isLevelUp: false,
  usd: 1.87,
}

test('levels double and the titles climb', () => {
  expect(levelOf(0)).toEqual({ level: 1, title: 'Kaer Morhen Trainee', into: 0, need: 5000 })
  expect(levelOf(5000)).toEqual({ level: 2, title: 'Survivor of the Grasses', into: 0, need: 10000 })
  expect(levelOf(10 ** 9).title).toBe('White Wolf')
})

test('tools are cast as signs, with what they act on', () => {
  expect(['Bash', 'Edit', 'Read', 'WebFetch', 'Agent', 'TodoWrite'].map(signOf)).toEqual([
    'igni',
    'yrden',
    'senses',
    'axii',
    'aard',
    'quen',
  ])
  expect(detailOf({ command: 'npm   test\n -- auth' }, 'Bash')).toBe('npm test -- auth')
  expect(detailOf({ file_path: '/src/auth/session.ts' }, 'Edit')).toBe('session.ts')
  expect(detailOf({ url: 'https://developer.mozilla.org/en-US/docs' }, 'WebFetch')).toBe('developer.mozilla.org')
  expect(detailOf({}, 'mcp__Claude_Browser__navigate')).toBe('navigate')
})

test('quests are named after the first line of the prompt', () => {
  expect(questTitle('\n  fix the **login** bug\nand more')).toBe('Fix the login bug')
  expect(questTitle('   ')).toBe('')
  expect(clip('Refactor the whole payments module', 20)).toBe('Refactor the whole…')
  expect(questLine('done', 'Fix it', 2140, null).objective).toBe('Quest completed · +2.1k XP')
  expect(questLine('active', 'Fix it', 0, { key: 'igni', detail: 'npm test' }).objective).toBe('Igni: npm test')
})

test('the spinner and the turn line speak the trade', () => {
  expect(spinnerWord('thinking', null)).toBe('Meditating')
  expect(spinnerWord('tool-use', 'igni')).toBe('Casting Igni')
  expect(pastWord('turn-1')).toBe(pastWord('turn-1'))
})

test('the desktop art animates what moves', () => {
  expect(clusterSvg(art)).not.toContain('animateTransform')
  expect(clusterSvg({ ...art, isWorking: true })).toContain('animateTransform')
  expect(clusterSvg({ ...art, vitality: 41, ghostFrom: 66 })).toContain('attributeName="width"')
  expect(clusterSvg({ ...art, vitality: 12 })).toContain('#FF8A73')
  expect(questSvg(questLine('active', 'a <b> & "c"', 0, null), 300)).toContain('a &lt;b&gt; &amp; &quot;c&quot;')
})

test('a quest runs through the HUD on both surfaces', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', (_, e) =>
    (e as { command?: string }).command === 'exit 1' ? { result: 'failed' as never, isError: true } : { result: 'ok' as never },
  )
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
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.turn.start({ text: 'fix the login redirect bug', turnId: 't1' })
  for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'Read', file_path: `/src/f${i}.ts` })
  await $.tool.call({ tool: 'Bash', command: 'npm test -- auth' })

  const step = { turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 }
  for await (const _ of $.turn.step(step));
  for await (const _ of $.turn.step({ ...step, index: 1 }));
  expect(toasts).toEqual(['Level up! Ability point gained · Level 2: Survivor of the Grasses'])

  const desktop = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(true) })
  const svgs = await desktop.findAll({ type: 'Svg' })
  expect(svgs.length).toBe(2)
  expect(String(svgs[0]?.props.alt)).toContain('adrenaline 1 of 3')
  expect(String(svgs[1]?.props.alt)).toBe('Fix the login redirect bug: Igni: npm test -- auth')
  expect(String(svgs[0]?.props.source)).toContain('animateTransform')

  const terminal = await $.ui.mount({ plugin: 'witcher-hud', surface: 'terminal', component: 'AbovePrompt', props: band(true) })
  expect(await terminal.find({ type: 'Text', text: 'Igni: npm test -- auth', in: 'witcher-hud' })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: 'Fix the login redirect bug', in: 'witcher-hud' })).toBeDefined()

  // A failed tool is a hit: the adrenaline is gone.
  await $.tool.call({ tool: 'Bash', command: 'exit 1' })
  // Context spent drains the vitality bar, and the lost stretch fades out.
  await $.session.measure({ context: { window: 200000, tokens: 80000, percent: 40 }, rateLimits: [], cost: { usd: 0.5 }, changed: ['context'] })
  const hit = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(true) })
  const hitSvg = await hit.findAll({ type: 'Svg' })
  expect(String(hitSvg[0]?.props.alt)).toContain('adrenaline 0 of 3')

  await $.session.measure({ context: { window: 200000, tokens: 150000, percent: 75 }, rateLimits: [], cost: { usd: 0.9 }, changed: ['context'] })
  const drained = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(true) })
  expect(String((await drained.findAll({ type: 'Svg' }))[0]?.props.source)).toContain('attributeName="width"')
  await clock.advance(2000)
  const settled = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(true) })
  expect(String((await settled.findAll({ type: 'Svg' }))[0]?.props.source)).not.toContain('attributeName="width"')

  await $.turn.complete({ answer: 'Done.', durationMs: 4000, isAborted: false, turnId: 't1', reason: 'answer' })
  const done = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(false) })
  const doneSvgs = await done.findAll({ type: 'Svg' })
  expect(String(doneSvgs[1]?.props.alt)).toBe('Fix the login redirect bug: Quest completed · +5.3k XP')
  expect(String(doneSvgs[0]?.props.source)).not.toContain('animateTransform')
})

test('the spinner and the closing line are reworded', async ($, on) => {
  const words: string[] = []
  on('ui.render', { component: 'Spinner' }, (_, e) => {
    words.push(e.props.word)
    return { type: 'Text', props: { children: e.props.word } } as never
  })
  on('ui.render', { component: 'TurnDuration' }, (_, e) => {
    words.push(e.props.word)
    return { type: 'Text', props: { children: e.props.word } } as never
  })
  const spinner = { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' as const }
  await $.ui.render({ surface: 'terminal', component: 'Spinner', requestId: 'main', props: spinner })
  await $.ui.render({ surface: 'desktop', component: 'Spinner', requestId: 'main', props: { ...spinner, word: 'Creating notes.md' } })
  await $.ui.render({ surface: 'terminal', component: 'TurnDuration', requestId: 'm1', props: { word: 'Baked', durationMs: 3000 } })
  expect(words[0]).toBe('Meditating')
  expect(words[1]).toBe('Creating notes.md')
  expect(words[2]).toBe(pastWord('m1'))
})

test('Russian follows the Russian edition of the game', () => {
  expect(levelOf(0, 'ru').title).toBe('Ученик Каэр Морхена')
  expect(levelOf(10 ** 9, 'ru').title).toBe('Белый Волк')
  expect(questLine('idle', '', 0, null, 'ru')).toEqual({ title: 'Каэр Морхен', objective: 'Дождитесь нового заказа', tone: 'idle' })
  expect(questLine('done', 'Почини вход', 2140, null, 'ru').objective).toBe('Задание выполнено · +2,1k опыта')
  expect(questLine('active', 'x', 0, { key: 'senses', detail: 'router.tsx' }, 'ru').objective).toBe('Ведьмачье чутьё: router.tsx')
  expect(spinnerWord('thinking', null, 'ru')).toBe('Медитация')
  expect(spinnerWord('tool-use', 'quen', 'ru')).toBe('Знак Квен')
  expect([42000, 64000, 120000, 3900000].map(durationRu)).toEqual(['42 с', '1 мин 4 с', '2 мин', '1 ч 5 мин'])
  expect(money(1.87, 'ru')).toBe('1,87')
  expect(clusterSvg({ ...art, lang: 'ru' })).toContain('>1,87<')
})

test('the HUD speaks Russian when its option says so', { options: { language: 'ru' } }, async ($, on) => {
  mock.clock(on)
  const sets: { key: string; value: unknown }[] = []
  on('config.set', (_, e) => {
    sets.push({ key: e.key, value: e.value })
    return { value: e.value }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: 'ok' as never }))
  const words: string[] = []
  on('ui.render', { component: 'Spinner' }, (_, e) => {
    words.push(e.props.word)
    return { type: 'Text', props: {}, children: [e.props.word] } as never
  })

  await $.turn.start({ text: 'почини вход в систему', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  const desktop = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(true) })
  const svgs = await desktop.findAll({ type: 'Svg' })
  expect(String(svgs[0]?.props.alt)).toContain('Жизненная сила 100%')
  expect(String(svgs[1]?.props.alt)).toBe('Почини вход в систему: Игни: npm test')
  expect(String(svgs[1]?.props.source)).toContain('Hoefler Text')

  const terminal = await $.ui.mount({ plugin: 'witcher-hud', surface: 'terminal', component: 'AbovePrompt', props: band(true) })
  expect(await terminal.find({ type: 'Text', text: 'Игни: npm test', in: 'witcher-hud' })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: 'Ур 1', in: 'witcher-hud' })).toBeDefined()

  await $.ui.render({ surface: 'terminal', component: 'Spinner', requestId: 'main', props: { word: 'Sauteing', message: null, suffix: '…', mode: 'tool-use' } })
  expect(words).toEqual(['Знак Игни'])
  const closing = await $.ui.render({ surface: 'terminal', component: 'TurnDuration', requestId: 'm1', props: { word: 'Baked', durationMs: 64000 } })
  expect(JSON.stringify(closing)).toContain(`${pastWord('m1', 'ru')} 1 мин 4 с`)

  const run = (args: string) =>
    $.command.run({ command: 'hud', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
  const stats = await run('stats')
  expect(JSON.stringify(stats)).toContain('Жизненная сила')
  await run('lang en')
  expect(sets).toEqual([{ key: 'witcher-hud.language', value: 'en' }])
})
