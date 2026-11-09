import { expect, mock, test } from 'claude-code/testing'

import { hudSvg } from '../hooks/art'
import type { HudArt } from '../hooks/art'
import { MAX_W, bands } from '../hooks/layout'
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

const B = bands({ hasStamina: true, crowns: '1.87' })

const art: HudArt = {
  theme: 'auto',
  sign: null,
  isWorking: false,
  isCasting: false,
  vitality: 66,
  ghostFrom: null,
  stamina: 78,
  adrenaline: 2,
  level: 5,
  xpFraction: 0.3,
  isLevelUp: false,
  tips: { vitality: 'Vitality 66%', stamina: 'Stamina', adrenaline: 'Adrenaline', level: 'Level' },
  line: questLine('idle', '', 0, null),
  cast: null,
  crowns: '1.87',
  sheet: { title: 'Kaer Morhen Trainee · Level 5', stats: 'Experience 1.2k / 5k' },
}

const draw = (over: Partial<HudArt> = {}) => hudSvg(B, { ...art, ...over })

test('levels climb on a square curve, and the titles with them', () => {
  expect(levelOf(0)).toEqual({ level: 1, title: 'Kaer Morhen Trainee', into: 0, need: 250000 })
  expect(levelOf(249999).level).toBe(1)
  expect(levelOf(250000)).toEqual({ level: 2, title: 'Kaer Morhen Trainee', into: 0, need: 750000 })
  expect(levelOf(1_000_000)).toEqual({ level: 3, title: 'Survivor of the Grasses', into: 0, need: 1250000 })
  // Level 10 at 20M, a title every few levels, the last one at 40.
  expect(levelOf(20_250_000)).toMatchObject({ level: 10, title: 'Monster Slayer' })
  expect(levelOf(10 ** 9)).toMatchObject({ level: 64, title: 'Grandmaster of the Wolf' })
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

test('the desktop art animates what moves, and only once a sign is cast', () => {
  expect(draw()).not.toContain('class="shake"')
  expect(draw()).not.toContain('class="aura"')
  expect(draw({ isWorking: true })).toContain('class="aura"')
  expect(draw({ isWorking: true, isCasting: true })).toContain('class="shake"')
  expect(draw({ vitality: 41, ghostFrom: 66 })).toContain('class="ghost"')
  expect(draw({ vitality: 12 })).toContain('class="low"')
  expect(draw({ vitality: 12 })).toContain('fill:var(--low)')
  // A reduced-motion setting stills it all.
  expect(draw()).toContain('@media (prefers-reduced-motion:reduce){*{animation:none!important}')
  expect(draw({ line: questLine('active', 'a <b> & "c"', 0, null), crowns: null })).toContain('a &lt;b&gt; &amp; &quot;c&quot;')
})

test('the art follows the app, or keeps the theme it is given', () => {
  const auto = draw()
  expect(auto).toContain('@media (prefers-color-scheme:light){svg{--plate-top:#FBF6EA')
  const light = draw({ theme: 'light' })
  expect(light).toContain('svg{--plate-top:#FBF6EA')
  expect(light).not.toContain('prefers-color-scheme')
  expect(draw({ theme: 'dark' })).not.toContain('#FBF6EA')
  // The title face is embedded, so the HUD reads the same on every machine.
  expect(auto).toContain("@font-face{font-family:'WHud Title';src:url(data:font/woff2;base64,")
  // Each bar and mark answers the pointer with its numbers.
  expect(auto).toContain('<title>Vitality 66%</title>')
  const cast = draw({ line: questLine('active', 'Fix it', 0, { key: 'igni', detail: 'npm test' }), cast: { key: 'igni', name: 'Igni', detail: 'npm test' } })
  expect(cast).toContain('style="fill:var(--sign-igni)"')
  expect(cast).toContain('>IGNI</text>')
  expect(cast).toContain(".tm{font-family:'SF Mono', Menlo, ui-monospace, monospace}")
  expect(cast).toContain('<text class="tm"')
  // The pointer on the character shows the sheet in the quest's place, inside the one drawing.
  expect(cast).toContain('.char:hover~.right .sheet{display:inline}.char:hover~.right .quest{display:none}')
  expect(cast).toContain('>Kaer Morhen Trainee · Level 5</text>')
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
  // A few thousand tokens are far from the first level up.
  expect(toasts).toEqual([])

  const desktop = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(true) })
  const svgs = await desktop.findAll({ type: 'Svg' })
  // The newest frame is the last; one drawing: the character, the quest, and the sheet the pointer on the character shows in its place.
  expect(svgs.length).toBe(1)
  expect(String(svgs.at(-1)?.props.alt)).toContain('adrenaline 1 of 3')
  expect(svgs.at(-1)?.props.isInteractive).toBe(true)
  expect(String(svgs.at(-1)?.props.alt)).toContain('Fix the login redirect bug: Igni: npm test -- auth')
  expect(String(svgs.at(-1)?.props.source)).toContain('>Kaer Morhen Trainee · Level 1</text>')
  // The sign was just cast: the medallion shakes once.
  expect(String(svgs.at(-1)?.props.source)).toContain('class="shake"')

  const terminal = await $.ui.mount({ plugin: 'witcher-hud', surface: 'terminal', component: 'AbovePrompt', props: band(true) })
  expect(await terminal.find({ type: 'Text', text: 'Igni: npm test -- auth', in: 'witcher-hud' })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: 'Fix the login redirect bug', in: 'witcher-hud' })).toBeDefined()

  // A failed tool is a hit: the adrenaline is gone.
  await $.tool.call({ tool: 'Bash', command: 'exit 1' })
  // Context spent drains the vitality bar, and the lost stretch fades out.
  await $.session.measure({ context: { window: 200000, tokens: 80000, percent: 40 }, rateLimits: [], cost: { usd: 0.5 }, changed: ['context'] })
  const hit = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(true) })
  const hitSvg = await hit.findAll({ type: 'Svg' })
  expect(String(hitSvg.at(-1)?.props.alt)).toContain('adrenaline 0 of 3')

  await $.session.measure({ context: { window: 200000, tokens: 150000, percent: 75 }, rateLimits: [], cost: { usd: 0.9 }, changed: ['context'] })
  const drained = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(true) })
  expect(String((await drained.findAll({ type: 'Svg' })).at(-1)?.props.source)).toContain('class="ghost"')
  await clock.advance(2000)
  const settled = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(true) })
  const settledSource = String((await settled.findAll({ type: 'Svg' })).at(-1)?.props.source)
  expect(settledSource).not.toContain('class="ghost"')
  // Long after the cast, the medallion only breathes.
  expect(settledSource).not.toContain('class="shake"')
  expect(settledSource).toContain('class="aura"')

  await $.turn.complete({ answer: 'Done.', durationMs: 4000, isAborted: false, turnId: 't1', reason: 'answer' })
  const done = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(false) })
  const doneSvgs = await done.findAll({ type: 'Svg' })
  expect(String(doneSvgs.at(-1)?.props.alt)).toContain(', Fix the login redirect bug: Quest completed · +5.3k XP')
  expect(String(doneSvgs.at(-1)?.props.source)).not.toContain('class="aura"')
})

// A redraw must not move or drop part of the HUD: the band's reported columns (which may pass
// through 0 or a stale count as the app lays out) never reach the drawing, and the tree keeps its shape.
test('the desktop band is one drawing, its frame asking for the full width', async ($, on) => {
  mock.clock(on)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: 'ok' as never }))
  await $.turn.start({ text: 'fix the login redirect bug', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  const drawn = []
  for (const columns of [140, 0, 37, 90, 400]) {
    const desktop = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(true, columns) })
    const svgs = await desktop.findAll({ type: 'Svg' })
    expect(svgs.length).toBe(1)
    // A frame given no width is the browser's 300px, the narrowest tier: the frame always asks for
    // MAX_W, and the band's max-width holds it to the band.
    expect(svgs[0]?.props.width).toBe(MAX_W)
    expect(svgs[0]?.props.isInteractive).toBe(true)
    drawn.push(JSON.stringify(svgs[0]?.props))
  }
  expect(new Set(drawn).size).toBe(1)
})

// An update must not blank the HUD: the frame on show is a frame the desktop keeps (same props, same
// place in the tree), and the new one lies over it until it has loaded, then takes its place.
test('an update lays the new frame over the one on show, which stays untouched', async ($, on) => {
  const clock = mock.clock(on, { now: 5000 })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: 'ok' as never }))
  await $.turn.start({ text: 'fix the login redirect bug', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  const frames = async () => {
    const desktop = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(true) })
    const boxes = await desktop.findAll({ type: 'Box' })
    const svgs = await desktop.findAll({ type: 'Svg' })
    return { svgs: svgs.map(n => n.props), absolute: boxes.filter(n => n.props.position === 'absolute').length }
  }
  const one = await frames()
  expect(one.svgs.length).toBe(1)
  expect(one.absolute).toBe(0)

  await clock.advance(500)
  await $.tool.call({ tool: 'Read', file_path: '/src/alpha.ts' })
  const two = await frames()
  expect(two.svgs.length).toBe(2)
  expect(two.svgs[0]).toEqual(one.svgs[0])
  expect(two.absolute).toBe(1)
  expect(String(two.svgs[1]?.source)).toContain('alpha.ts')
  // The new frame takes up the old one's motions where they stand, not from their start.
  expect(String(two.svgs[1]?.source)).toMatch(/\.aura\{animation-delay:-\d+ms\}/)
  expect(String(two.svgs[1]?.source)).toContain('.shake{animation-delay:-0ms}')

  // A newer update while that frame still loads replaces it, over the same frame on show.
  await clock.advance(100)
  await $.tool.call({ tool: 'Read', file_path: '/src/beta.ts' })
  const three = await frames()
  expect(three.svgs.length).toBe(2)
  expect(three.svgs[0]).toEqual(one.svgs[0])
  expect(String(three.svgs[1]?.source)).toContain('beta.ts')

  // Once it has loaded, a redraw takes the old frame away and keeps the new one as it is.
  await clock.advance(1000)
  const settled = await frames()
  expect(settled.svgs).toEqual([three.svgs[1]])
  expect(settled.absolute).toBe(0)
  // A redraw with nothing new changes nothing.
  expect((await frames()).svgs).toEqual(settled.svgs)

  // The next update lays its frame over that one.
  await $.tool.call({ tool: 'Read', file_path: '/src/gamma.ts' })
  const four = await frames()
  expect(four.svgs[0]).toEqual(three.svgs[1])
  expect(String(four.svgs[1]?.source)).toContain('gamma.ts')
})

test('the spinner and the closing line are reworded', async ($, on) => {
  const words: string[] = []
  on('ui.render', { component: 'Spinner' }, (_, e) => {
    words.push(e.props.word)
    return { type: 'Text', props: {}, children: [e.props.word] } as never
  })
  on('ui.render', { component: 'TurnDuration' }, (_, e) => {
    words.push(e.props.word)
    return { type: 'Text', props: {}, children: [e.props.word] } as never
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
  expect(levelOf(10 ** 9, 'ru').title).toBe('Гроссмейстер Школы Волка')
  expect(questLine('idle', '', 0, null, 'ru')).toEqual({ title: 'Каэр Морхен', objective: 'Дождитесь нового заказа', tone: 'idle' })
  expect(questLine('done', 'Почини вход', 2140, null, 'ru').objective).toBe('Задание выполнено · +2,1k опыта')
  expect(questLine('active', 'x', 0, { key: 'senses', detail: 'router.tsx' }, 'ru').objective).toBe('Ведьмачье чутьё: router.tsx')
  expect(spinnerWord('thinking', null, 'ru')).toBe('Медитация')
  expect(spinnerWord('tool-use', 'quen', 'ru')).toBe('Знак Квен')
  expect([42000, 64000, 120000, 3900000].map(durationRu)).toEqual(['42 с', '1 мин 4 с', '2 мин', '1 ч 5 мин'])
  expect(money(1.87, 'ru')).toBe('1,87')
  expect(hudSvg(bands({ hasStamina: true, crowns: '1,87' }), { ...art, line: questLine('idle', '', 0, null, 'ru'), crowns: money(1.87, 'ru') })).toContain('>1,87<')
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
  expect(String(svgs[0]?.props.alt)).toContain('Почини вход в систему: Игни: npm test')
  // The embedded title face carries Cyrillic.
  expect(String(svgs[0]?.props.source)).toContain(".tt{font-family:'WHud Title'")
  expect(String(svgs[0]?.props.source)).toContain('>ИГНИ</text>')

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
  const themed = await run('theme light')
  expect(JSON.stringify(themed)).toContain('Тема HUD: светлая, пергамент.')
  expect(sets).toEqual([
    { key: 'witcher-hud.language', value: 'en' },
    { key: 'witcher-hud.theme', value: 'light' },
  ])
})
