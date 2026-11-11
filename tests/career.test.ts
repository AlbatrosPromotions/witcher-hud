import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

type On = Parameters<typeof mock.clock>[0]

// What a compaction runs over and leaves: at least one message.
const TALK = [{ role: 'user' as const, text: 'fix the login redirect bug', toolUses: [] }]

// 07:00 UTC, 9 November 2026: midday in Tashkent, morning in Europe, a day of the hunt.
const T0 = Date.UTC(2026, 10, 9, 7)

const usage = (input: number, output: number) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  model: 'claude-opus-5-5',
})

const band = (isWorking: boolean) => ({
  hasSurvey: false,
  isWorking,
  maxRows: 20,
  bodyColumns: 140,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
})

// The engine beneath the plugin: a clock, a store kept in a map the test reads, a session on show
// on the desktop, a player that records each clip, and tools that fail when `failing` matches.
const world = (on: On, o: { store?: Record<string, unknown>; failing?: RegExp; id?: () => string; muted?: string[] | null; own?: string[]; files?: Record<string, { size: number; base64: string }> } = {}) => {
  const clock = mock.clock(on, { now: T0 })
  // Every kind of sound turned on, as a person may have: `muted: null` leaves the HUD's default.
  const sound = o.muted === null ? {} : { 'sound:v1:muted': o.muted ?? [] }
  const store = new Map<string, unknown>(Object.entries({ ...sound, ...(o.store ?? {}) }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  // A clip given as bytes is recorded as `mime;base64`.
  const sounds: { asset: string; gain: number | undefined }[] = []
  on('audio.play', (_, e) => {
    const clip = e.clip as { asset?: string; base64?: string; mime?: string }
    sounds.push({ asset: clip.asset ?? `${clip.mime};${clip.base64}`, gain: e.gain })
    return { value: undefined }
  })
  // The files on the computer are the ones the test names, by full path, and a home folder.
  const files = new Map(Object.entries(o.files ?? {}))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/Users/geralt' : undefined }))
  on('fs.stat', (_, e) => {
    const file = files.get(e.path)
    return file === undefined ? { deny: `ENOENT: ${e.path}` } : { value: { kind: 'file' as const, size: file.size, mtimeMs: 0, isLink: false, realPath: e.path } }
  })
  on('fs.read', (_, e) => {
    const file = files.get(e.path)
    return file === undefined ? { deny: `ENOENT: ${e.path}` } : { value: { base64: file.base64 } }
  })
  // The folder of one's own clips holds what the test names, and nothing on the machine running it.
  on('fs.list', (_, e) => ({
    value: e.path.endsWith('/sounds/local') ? (o.own ?? []).map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) : [],
  }))
  on('session.id', () => ({ value: o.id?.() ?? 's-now' }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('command.register', () => ({ value: { command: 'hud' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('tool.call', (_, e) =>
    o.failing?.test(String((e as { command?: string }).command ?? '')) ? { result: 'failed' as never, isError: true } : { result: 'ok' as never },
  )
  // Each model request spends what the test queues, or a thousand tokens.
  const spend: [number, number][] = []
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: usage(...(spend.shift() ?? [800, 200])) }
  })
  return { clock, store, toasts, sounds, spend, files }
}

const quest = async ($: Engine, text: string, turnId: string, steps = 1) => {
  await $.turn.start({ text, turnId })
  for (let i = 0; i < steps; i++) for await (const _ of $.turn.step({ turnId, index: i, model: 'claude-opus-5-5', messageCount: 1 }));
}

const complete = ($: Engine, turnId: string, reason: 'answer' | 'error' = 'answer') =>
  $.turn.complete({ answer: 'Done.', durationMs: 4000, isAborted: false, turnId, reason })

const source = async ($: Engine, isWorking = true) => {
  const ui = await $.ui.mount({ plugin: 'witcher-hud', surface: 'desktop', component: 'AbovePrompt', props: band(isWorking) })
  return String((await ui.findAll({ type: 'Svg' })).at(-1)?.props.source)
}

const clips = (w: { sounds: { asset: string }[] }) => w.sounds.map(s => s.asset.replace(/^sounds\/|\.wav$/g, ''))

test('a new chat starts from the bottom, however long the career', async ($, on) => {
  const w = world(on, { store: { 'career:v1:s:old': { xp: 20_400_000, quests: 300 } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const fresh = await source($)
  expect(fresh).toContain('>Kaer Morhen Trainee · Level 1</text>')
  // The ring around the badge is drawn only with some experience in it.
  expect(fresh).not.toContain('pathLength="100"')

  // What this chat earns alone fills the ring, and the levels of the career don't come into it.
  w.spend.push([100_000, 25_000])
  await quest($, 'fix the login redirect bug', 't1')
  expect(await source($)).toContain('stroke-dasharray="50 100"')
  expect(w.toasts).toEqual([])

  // The career is still all there, and says it is the career.
  const stats = await hud($, 'stats')
  expect(stats).toContain('Kaer Morhen Trainee · Level 1')
  expect(stats).toContain('this session +125.0k XP')
  expect(stats).toMatch(/Career: .* · Level 10/)
})

test('a chat picked up again keeps the level it had', async ($, on) => {
  world(on, { store: { 'career:v1:s:s-now': { xp: 1_100_000 }, 'career:v1:s:old': { xp: 5_000_000 } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(await source($)).toContain('· Level 3</text>')
})

test('/clear empties the badge at once, before the next quest', async ($, on) => {
  let id = 's1'
  const w = world(on, { id: () => id })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  w.spend.push([250_000, 100_000])
  await quest($, 'fix the login redirect bug', 't1')
  await complete($, 't1')
  expect(await source($, false)).toContain('· Level 2</text>')

  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  id = 's2'
  const cleared = await source($, false)
  expect(cleared).toContain('· Level 1</text>')
  expect(cleared).not.toContain('pathLength="100"')
  // What the cleared chat earned stays in the career.
  expect(await hud($, 'stats')).toMatch(/Career: .* · Level 2/)
})

test('a turn the engine raised carries on the last quest under its own name', async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  w.spend.push([1000, 500])
  await quest($, 'fix the login redirect bug', 't1')
  await complete($, 't1')
  w.spend.push([1000, 500])
  await quest($, '<task-notification>\n<task-id>abc</task-id>\n<status>completed</status>\n</task-notification>', 't2')
  const shown = await source($)
  expect(shown).toContain('Fix the login redirect bug')
  expect(shown).not.toContain('task-notification')
})

test('the career lasts across sessions: its level, this session’s record, the trophies already won', async ($, on) => {
  const w = world(on, {
    store: {
      'career:v1:s:old': { xp: 5_000_000, quests: 3, met: { drowner: 1 }, slain: { drowner: 1 }, days: ['2026-11-01'], firstAt: 1, lastAt: 2 },
      // This session, as an earlier process of it left it.
      'career:v1:s:s-now': { xp: 1000, quests: 2, firstAt: T0 - 3_600_000, lastAt: T0 - 3_000_000, days: ['2026-11-09'] },
      'career:v1:trophy:first-contract': 5,
    },
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  // The badge counts this chat alone; 5M of experience is level 5 of the career.
  expect(await source($)).toContain('>Kaer Morhen Trainee · Level 1</text>')
  expect(await hud($, 'stats')).toContain('Career: Novice Witcher · Level 5')

  w.spend.push([2000, 1000])
  await quest($, 'fix the login redirect bug', 't1')
  await complete($, 't1')
  expect(w.store.get('career:v1:s:s-now')).toMatchObject({ xp: 4000, quests: 3, days: ['2026-11-09'] })
  // The earlier process's start counts: this session has run an hour so far.
  expect((w.store.get('career:v1:s:s-now') as { longestMs: number }).longestMs).toBe(3_600_000)
  expect(w.store.get('career:v1:s:old')).toMatchObject({ xp: 5_000_000, quests: 3 })
  // The first contract was won before: no toast for it again.
  expect(w.toasts).toEqual([])
})

test('a quest completed is played out, then the trophy it earns, each with its sound', async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  w.spend.push([30000, 18200])
  await quest($, 'fix the login redirect bug', 't1')
  await complete($, 't1')

  expect(w.toasts).toEqual(['Trophy: First Contract · Complete a quest'])
  expect(w.store.get('career:v1:trophy:first-contract')).toBe(T0)
  const done = await source($, false)
  // The quest's banner shows now, its experience flown to the badge; the trophy's waits its turn.
  expect(done).toContain('QUEST COMPLETED')
  expect(done).toContain('+48.2k XP')
  expect(done).toContain('TROPHY')
  expect(done).toContain('First Contract · Complete a quest')
  expect(clips(w)).toEqual(['quest-done'])
  await w.clock.advance(2800)
  expect(clips(w)).toEqual(['quest-done', 'trophy'])

  // Long after, both are gone, and the tracker reads as before.
  await w.clock.advance(5000)
  const after = await source($, false)
  expect(after).not.toContain('QUEST COMPLETED')
  expect(after).toContain('Quest completed · +48.2k XP')

  // Failed quests play their own banner and earn nothing.
  await quest($, 'deploy to production', 't2')
  await complete($, 't2', 'error')
  expect(await source($, false)).toContain('QUEST FAILED')
  expect(w.toasts.length).toBe(1)
})

test('a failed tool meets a monster; the next of its kind to land slays it', async ($, on) => {
  const w = world(on, { failing: /broken/ })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await quest($, 'fix the login redirect bug', 't1')

  await $.tool.call({ tool: 'Bash', command: 'npm test -- broken' })
  const met = await source($)
  expect(met).toContain('DROWNER')
  expect(met).toContain('A monster appears · npm test -- broken')
  expect(clips(w)).toEqual(['igni', 'monster'])
  // The same monster again, while it is hunted, is no new encounter.
  await w.clock.advance(1000)
  await $.tool.call({ tool: 'Bash', command: 'npm test -- broken again' })
  expect(clips(w)).toEqual(['igni', 'monster'])

  await w.clock.advance(3000)
  await $.tool.call({ tool: 'Bash', command: 'npm test -- auth' })
  const slain = await source($)
  expect(slain).toContain('CONTRACT COMPLETED')
  expect(slain).toContain('Drowner slain · a new bestiary entry')
  expect(clips(w)).toEqual(['igni', 'monster', 'igni', 'slain'])

  // Another kind of call meets its own monster.
  await w.clock.advance(3000)
  await $.tool.call({ tool: 'Bash', command: 'npx tsc -p broken' })
  expect(await source($)).toContain('GRIFFIN')

  await complete($, 't1')
  expect(w.store.get('career:v1:s:s-now')).toMatchObject({ met: { drowner: 1, griffin: 1 }, slain: { drowner: 1 } })
})

test('sounds skip a burst of casts, follow the option, and keep quiet without a surface', async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await quest($, 'fix the login redirect bug', 't1')
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await w.clock.advance(1000)
  // The same sign within 2.5s is not heard again; another sign is, once 0.8s have passed.
  await $.tool.call({ tool: 'Bash', command: 'ls -la' })
  await w.clock.advance(500)
  await $.tool.call({ tool: 'Read', file_path: '/src/a.ts' })
  await w.clock.advance(300)
  await $.tool.call({ tool: 'Edit', file_path: '/src/a.ts', old_string: 'a', new_string: 'b' })
  expect(clips(w)).toEqual(['igni', 'senses'])
  // Signs are a little softer than the moments.
  expect(w.sounds[0]?.gain).toBe(0.8)
})

test('a quiet HUD plays softer, and one turned off plays nothing', { options: { sound: 'quiet' } }, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await quest($, 'fix the login redirect bug', 't1')
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await complete($, 't1')
  expect(w.sounds.map(s => s.gain)).toEqual([0.35 * 0.8, 0.35])
})

test("a clip of one's own in sounds/local plays in place of the HUD's", async ($, on) => {
  const w = world(on, { muted: null, own: ['quest-done.mp3', 'notes.txt', 'level-up.ogg', 'igni'] })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await quest($, 'fix the login redirect bug', 't1')
  await complete($, 't1')
  await w.clock.advance(6000)
  expect(w.sounds.map(s => s.asset)).toEqual(['sounds/local/quest-done.mp3'])
})

const hud = async ($: Engine, args: string) =>
  String(
    ((await $.command.run({ command: 'hud', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })) as { text?: string }).text,
  )

test('a file chosen with /hud sound file plays for its sound in every session, until reset', async ($, on) => {
  const w = world(on, { muted: null, files: { '/Users/geralt/Music/done.mp3': { size: 60_000, base64: 'SUQz' } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(await hud($, 'sound file')).toContain('Every sound plays the HUD’s own clip.')

  // Chosen by a path from the home folder: kept by its full path, and played once to hear it.
  expect(await hud($, 'sound file quest-done ~/Music/done.mp3')).toBe('quest-done now plays done.mp3.')
  expect(w.store.get('sound:v1:files')).toEqual({ 'quest-done': '/Users/geralt/Music/done.mp3' })
  await w.clock.advance(10)
  expect(w.sounds.map(s => s.asset)).toEqual(['audio/mpeg;SUQz'])
  expect(await hud($, 'sound file')).toContain('quest-done ← /Users/geralt/Music/done.mp3')

  // A quest's end plays it.
  await quest($, 'fix the login redirect bug', 't1')
  await complete($, 't1')
  await w.clock.advance(6000)
  expect(w.sounds.map(s => s.asset)).toEqual(['audio/mpeg;SUQz', 'audio/mpeg;SUQz'])

  // Put back: the HUD's clip again.
  expect(await hud($, 'sound file quest-done reset')).toBe('quest-done plays the HUD’s own clip again.')
  expect(w.store.get('sound:v1:files')).toEqual({})
  await quest($, 'add the logout button', 't2')
  await complete($, 't2')
  await w.clock.advance(6000)
  expect(w.sounds.at(-1)?.asset).toBe('sounds/quest-done.wav')
})

test('a file chosen in an earlier session plays, and one gone since gives way to the HUD’s clip', async ($, on) => {
  const w = world(on, { muted: null, store: { 'sound:v1:files': { 'quest-done': '/Users/geralt/Music/gone.mp3', 'level-up': '/Users/geralt/Music/up.wav', nonsense: '/x.mp3' } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  w.files.set('/Users/geralt/Music/up.wav', { size: 1000, base64: 'UklG' })
  await quest($, 'fix the login redirect bug', 't1')
  await complete($, 't1')
  await w.clock.advance(6000)
  expect(w.sounds.map(s => s.asset)).toEqual(['sounds/quest-done.wav'])
  const text = await hud($, 'sound file')
  expect(text).toContain('level-up ← /Users/geralt/Music/up.wav')
  expect(text).not.toContain('nonsense')
})

test('/hud sound file refuses a file that is missing, too big, not audio, or for no sound', { options: { language: 'ru' } }, async ($, on) => {
  const w = world(on, { files: { '/Users/geralt/big.wav': { size: 5 * 1024 * 1024, base64: '' }, '/Users/geralt/notes.txt': { size: 10, base64: '' } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(await hud($, 'sound file quest-done ~/nowhere.mp3')).toBe('Файл не найден: ~/nowhere.mp3.')
  expect(await hud($, 'sound file quest-done /Users/geralt/big.wav')).toBe('Файл больше 4 МБ: выберите клип короче.')
  expect(await hud($, 'sound file quest-done /Users/geralt/notes.txt')).toBe('Выберите файл MP3, WAV, M4A или AIFF.')
  expect(await hud($, 'sound file dragon /Users/geralt/big.wav')).toContain('Звуки: igni|aard|quen|yrden|axii|senses|quest-done|')
  expect(w.store.has('sound:v1:files')).toBe(false)
  expect(w.sounds).toEqual([])
})

test('a HUD with its sound off plays nothing', { options: { sound: 'off' } }, async ($, on) => {
  const w = world(on)
  await quest($, 'fix the login redirect bug', 't1')
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await complete($, 't1')
  expect(w.sounds).toEqual([])
})

test('a headless run plays no sound and keeps no record', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const sounds: unknown[] = []
  const sets: string[] = []
  on('audio.play', (_, e) => {
    sounds.push(e)
    return { value: undefined }
  })
  on('store.set', (_, e) => {
    sets.push(e.key)
    return { value: undefined }
  })
  on('session.surfaces', () => ({ value: [] }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: 'ok' as never }))
  await $.turn.start({ text: 'summarise the log', turnId: 't1' })
  await $.tool.call({ tool: 'Read', file_path: '/var/log/a.log' })
  await $.turn.complete({ answer: 'Done.', durationMs: 100, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(5000)
  expect(sounds).toEqual([])
  expect(sets.filter(k => k.startsWith('career:v1:s:'))).toEqual([])
})

test('a level gained in the chat is toasted, played out and heard', async ($, on) => {
  const w = world(on, { store: { 'career:v1:s:s-now': { xp: 249_000 } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(await source($)).toContain('>Kaer Morhen Trainee · Level 1</text>')
  w.spend.push([1500, 500])
  await quest($, 'fix the login redirect bug', 't1')
  expect(w.toasts).toEqual(['Level up! Ability point gained · Level 2: Kaer Morhen Trainee'])
  const leveled = await source($)
  expect(leveled).toContain('LEVEL 2')
  expect(leveled).toContain('Kaer Morhen Trainee · ability point gained')
  expect(clips(w)).toEqual(['level-up'])
})

test('a compaction is a meditation by the fire; the vitality it restores refills the bar', async ($, on) => {
  const w = world(on)
  let during = ''
  on('session.compact', async () => {
    during = await source($)
    return { messages: TALK }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await quest($, 'fix the login redirect bug', 't1')

  // Low vitality is a danger: a toast, a sound, and the HUD's heartbeat.
  await $.session.measure({ context: { window: 200000, tokens: 150000, percent: 75 }, rateLimits: [], changed: ['context'] })
  await $.session.measure({ context: { window: 200000, tokens: 170000, percent: 85 }, rateLimits: [], changed: ['context'] })
  expect(w.toasts).toEqual(['Vitality low: 15%. Meditate to recover: /compact'])
  expect(await source($)).toContain('class="tremble"')

  await w.clock.advance(2000)
  await $.session.compact({ trigger: 'manual', messages: TALK })
  expect(during).toContain('MEDITATION')
  expect(during).toContain('Time flows by the fire… the journal is condensed')
  expect(clips(w)).toEqual(['danger', 'meditate'])
  expect(await source($)).not.toContain('Time flows by the fire')

  await w.clock.advance(2000)
  await $.session.measure({ context: { window: 200000, tokens: 60000, percent: 30 }, rateLimits: [], changed: ['context'] })
  expect(w.toasts.at(-1)).toBe('Meditation complete. Vitality restored to 70%')
  const restored = await source($)
  expect(restored).toContain('MEDITATION COMPLETE')
  expect(restored).toContain('class="fxr"')
  expect(clips(w)).toEqual(['danger', 'meditate', 'restored'])

  // A precompute runs unseen: the witcher does not sit down for it.
  during = ''
  await w.clock.advance(5000)
  await $.session.compact({ trigger: 'precompute', messages: TALK })
  expect(during).not.toContain('MEDITATION')
  expect(clips(w)).toEqual(['danger', 'meditate', 'restored'])
  await complete($, 't1')
  expect(w.store.get('career:v1:s:s-now')).toMatchObject({ meditations: 1 })
})

test('the journal lists the quests, the bestiary, the trophies and the signs', async ($, on) => {
  const w = world(on, { failing: /broken/ })
  const sets: { key: string; value: unknown }[] = []
  on('config.set', (_, e) => {
    sets.push({ key: e.key, value: e.value })
    return { value: e.value }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await quest($, 'fix the login redirect bug', 't1')
  await $.tool.call({ tool: 'Bash', command: 'npm test -- broken' })
  await $.tool.call({ tool: 'Read', file_path: '/src/a.ts' })
  await complete($, 't1')
  await quest($, 'add a dark theme', 't2')
  // A subagent's prompt is part of the quest at hand, not a quest of its own.
  await $.turn.start({ text: 'explore the theme files', turnId: 't3', agentId: 'a1' } as never)
  expect(await source($)).toContain('Add a dark theme')

  const run = (args: string) =>
    $.command.run({ command: 'hud', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
  expect(JSON.stringify(await run('journal'))).toContain('Journal opened.')
  const pane = await $.ui.mount({
    plugin: 'witcher-hud',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'journal',
    props: { title: 'Witcher’s Journal', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  })
  expect(await pane.find({ type: 'Text', text: '◈ Kaer Morhen Trainee · Level 1' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Fix the login redirect bug' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Add a dark theme' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '☒ Drowner' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '· met 1 · slain 0' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '· hunting' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '☐ Griffin' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Trophies 1 of 18' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'First Contract' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Pyromancer · Cast Igni 100 times · 1/100' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Igni 1' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Witcher Senses 1' })).toBeDefined()

  const stats = JSON.stringify(await run('stats'))
  expect(stats).toContain('1 quests · 0 monsters slain · 2 signs · 1 days on the Path')
  expect(stats).toContain('Trophies 1 of 18')
  expect(JSON.stringify(await run('sound quiet'))).toContain('HUD sound quiet.')
  expect(sets).toEqual([{ key: 'witcher-hud.sound', value: 'quiet' }])
  expect(w.toasts).toEqual(['Trophy: First Contract · Complete a quest'])
})

test('after a /clear the process hunts on as another session, its record apart', async ($, on) => {
  let id = 's1'
  const w = world(on, { id: () => id })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  w.spend.push([2000, 1000])
  await quest($, 'fix the login redirect bug', 't1')
  await complete($, 't1')
  expect(w.store.get('career:v1:s:s1')).toMatchObject({ xp: 3000, quests: 1 })

  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  id = 's2'
  w.spend.push([600, 400])
  await quest($, 'add a dark theme', 't2')
  await complete($, 't2')
  expect(w.store.get('career:v1:s:s1')).toMatchObject({ xp: 3000, quests: 1 })
  expect(w.store.get('career:v1:s:s2')).toMatchObject({ xp: 1000, quests: 1 })
  // The journal starts over for the new session.
  const pane = await $.ui.mount({
    plugin: 'witcher-hud',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'journal',
    props: { title: 'Witcher’s Journal', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  })
  expect(await pane.find({ type: 'Text', text: 'Fix the login redirect bug' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: 'Add a dark theme' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '2 quests · 0 monsters slain · 0 signs · 1 days on the Path' })).toBeDefined()
})

test('the oldest records are rolled into one once there are many', async ($, on) => {
  const many: Record<string, unknown> = {}
  for (let i = 0; i < 401; i++) many[`career:v1:s:old-${i}`] = { xp: 1000, quests: 1, lastAt: i + 1 }
  const w = world(on, { store: many })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const runs = [...w.store.keys()].filter(k => k.startsWith('career:v1:s:'))
  expect(runs.length).toBe(100)
  expect(runs).toContain('career:v1:s:old-400')
  expect(runs).not.toContain('career:v1:s:old-0')
  expect(w.store.get('career:v1:base')).toMatchObject({ xp: 301_000, quests: 301 })
  // Nothing is lost: 401 thousand experience, level 2 of the career.
  expect(await hud($, 'stats')).toContain('Career: Kaer Morhen Trainee · Level 2')
})

test('moments queued at once are drawn two at a time, the Svg keeping every band', async ($, on) => {
  const w = world(on, {
    store: { 'career:v1:s:old': { xp: 1000, casts: { igni: 100, yrden: 100, senses: 300, axii: 50, aard: 25, quen: 100 } } },
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await quest($, 'fix the login redirect bug', 't1')
  // The widths where a band starts: the Svg cut down to fit would lose every other one.
  const starts = (svg: string) => new Set(svg.match(/@media [^{]*/g) ?? [])
  const everyBand = starts(await source($))
  // One cast more earns the six sign trophies at once.
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(w.toasts.length).toBe(6)
  const now = await source($)
  expect(now).toContain('Pyromancer · Cast Igni 100 times')
  expect(now).toContain('Glyph Scribe · Inscribe Yrden 100 times')
  expect(now).not.toContain('Tracker · Use Witcher Senses 300 times')
  expect(now.length).toBeLessThanOrEqual(131072)
  expect([...everyBand].filter(b => !starts(now).has(b))).toEqual([])
  expect(everyBand.size).toBeGreaterThan(10)

  // The first played out, the window moves on: the next one is drawn before its turn.
  await w.clock.advance(3400 + 50)
  const next = await source($)
  expect(next).not.toContain('Pyromancer · Cast Igni 100 times')
  expect(next).toContain('Glyph Scribe · Inscribe Yrden 100 times')
  expect(next).toContain('Tracker · Use Witcher Senses 300 times')
  expect(clips(w).filter(c => c === 'trophy').length).toBe(2)
})

test('each kind of sound turns off on its own, kept for the next session; the settings pane turns them', async ($, on) => {
  // What an earlier session turned off, and a name no version knows, which is let go.
  const w = world(on, { store: { 'sound:v1:muted': ['quests', 'thunder'] }, failing: /broken/ })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const run = async (args: string) =>
    String(
      ((await $.command.run({ command: 'hud', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })) as { text?: string })
        .text,
    )

  expect(await run('sound igni off')).toBe('Igni: sound off.')
  expect(w.store.get('sound:v1:muted')).toEqual(['quests', 'igni'])
  await quest($, 'fix the login redirect bug', 't1')
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await w.clock.advance(3000)
  await $.tool.call({ tool: 'Read', file_path: '/src/a.ts' })
  await complete($, 't1')
  // The trophy plays out after the quest's banner.
  await w.clock.advance(3000)
  // Igni and the quest's own sound are off; Witcher Senses and the trophy still sound.
  expect(clips(w)).toEqual(['senses', 'trophy'])

  // Unknown words get the settings as text, and how to use them.
  const text = await run('sound thunder off')
  expect(text).toContain('✗ Quests · off')
  expect(text).toContain('♪ Signs · on')
  expect(text).toContain('✗ Igni')
  expect(text).toContain('/hud sound <signs|quests|levels|monsters|trophies|meditation|danger|igni|aard|quen|yrden|axii|senses> on|off')
  expect(await run('sound')).toBe('Sound settings opened.')

  for (const surface of ['desktop', 'terminal'] as const) {
    const pane = await $.ui.mount({
      plugin: 'witcher-hud',
      surface,
      component: 'Pane',
      requestId: 'sound',
      props: { title: 'Sound', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
    })
    expect(await pane.find({ type: 'Text', text: 'Quests' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: '· vitality down to 20%' })).toBeDefined()
    expect((await pane.find({ key: 'toggle:quests' }))?.text).toContain('Turn on')
    expect((await pane.find({ key: 'toggle:monsters' }))?.text).toContain('Turn off')
    expect((await pane.find({ key: 'toggle:igni' }))?.text).toContain('✗ Igni')
    expect((await pane.find({ key: 'volume:on' }))?.text).toContain('Full')
    await pane.unmount()
  }

  const pane = await $.ui.mount({
    plugin: 'witcher-hud',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'sound',
    props: { title: 'Sound', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  })
  await pane.press({ key: 'toggle:quests' })
  await pane.press({ key: 'toggle:monsters' })
  await pane.press({ key: 'toggle:igni' })
  expect(w.store.get('sound:v1:muted')).toEqual(['monsters'])
  expect((await pane.find({ key: 'toggle:quests' }))?.text).toContain('Turn off')
  expect((await pane.find({ key: 'toggle:monsters' }))?.text).toContain('Turn on')
  // A sample plays when asked, though its kind is off.
  w.sounds.length = 0
  await pane.press({ key: 'listen:monsters' })
  expect(clips(w)).toEqual(['monster'])
  await pane.unmount()

  // A tool that fails meets a monster in silence now; Igni and the quest sound again.
  w.sounds.length = 0
  await w.clock.advance(3000)
  await quest($, 'add a dark theme', 't2')
  await $.tool.call({ tool: 'Bash', command: 'npm test -- broken' })
  expect(await source($)).toMatch(/drowner/i)
  await complete($, 't2')
  await w.clock.advance(3000)
  expect(clips(w)).toEqual(['igni', 'quest-done'])
})

test('by default only a quest’s end sounds, until the person turns another kind on', async ($, on) => {
  const w = world(on, { muted: null, failing: /broken/ })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await quest($, 'fix the login redirect bug', 't1')
  await $.tool.call({ tool: 'Bash', command: 'npm test -- broken' })
  await w.clock.advance(3000)
  await $.tool.call({ tool: 'Read', file_path: '/src/a.ts' })
  await complete($, 't1')
  await w.clock.advance(6000)
  // No sign, no monster, no trophy: the quest's end alone.
  expect(clips(w)).toEqual(['quest-done'])
  expect(w.store.has('sound:v1:muted')).toBe(false)

  const run = async (args: string) =>
    String(
      ((await $.command.run({ command: 'hud', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })) as { text?: string })
        .text,
    )
  const text = await run('sound ?')
  expect(text).toContain('♪ Quests · on')
  expect(text).toContain('✗ Signs · off')
  expect(text).toContain('✗ Danger · off')
  // Turning one on keeps the rest as they were, from then on in the store.
  expect(await run('sound trophies on')).toBe('Trophies: sound on.')
  expect(w.store.get('sound:v1:muted')).toEqual(['signs', 'levels', 'monsters', 'meditation', 'danger'])
})

test('the sound settings speak Russian', { options: { language: 'ru' } }, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const run = async (args: string) =>
    String(
      ((await $.command.run({ command: 'hud', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })) as { text?: string })
        .text,
    )
  expect(await run('sound senses off')).toBe('Ведьмачье чутьё: звук выключен.')
  expect(await run('sound monsters off')).toBe('Чудовища: звук выключен.')
  expect(await run('sound')).toBe('Настройки звука открыты.')
  const text = await run('sound ?')
  expect(text).toContain('✗ Чудовища · выкл.')
  expect(text).toContain('♪ Знаки · вкл.')
  expect(text).toContain('✗ Ведьмачье чутьё')
  expect(w.store.get('sound:v1:muted')).toEqual(['senses', 'monsters'])
})
