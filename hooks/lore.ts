// The game's words and numbers: no engine calls here, so tests and previews can run it anywhere.
import type { QuestStatus, SignKey, Totals } from '../types'

export const GOLD = '#C9A55C'
export const GOLD_HI = '#F1D99A'
export const GOLD_LO = '#7E5F2A'
export const PARCHMENT = '#E6DCC3'
export const ASH = '#8F8778'
export const BLOOD = '#C0473B'

export type Sign = { name: string; color: string; glow: string; casting: string; glyph: string }

// Each sign keeps the color the game gives it.
export const SIGNS: Record<SignKey, Sign> = {
  igni: { name: 'Igni', color: '#F07A3C', glow: '#FFB070', casting: 'Casting Igni', glyph: '▲' },
  yrden: { name: 'Yrden', color: '#B59BF6', glow: '#D8C8FF', casting: 'Inscribing Yrden', glyph: '◎' },
  senses: { name: 'Witcher Senses', color: '#E8573E', glow: '#FF9070', casting: 'Using Witcher Senses', glyph: '◬' },
  axii: { name: 'Axii', color: '#7DD38E', glow: '#B8F5C4', casting: 'Casting Axii', glyph: '◉' },
  aard: { name: 'Aard', color: '#8EC6FF', glow: '#CFE6FF', casting: 'Casting Aard', glyph: '◭' },
  quen: { name: 'Quen', color: '#F2C14E', glow: '#FFE39A', casting: 'Casting Quen', glyph: '◈' },
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

export const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n))

export const TITLES = [
  'Kaer Morhen Trainee',
  'Survivor of the Grasses',
  'Novice Witcher',
  'Monster Slayer',
  'Contract Hunter',
  'Silver Sword',
  'Wolf School Master',
  'White Wolf',
]

const BASE = 5000

// Cache reads are cheap, so they earn no experience.
export const xpOf = (t: Totals) => t.input + t.cacheWrite + t.output

// Level L spans [BASE * (2^(L-1) - 1), BASE * (2^L - 1)): each level needs twice the last.
export const levelOf = (xp: number) => {
  let level = 1
  while (xp >= BASE * (2 ** level - 1)) level += 1
  const floor = BASE * (2 ** (level - 1) - 1)
  const need = BASE * 2 ** (level - 1)
  const title = TITLES[Math.min(level, TITLES.length) - 1] ?? 'White Wolf'
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
): QuestLine => {
  const named = title === '' ? 'A new contract' : title
  switch (status) {
    case 'idle':
      return { title: 'Kaer Morhen', objective: 'Await your next contract', tone: 'idle' }
    case 'done':
      return { title: named, objective: `Quest completed · +${fmt(xpGained)} XP`, tone: 'done' }
    case 'abandoned':
      return { title: named, objective: 'Quest abandoned', tone: 'failed' }
    case 'failed':
      return { title: named, objective: 'Quest failed', tone: 'failed' }
    case 'active':
      return {
        title: named,
        objective: sign ? `${SIGNS[sign.key].name}: ${sign.detail}` : 'Study the contract',
        tone: 'active',
      }
  }
}

export type SpinnerMode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'

export const spinnerWord = (mode: SpinnerMode, sign: SignKey | null): string => {
  switch (mode) {
    case 'thinking':
      return 'Meditating'
    case 'requesting':
      return 'Following the trail'
    case 'responding':
      return 'Writing in the journal'
    case 'tool-input':
      return 'Preparing a sign'
    case 'tool-use':
      return sign ? SIGNS[sign].casting : 'Casting a sign'
  }
}

const PAST = ['Meditated', 'Hunted', 'Tracked the beast', 'Brewed potions', 'Played Gwent', 'Rode Roach', 'Haggled', 'Fought']

// The same turn always gets the same word, however often its line is drawn.
export const pastWord = (id: string): string => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PAST[h % PAST.length] ?? 'Meditated'
}
