// The game's words and numbers: no engine calls here, so tests and previews can run it anywhere.
import type { QuestStatus, SignKey, Totals } from '../types'

export const GOLD = '#C9A55C'
export const GOLD_HI = '#F1D99A'
export const GOLD_LO = '#7E5F2A'
export const PARCHMENT = '#E6DCC3'
export const ASH = '#8F8778'
export const BLOOD = '#C0473B'

export type Lang = 'en' | 'ru'

export const langOf = (value: unknown): Lang => (value === 'ru' ? 'ru' : 'en')

export type Sign = { color: string; glow: string; glyph: string }

// Each sign keeps the color the game gives it.
export const SIGNS: Record<SignKey, Sign> = {
  igni: { color: '#F07A3C', glow: '#FFB070', glyph: '▲' },
  yrden: { color: '#B59BF6', glow: '#D8C8FF', glyph: '◎' },
  senses: { color: '#E8573E', glow: '#FF9070', glyph: '◬' },
  axii: { color: '#7DD38E', glow: '#B8F5C4', glyph: '◉' },
  aard: { color: '#8EC6FF', glow: '#CFE6FF', glyph: '◭' },
  quen: { color: '#F2C14E', glow: '#FFE39A', glyph: '◈' },
}

const SIGN_OF_TOOL: Record<string, SignKey> = {
  Bash: 'igni',
  BashOutput: 'igni',
  KillShell: 'igni',
  Edit: 'yrden',
  MultiEdit: 'yrden',
  Write: 'yrden',
  NotebookEdit: 'yrden',
  Read: 'senses',
  Grep: 'senses',
  Glob: 'senses',
  LS: 'senses',
  WebFetch: 'axii',
  WebSearch: 'axii',
  Agent: 'aard',
  Task: 'aard',
}

// Bash burns like Igni, edits are glyphs drawn in Yrden, reading is investigation
// with the senses, the web is Axii's persuasion, a subagent is Aard's push, the rest Quen.
export const signOf = (tool: string): SignKey => SIGN_OF_TOOL[tool] ?? 'quen'

export const isSignKey = (key: unknown): key is SignKey =>
  typeof key === 'string' && Object.prototype.hasOwnProperty.call(SIGNS, key)

export type SpinnerMode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'

type Words = {
  sign: Record<SignKey, { name: string; casting: string }>
  titles: string[]
  idleTitle: string
  idle: string
  newQuest: string
  study: string
  done: (xp: string) => string
  abandoned: string
  failed: string
  spinner: Record<Exclude<SpinnerMode, 'tool-use'>, string> & { anySign: string }
  past: string[]
  levelUp: (level: number, title: string) => string
  lowVitality: (v: number) => string
  meditated: (v: number) => string
  sheathed: string
  drawn: string
  language: string
  command: string
  levelShort: string
  alt: { vitality: string; stamina: string; adrenaline: (n: number) => string; level: string; crowns: string }
  sheet: {
    level: string
    vitality: string
    context: (used: string, window: string) => string
    stamina: string
    staminaLeft: (pct: number) => string
    adrenaline: string
    streak: (n: number) => string
    experience: string
    toLevel: (into: string, need: string, next: number) => string
    crowns: string
    tokens: string
    cache: string
    contracts: (n: number) => string
  }
}

// The Russian follows the game's own Russian edition: Игни, Квен, ведьмачье чутьё, кроны.
export const WORDS: Record<Lang, Words> = {
  en: {
    sign: {
      igni: { name: 'Igni', casting: 'Casting Igni' },
      yrden: { name: 'Yrden', casting: 'Inscribing Yrden' },
      senses: { name: 'Witcher Senses', casting: 'Using Witcher Senses' },
      axii: { name: 'Axii', casting: 'Casting Axii' },
      aard: { name: 'Aard', casting: 'Casting Aard' },
      quen: { name: 'Quen', casting: 'Casting Quen' },
    },
    titles: [
      'Kaer Morhen Trainee',
      'Survivor of the Grasses',
      'Novice Witcher',
      'Monster Slayer',
      'Contract Hunter',
      'Silver Sword',
      'Wolf School Master',
      'White Wolf',
    ],
    idleTitle: 'Kaer Morhen',
    idle: 'Await your next contract',
    newQuest: 'A new contract',
    study: 'Study the contract',
    done: xp => `Quest completed · +${xp} XP`,
    abandoned: 'Quest abandoned',
    failed: 'Quest failed',
    spinner: {
      thinking: 'Meditating',
      requesting: 'Following the trail',
      responding: 'Writing in the journal',
      'tool-input': 'Preparing a sign',
      anySign: 'Casting a sign',
    },
    past: ['Meditated', 'Hunted', 'Tracked the beast', 'Brewed potions', 'Played Gwent', 'Rode Roach', 'Haggled', 'Fought'],
    levelUp: (level, title) => `Level up! Ability point gained · Level ${level}: ${title}`,
    lowVitality: v => `Vitality low: ${v}%. Meditate to recover: /compact`,
    meditated: v => `Meditation complete. Vitality restored to ${v}%`,
    sheathed: 'HUD sheathed. /hud draws it again.',
    drawn: 'HUD drawn.',
    language: 'HUD language: English.',
    command: 'Sheathe or draw the witcher HUD · /hud stats: character sheet · /hud lang en|ru',
    levelShort: 'Lv',
    alt: {
      vitality: 'Vitality',
      stamina: 'stamina',
      adrenaline: n => `adrenaline ${n} of 3`,
      level: 'level',
      crowns: 'crowns',
    },
    sheet: {
      level: 'Level',
      vitality: 'Vitality',
      context: (used, window) => `context ${used} of ${window}`,
      stamina: 'Stamina',
      staminaLeft: pct => `${pct}% of the 5-hour limit left`,
      adrenaline: 'Adrenaline',
      streak: n => `${n} clean casts in a row`,
      experience: 'Experience',
      toLevel: (into, need, next) => `${into} / ${need} to level ${next}`,
      crowns: 'Crowns',
      tokens: 'Tokens',
      cache: 'cache',
      contracts: n => `${n} contracts`,
    },
  },
  ru: {
    sign: {
      igni: { name: 'Игни', casting: 'Знак Игни' },
      yrden: { name: 'Ирден', casting: 'Знак Ирден' },
      senses: { name: 'Ведьмачье чутьё', casting: 'Ведьмачье чутьё' },
      axii: { name: 'Аксий', casting: 'Знак Аксий' },
      aard: { name: 'Аард', casting: 'Знак Аард' },
      quen: { name: 'Квен', casting: 'Знак Квен' },
    },
    titles: [
      'Ученик Каэр Морхена',
      'Переживший Испытание травами',
      'Молодой ведьмак',
      'Истребитель чудовищ',
      'Охотник за заказами',
      'Серебряный меч',
      'Мастер Школы Волка',
      'Белый Волк',
    ],
    idleTitle: 'Каэр Морхен',
    idle: 'Дождитесь нового заказа',
    newQuest: 'Новый заказ',
    study: 'Изучите заказ',
    done: xp => `Задание выполнено · +${xp} опыта`,
    abandoned: 'Задание прервано',
    failed: 'Задание провалено',
    spinner: {
      thinking: 'Медитация',
      requesting: 'Идём по следу',
      responding: 'Запись в журнал',
      'tool-input': 'Подготовка знака',
      anySign: 'Сотворение знака',
    },
    past: ['Медитировал', 'Охотился', 'Выслеживал зверя', 'Варил эликсиры', 'Играл в гвинт', 'Скакал на Плотве', 'Торговался', 'Сражался'],
    levelUp: (level, title) => `Новый уровень! Получено очко умений · Уровень ${level}: ${title}`,
    lowVitality: v => `Жизненная сила на исходе: ${v}%. Помедитируйте, чтобы восстановиться: /compact`,
    meditated: v => `Медитация окончена. Жизненная сила восстановлена до ${v}%`,
    sheathed: 'HUD убран в ножны. /hud вернёт его.',
    drawn: 'HUD снова с вами.',
    language: 'Язык HUD: русский.',
    command: 'Убрать или вернуть HUD ведьмака · /hud stats: лист персонажа · /hud lang en|ru',
    levelShort: 'Ур',
    alt: {
      vitality: 'Жизненная сила',
      stamina: 'выносливость',
      adrenaline: n => `адреналин ${n} из 3`,
      level: 'уровень',
      crowns: 'кроны',
    },
    sheet: {
      level: 'Уровень',
      vitality: 'Жизненная сила',
      context: (used, window) => `контекст ${used} из ${window}`,
      stamina: 'Выносливость',
      staminaLeft: pct => `осталось ${pct}% от 5-часового лимита`,
      adrenaline: 'Адреналин',
      streak: n => `удачных знаков подряд: ${n}`,
      experience: 'Опыт',
      toLevel: (into, need, next) => `${into} / ${need} до уровня ${next}`,
      crowns: 'Кроны',
      tokens: 'Токены',
      cache: 'кэш',
      contracts: n => `заказов: ${n}`,
    },
  },
}

export const signName = (key: SignKey, lang: Lang) => WORDS[lang].sign[key].name

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path

const hostOf = (url: string) => {
  const m = /^[a-z]+:\/\/([^/?#]+)/i.exec(url)
  return m?.[1] ?? url
}

// What the objective line says a tool is doing: the command, the file, the pattern.
export const detailOf = (input: Record<string, unknown>, tool: string): string => {
  const str = (key: string) => {
    const v = input[key]
    return typeof v === 'string' && v.trim() !== '' ? v : undefined
  }
  const path = str('file_path') ?? str('notebook_path') ?? str('path')
  const url = str('url')
  const raw =
    str('command') ??
    (path && baseName(path)) ??
    str('pattern') ??
    str('query') ??
    (url && hostOf(url)) ??
    str('description') ??
    tool.split('__').pop() ??
    tool
  return oneLine(raw)
}

// A quest is named after the first line of what the person asked.
export const questTitle = (text: string): string => {
  const line = text.split('\n').map(oneLine).find(l => l !== '') ?? ''
  const clean = oneLine(line.replace(/[`*_#>[\]]/g, ''))
  return clean === '' ? '' : clean[0]!.toUpperCase() + clean.slice(1)
}

// Cut to n characters at a word where one is near, with an ellipsis.
export const clip = (s: string, n: number): string => {
  if (s.length <= n) return s
  if (n <= 1) return s.slice(0, Math.max(0, n))
  const cut = s.slice(0, n - 1)
  const space = cut.lastIndexOf(' ')
  return (space > n * 0.6 ? cut.slice(0, space) : cut).trimEnd() + '…'
}

const decimal = (s: string, lang: Lang) => (lang === 'ru' ? s.replace('.', ',') : s)

export const fmt = (n: number, lang: Lang = 'en') =>
  decimal(n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)), lang)

export const money = (usd: number, lang: Lang = 'en') => decimal(usd.toFixed(2), lang)

const BASE = 5000

// Cache reads are cheap, so they earn no experience.
export const xpOf = (t: Totals) => t.input + t.cacheWrite + t.output

// Level L spans [BASE * (2^(L-1) - 1), BASE * (2^L - 1)): each level needs twice the last.
export const levelOf = (xp: number, lang: Lang = 'en') => {
  let level = 1
  while (xp >= BASE * (2 ** level - 1)) level += 1
  const floor = BASE * (2 ** (level - 1) - 1)
  const need = BASE * 2 ** (level - 1)
  const titles = WORDS[lang].titles
  const title = titles[Math.min(level, titles.length) - 1] ?? titles[titles.length - 1] ?? ''
  return { level, title, into: xp - floor, need }
}

// Adrenaline builds with tool calls that land and is lost to the first one that fails.
export const STREAK_PER_POINT = 4
export const adrenalineOf = (streak: number) => Math.min(3, Math.floor(streak / STREAK_PER_POINT))

export const LOW_VITALITY = 20

export type QuestLine = { title: string; objective: string; tone: 'active' | 'done' | 'failed' | 'idle' }

export const questLine = (
  status: QuestStatus,
  title: string,
  xpGained: number,
  sign: { key: SignKey; detail: string } | null,
  lang: Lang = 'en',
): QuestLine => {
  const w = WORDS[lang]
  const named = title === '' ? w.newQuest : title
  switch (status) {
    case 'idle':
      return { title: w.idleTitle, objective: w.idle, tone: 'idle' }
    case 'done':
      return { title: named, objective: w.done(fmt(xpGained, lang)), tone: 'done' }
    case 'abandoned':
      return { title: named, objective: w.abandoned, tone: 'failed' }
    case 'failed':
      return { title: named, objective: w.failed, tone: 'failed' }
    case 'active':
      return {
        title: named,
        objective: sign ? `${signName(sign.key, lang)}: ${sign.detail}` : w.study,
        tone: 'active',
      }
  }
}

export const spinnerWord = (mode: SpinnerMode, sign: SignKey | null, lang: Lang = 'en'): string => {
  const w = WORDS[lang]
  if (mode === 'tool-use') return sign ? w.sign[sign].casting : w.spinner.anySign
  return w.spinner[mode]
}

// The same turn always gets the same word, however often its line is drawn.
export const pastWord = (id: string, lang: Lang = 'en'): string => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const past = WORDS[lang].past
  return past[h % past.length] ?? past[0] ?? ''
}

// A turn's length the Russian way: 42 с, 1 мин 4 с, 1 ч 5 мин.
export const durationRu = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} с`
  const m = Math.floor(s / 60)
  if (m < 60) return s % 60 === 0 ? `${m} мин` : `${m} мин ${s % 60} с`
  const h = Math.floor(m / 60)
  return m % 60 === 0 ? `${h} ч` : `${h} ч ${m % 60} мин`
}
