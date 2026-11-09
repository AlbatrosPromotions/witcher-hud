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

// The kinds of sound the HUD makes, each turned on or off on its own; a sign can be, too.
export type SoundGroup = 'signs' | 'quests' | 'levels' | 'monsters' | 'trophies' | 'meditation' | 'danger'
export const SOUND_GROUPS: SoundGroup[] = ['signs', 'quests', 'levels', 'monsters', 'trophies', 'meditation', 'danger']
export const SOUND_KEYS: string[] = [...SOUND_GROUPS, 'igni', 'aard', 'quen', 'yrden', 'axii', 'senses']

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
  theme: Record<'auto' | 'dark' | 'light', string>
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
  // The character sheet the desktop shows while the pointer is on the character.
  hover: { title: (title: string, level: number) => string }
  // What the HUD's moments say in the quest tracker's place.
  moment: {
    questDone: string
    questFailed: string
    levelUp: (level: number) => string
    levelLine: (title: string) => string
    monsterLine: (detail: string) => string
    slain: string
    slainLine: (name: string) => string
    trophy: string
    meditating: string
    meditatingLine: string
    restored: string
    restoredLine: (v: number) => string
    xp: (xp: string) => string
  }
  trophyToast: (name: string, does: string) => string
  sound: Record<'on' | 'quiet' | 'off', string>
  sounds: {
    title: string
    opened: string
    notPlaced: string
    volume: string
    level: Record<'on' | 'quiet' | 'off', string>
    turnOn: string
    turnOff: string
    listen: string
    allOff: string
    group: Record<SoundGroup, { name: string; when: string }>
    state: (isOn: boolean) => string
    muted: (name: string) => string
    unmuted: (name: string) => string
    usage: string
  }
  journal: {
    title: string
    opened: string
    notPlaced: string
    session: string
    noQuests: string
    bestiary: string
    unknown: string
    met: (n: number) => string
    slain: (n: number) => string
    trophies: (have: number, of: number) => string
    signs: string
    career: (quests: number, slain: number, casts: number, days: number) => string
    thisSession: (xp: string) => string
    hunting: string
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
      'Witcher of Legend',
      'Grandmaster of the Wolf',
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
    theme: {
      auto: 'HUD theme: auto, after the app’s appearance.',
      dark: 'HUD theme: dark.',
      light: 'HUD theme: light parchment.',
    },
    command: 'Sheathe or draw the witcher HUD · /hud journal · /hud stats: character sheet · /hud sound: sound settings · /hud lang en|ru · /hud theme auto|dark|light',
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
    hover: { title: (title, level) => `${title} · Level ${level}` },
    moment: {
      questDone: 'Quest completed',
      questFailed: 'Quest failed',
      levelUp: level => `Level ${level}`,
      levelLine: title => `${title} · ability point gained`,
      monsterLine: detail => `A monster appears · ${detail}`,
      slain: 'Contract completed',
      slainLine: name => `${name} slain · a new bestiary entry`,
      trophy: 'Trophy',
      meditating: 'Meditation',
      meditatingLine: 'Time flows by the fire… the journal is condensed',
      restored: 'Meditation complete',
      restoredLine: v => `Vitality restored to ${v}%`,
      xp: xp => `+${xp} XP`,
    },
    trophyToast: (name, does) => `Trophy: ${name} · ${does}`,
    sound: { on: 'HUD sound on.', quiet: 'HUD sound quiet.', off: 'HUD sound off.' },
    sounds: {
      title: 'Sound',
      opened: 'Sound settings opened.',
      notPlaced: 'Widen the window to open the sound settings.',
      volume: 'Volume',
      level: { on: 'Full', quiet: 'Quiet', off: 'Off' },
      turnOn: 'Turn on',
      turnOff: 'Turn off',
      listen: '▶ Listen',
      allOff: 'All sound is off: pick a volume to hear any.',
      group: {
        signs: { name: 'Signs', when: 'each tool, as its sign is cast' },
        quests: { name: 'Quests', when: 'a quest completed or failed' },
        levels: { name: 'Level up', when: 'a new level' },
        monsters: { name: 'Monsters', when: 'a monster met, a contract completed' },
        trophies: { name: 'Trophies', when: 'a trophy won' },
        meditation: { name: 'Meditation', when: '/compact, and the vitality it gives back' },
        danger: { name: 'Danger', when: 'vitality down to 20%' },
      },
      state: isOn => (isOn ? 'on' : 'off'),
      muted: name => `${name}: sound off.`,
      unmuted: name => `${name}: sound on.`,
      usage: `/hud sound opens the sound settings. /hud sound on|quiet|off sets the volume; /hud sound <${SOUND_KEYS.join('|')}> on|off turns one kind on or off.`,
    },
    journal: {
      title: 'Witcher’s Journal',
      opened: 'Journal opened.',
      notPlaced: 'Widen the window to open the journal.',
      session: 'Quests of this session',
      noQuests: 'No quests yet. The board awaits.',
      bestiary: 'Bestiary',
      unknown: 'Not yet met',
      met: n => `met ${n}`,
      slain: n => `slain ${n}`,
      trophies: (have, of) => `Trophies ${have} of ${of}`,
      signs: 'Signs cast',
      career: (quests, slain, casts, days) => `${quests} quests · ${slain} monsters slain · ${casts} signs · ${days} days on the Path`,
      thisSession: xp => `this session +${xp} XP`,
      hunting: 'hunting',
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
      'Легендарный ведьмак',
      'Гроссмейстер Школы Волка',
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
    theme: {
      auto: 'Тема HUD: авто, как у приложения.',
      dark: 'Тема HUD: тёмная.',
      light: 'Тема HUD: светлая, пергамент.',
    },
    command: 'Убрать или вернуть HUD ведьмака · /hud journal: журнал · /hud stats: лист персонажа · /hud sound: настройки звука · /hud lang en|ru · /hud theme auto|dark|light',
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
    hover: { title: (title, level) => `${title} · Уровень ${level}` },
    moment: {
      questDone: 'Задание выполнено',
      questFailed: 'Задание провалено',
      levelUp: level => `Уровень ${level}`,
      levelLine: title => `${title} · получено очко умений`,
      monsterLine: detail => `Появилось чудовище · ${detail}`,
      slain: 'Заказ выполнен',
      slainLine: name => `${name}: чудовище повержено · новая запись в бестиарии`,
      trophy: 'Трофей',
      meditating: 'Медитация',
      meditatingLine: 'Время течёт у костра… журнал сжимается',
      restored: 'Медитация окончена',
      restoredLine: v => `Жизненная сила восстановлена до ${v}%`,
      xp: xp => `+${xp} опыта`,
    },
    trophyToast: (name, does) => `Трофей: ${name} · ${does}`,
    sound: { on: 'Звук HUD включён.', quiet: 'Звук HUD тихий.', off: 'Звук HUD выключен.' },
    sounds: {
      title: 'Звук',
      opened: 'Настройки звука открыты.',
      notPlaced: 'Расширьте окно, чтобы открыть настройки звука.',
      volume: 'Громкость',
      level: { on: 'Полная', quiet: 'Тихая', off: 'Выкл.' },
      turnOn: 'Включить',
      turnOff: 'Выключить',
      listen: '▶ Прослушать',
      allOff: 'Весь звук выключен: выберите громкость, чтобы его слышать.',
      group: {
        signs: { name: 'Знаки', when: 'каждый инструмент, когда сотворён его знак' },
        quests: { name: 'Задания', when: 'задание выполнено или провалено' },
        levels: { name: 'Новый уровень', when: 'получен уровень' },
        monsters: { name: 'Чудовища', when: 'встреча с чудовищем, выполненный заказ' },
        trophies: { name: 'Трофеи', when: 'получен трофей' },
        meditation: { name: 'Медитация', when: '/compact и восстановленная жизненная сила' },
        danger: { name: 'Опасность', when: 'жизненная сила упала до 20%' },
      },
      state: isOn => (isOn ? 'вкл.' : 'выкл.'),
      muted: name => `${name}: звук выключен.`,
      unmuted: name => `${name}: звук включён.`,
      usage: `/hud sound открывает настройки звука. /hud sound on|quiet|off задаёт громкость; /hud sound <${SOUND_KEYS.join('|')}> on|off включает или выключает один вид.`,
    },
    journal: {
      title: 'Журнал ведьмака',
      opened: 'Журнал открыт.',
      notPlaced: 'Расширьте окно, чтобы открыть журнал.',
      session: 'Задания этой сессии',
      noQuests: 'Заданий пока нет. Доска объявлений ждёт.',
      bestiary: 'Бестиарий',
      unknown: 'Ещё не встречено',
      met: n => `встречено ${n}`,
      slain: n => `повержено ${n}`,
      trophies: (have, of) => `Трофеи: ${have} из ${of}`,
      signs: 'Сотворённые знаки',
      career: (quests, slain, casts, days) => `заданий ${quests} · чудовищ повержено ${slain} · знаков ${casts} · дней на Пути ${days}`,
      thisSession: xp => `за эту сессию +${xp} опыта`,
      hunting: 'идёт охота',
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

// The career's experience to reach level L is BASE (L - 1)²: each level asks a little more than the
// last, so the first come within a session and the later over weeks.
const BASE = 250_000

// The level each title is earned at.
const TITLE_AT = [1, 3, 5, 8, 12, 16, 20, 25, 32, 40]

// Cache reads are cheap, so they earn no experience.
export const xpOf = (t: Totals) => t.input + t.cacheWrite + t.output

export const titleOf = (level: number, lang: Lang = 'en') => {
  const titles = WORDS[lang].titles
  let i = 0
  while (i + 1 < TITLE_AT.length && level >= TITLE_AT[i + 1]!) i++
  return titles[i] ?? ''
}

export const levelOf = (xp: number, lang: Lang = 'en') => {
  let level = Math.floor(Math.sqrt(Math.max(0, xp) / BASE)) + 1
  // Square roots of large numbers can land a hair either side of a level's threshold.
  while (BASE * level * level <= xp) level += 1
  while (level > 1 && BASE * (level - 1) * (level - 1) > xp) level -= 1
  const floor = BASE * (level - 1) * (level - 1)
  const need = BASE * level * level - floor
  return { level, title: titleOf(level, lang), into: xp - floor, need }
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
