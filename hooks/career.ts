// The witcher's career across sessions: the deeds a session adds up, the monsters a failed tool
// turns into, and the trophies the deeds earn. No engine calls here, so tests run it anywhere.
import type { Deeds, MonsterKey, SignKey, TrophyKey } from '../types'
import type { Lang } from './lore'

export const NO_DEEDS: Deeds = {
  xp: 0,
  quests: 0,
  failed: 0,
  nightQuests: 0,
  biggestQuest: 0,
  casts: {},
  met: {},
  slain: {},
  meditations: 0,
  bestStreak: 0,
  longestMs: 0,
  firstAt: 0,
  lastAt: 0,
  days: [],
}

const add = (a: Record<string, number>, b: Record<string, number>) => {
  const out: Record<string, number> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v
  return out
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
const counts = (v: unknown): Record<string, number> => {
  if (v === null || typeof v !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) if (num(n) > 0) out[k] = num(n)
  return out
}

// A record read from the store may come from another version, or be damaged: what is not a deed is none.
export const deedsOf = (v: unknown): Deeds => {
  if (v === null || typeof v !== 'object') return NO_DEEDS
  const r = v as Record<string, unknown>
  return {
    xp: num(r.xp),
    quests: num(r.quests),
    failed: num(r.failed),
    nightQuests: num(r.nightQuests),
    biggestQuest: num(r.biggestQuest),
    casts: counts(r.casts),
    met: counts(r.met),
    slain: counts(r.slain),
    meditations: num(r.meditations),
    bestStreak: num(r.bestStreak),
    longestMs: num(r.longestMs),
    firstAt: num(r.firstAt),
    lastAt: num(r.lastAt),
    days: Array.isArray(r.days) ? r.days.filter((d): d is string => typeof d === 'string').slice(-400) : [],
  }
}

// Two runs of deeds as one: counts add, records keep the best, days join.
export const join = (a: Deeds, b: Deeds): Deeds => {
  const firstAt = a.firstAt === 0 ? b.firstAt : b.firstAt === 0 ? a.firstAt : Math.min(a.firstAt, b.firstAt)
  return {
    xp: a.xp + b.xp,
    quests: a.quests + b.quests,
    failed: a.failed + b.failed,
    nightQuests: a.nightQuests + b.nightQuests,
    biggestQuest: Math.max(a.biggestQuest, b.biggestQuest),
    casts: add(a.casts, b.casts),
    met: add(a.met, b.met),
    slain: add(a.slain, b.slain),
    meditations: a.meditations + b.meditations,
    bestStreak: Math.max(a.bestStreak, b.bestStreak),
    longestMs: Math.max(a.longestMs, b.longestMs),
    firstAt,
    lastAt: Math.max(a.lastAt, b.lastAt),
    days: [...new Set([...a.days, ...b.days])].sort().slice(-400),
  }
}

// One session's run, earlier and now: its span is one stretch, so the longest is measured on the whole.
export const continueRun = (prior: Deeds, now: Deeds): Deeds => {
  const j = join(prior, now)
  return { ...j, longestMs: Math.max(j.longestMs, j.firstAt === 0 ? 0 : j.lastAt - j.firstAt) }
}

const pad = (n: number) => String(n).padStart(2, '0')

// The local day and hour of a moment; a runtime without the local zone reads it as UTC.
export const localOf = (ms: number) => {
  const d = new Date(ms)
  return { day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hour: d.getHours() }
}

export const isNight = (hour: number) => hour < 5

// --- Monsters: a failed tool is a monster met, the next success of its kind slays it. ---

export const MONSTERS: MonsterKey[] = ['drowner', 'griffin', 'harpy', 'wraith', 'ghoul', 'wolf', 'kikimora', 'foglet', 'siren', 'leshy', 'wyvern']

const TOOL_MONSTER: Record<string, MonsterKey> = {
  Edit: 'kikimora',
  MultiEdit: 'kikimora',
  Write: 'kikimora',
  NotebookEdit: 'kikimora',
  Read: 'foglet',
  Grep: 'foglet',
  Glob: 'foglet',
  LS: 'foglet',
  WebFetch: 'siren',
  WebSearch: 'siren',
  Agent: 'leshy',
  Task: 'leshy',
}

// The kind of monster a call would meet: tests breed drowners, builds griffins, linters harpies.
export const monsterOf = (tool: string, input: Record<string, unknown>): MonsterKey => {
  if (tool === 'Bash') {
    const c = typeof input.command === 'string' ? input.command.toLowerCase() : ''
    if (/\b(test|tests|jest|vitest|pytest|mocha|phpunit|rspec|spec)\b/.test(c)) return 'drowner'
    if (/\b(lint|eslint|prettier|ruff|flake8|stylelint|biome|clippy|rubocop|pint)\b/.test(c)) return 'harpy'
    if (/\b(build|tsc|compile|webpack|vite|rollup|esbuild|make|gradle|mvn|xcodebuild|cargo)\b/.test(c)) return 'griffin'
    if (/^\s*(git|gh)\b/.test(c)) return 'wraith'
    if (/\b(install|add|pip|pip3|brew|apt|composer|bundle|npx)\b/.test(c)) return 'ghoul'
    return 'wolf'
  }
  return TOOL_MONSTER[tool] ?? 'wyvern'
}

type MonsterWords = { name: string; lore: string }

export const MONSTER_WORDS: Record<Lang, Record<MonsterKey, MonsterWords>> = {
  en: {
    drowner: { name: 'Drowner', lore: 'Lurks in failing tests. Weak alone, a nuisance in packs.' },
    griffin: { name: 'Griffin', lore: 'Nests in broken builds. Strikes from above, at the worst time.' },
    harpy: { name: 'Harpy', lore: 'Linters’ pests: a flock of small cuts, one after another.' },
    wraith: { name: 'Wraith', lore: 'A git command gone wrong, haunting the history.' },
    ghoul: { name: 'Ghoul', lore: 'Feeds on dependencies that would not install.' },
    wolf: { name: 'Wolf', lore: 'A shell command that bit back. Common on every road.' },
    kikimora: { name: 'Kikimore', lore: 'Hides in strings that will not match. Patient, many-legged.' },
    foglet: { name: 'Foglet', lore: 'Lures searchers into paths that do not exist.' },
    siren: { name: 'Siren', lore: 'Sings from distant sites that never answer.' },
    leshy: { name: 'Leshen', lore: 'A subagent lost in its own forest.' },
    wyvern: { name: 'Wyvern', lore: 'Any other tool that turned on its caster.' },
  },
  ru: {
    drowner: { name: 'Утопец', lore: 'Водится в падающих тестах. Слаб поодиночке, досаждает стаей.' },
    griffin: { name: 'Грифон', lore: 'Гнездится в сломанной сборке. Бьёт сверху и в худший момент.' },
    harpy: { name: 'Гарпия', lore: 'Напасть линтеров: стая мелких царапин, одна за другой.' },
    wraith: { name: 'Призрак', lore: 'Неудачная команда git, что бродит по истории.' },
    ghoul: { name: 'Гуль', lore: 'Питается зависимостями, которые не встали.' },
    wolf: { name: 'Волк', lore: 'Команда оболочки, что огрызнулась. Встречается на любой дороге.' },
    kikimora: { name: 'Кикимора', lore: 'Прячется в строках, которые не совпадают. Терпелива и многонога.' },
    foglet: { name: 'Туманник', lore: 'Заманивает ищущих на пути, которых нет.' },
    siren: { name: 'Сирена', lore: 'Поёт с далёких сайтов, что так и не ответили.' },
    leshy: { name: 'Леший', lore: 'Субагент, заплутавший в собственном лесу.' },
    wyvern: { name: 'Виверна', lore: 'Любой другой инструмент, обратившийся против своего хозяина.' },
  },
}

// --- Trophies: earned once, for good. ---

type TrophyRule = {
  key: TrophyKey
  // How far along the deeds are, and what the trophy asks.
  progress: (d: Deeds, level: number) => [number, number]
}

const casts = (d: Deeds, k: SignKey) => d.casts[k] ?? 0
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)
const kinds = (r: Record<string, number>) => Object.values(r).filter(n => n > 0).length

export const TROPHIES: TrophyRule[] = [
  { key: 'first-contract', progress: d => [d.quests, 1] },
  { key: 'pyromancer', progress: d => [casts(d, 'igni'), 100] },
  { key: 'scribe', progress: d => [casts(d, 'yrden'), 100] },
  { key: 'tracker', progress: d => [casts(d, 'senses'), 300] },
  { key: 'persuader', progress: d => [casts(d, 'axii'), 50] },
  { key: 'force', progress: d => [casts(d, 'aard'), 25] },
  { key: 'unbreakable', progress: d => [casts(d, 'quen'), 100] },
  { key: 'flawless', progress: d => [d.bestStreak, 24] },
  { key: 'night-hunter', progress: d => [d.nightQuests, 1] },
  { key: 'long-road', progress: d => [Math.floor(d.longestMs / 60000), 120] },
  { key: 'griffin-slayer', progress: d => [d.slain.griffin ?? 0, 1] },
  { key: 'bane', progress: d => [sum(d.slain), 10] },
  { key: 'naturalist', progress: d => [kinds(d.met), 6] },
  { key: 'inner-peace', progress: d => [d.meditations, 5] },
  { key: 'epic', progress: d => [d.biggestQuest, 1_000_000] },
  { key: 'veteran', progress: (_, level) => [level, 10] },
  { key: 'path', progress: d => [d.days.length, 7] },
  { key: 'hundred', progress: d => [d.quests, 100] },
]

export const isEarned = (rule: TrophyRule, d: Deeds, level: number) => {
  const [have, need] = rule.progress(d, level)
  return have >= need
}

export const TROPHY_WORDS: Record<Lang, Record<TrophyKey, { name: string; does: string }>> = {
  en: {
    'first-contract': { name: 'First Contract', does: 'Complete a quest' },
    pyromancer: { name: 'Pyromancer', does: 'Cast Igni 100 times' },
    scribe: { name: 'Glyph Scribe', does: 'Inscribe Yrden 100 times' },
    tracker: { name: 'Tracker', does: 'Use Witcher Senses 300 times' },
    persuader: { name: 'Silver Tongue', does: 'Cast Axii 50 times' },
    force: { name: 'Unstoppable Force', does: 'Cast Aard 25 times' },
    unbreakable: { name: 'Unbreakable', does: 'Cast Quen 100 times' },
    flawless: { name: 'Flawless', does: '24 clean casts in a row' },
    'night-hunter': { name: 'Night Hunter', does: 'Complete a quest between midnight and five' },
    'long-road': { name: 'The Long Road', does: 'Hunt for two hours in one session' },
    'griffin-slayer': { name: 'Griffin Slayer', does: 'Slay a griffin: mend a broken build' },
    bane: { name: 'Bane of Monsters', does: 'Slay 10 monsters' },
    naturalist: { name: 'Naturalist', does: 'Meet 6 kinds of monster' },
    'inner-peace': { name: 'Inner Peace', does: 'Meditate 5 times' },
    epic: { name: 'Epic Quest', does: 'Earn 1M XP in one quest' },
    veteran: { name: 'Veteran', does: 'Reach level 10' },
    path: { name: 'The Witcher’s Path', does: 'Hunt on 7 different days' },
    hundred: { name: 'A Hundred Contracts', does: 'Complete 100 quests' },
  },
  ru: {
    'first-contract': { name: 'Первый заказ', does: 'Выполните задание' },
    pyromancer: { name: 'Пиромант', does: 'Сотворите Игни 100 раз' },
    scribe: { name: 'Мастер глифов', does: 'Начертите Ирден 100 раз' },
    tracker: { name: 'Следопыт', does: 'Воспользуйтесь ведьмачьим чутьём 300 раз' },
    persuader: { name: 'Мастер убеждения', does: 'Сотворите Аксий 50 раз' },
    force: { name: 'Неудержимая сила', does: 'Сотворите Аард 25 раз' },
    unbreakable: { name: 'Несокрушимый', does: 'Сотворите Квен 100 раз' },
    flawless: { name: 'Без единой царапины', does: '24 удачных знака подряд' },
    'night-hunter': { name: 'Ночной охотник', does: 'Выполните задание между полуночью и пятью' },
    'long-road': { name: 'Долгий путь', does: 'Охотьтесь два часа за одну сессию' },
    'griffin-slayer': { name: 'Убийца грифона', does: 'Сразите грифона: почините сборку' },
    bane: { name: 'Гроза чудовищ', does: 'Сразите 10 чудовищ' },
    naturalist: { name: 'Знаток бестиария', does: 'Встретьте 6 видов чудовищ' },
    'inner-peace': { name: 'Внутренний покой', does: 'Помедитируйте 5 раз' },
    epic: { name: 'Эпический заказ', does: 'Получите 1M опыта за одно задание' },
    veteran: { name: 'Ветеран', does: 'Достигните 10 уровня' },
    path: { name: 'Путь ведьмака', does: 'Охотьтесь 7 разных дней' },
    hundred: { name: 'Сто заказов', does: 'Выполните 100 заданий' },
  },
}
