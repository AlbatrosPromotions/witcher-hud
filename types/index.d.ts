export type SignKey = 'igni' | 'yrden' | 'senses' | 'axii' | 'aard' | 'quen'

export type QuestStatus = 'idle' | 'active' | 'done' | 'abandoned' | 'failed'

export type Totals = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  calls: number
}

export type Measure = {
  percent?: number
  tokens?: number
  window?: number
  usd?: number
  stamina?: number
}

// The stretch of the vitality bar just lost, drawn pale while it drains away.
export type Ghost = { from: number; to: number; id: number }

// `at`: when the sign was cast, so the medallion shakes once for it.
export type SignState = { key: SignKey; detail: string; at?: number }

export type Quest = { title: string; status: QuestStatus; xpAtStart: number; xpGained: number }

export type Adrenaline = { streak: number }

export type MonsterKey = 'drowner' | 'griffin' | 'harpy' | 'wraith' | 'ghoul' | 'wolf' | 'kikimora' | 'foglet' | 'siren' | 'leshy' | 'wyvern'

export type TrophyKey =
  | 'first-contract'
  | 'pyromancer'
  | 'scribe'
  | 'tracker'
  | 'persuader'
  | 'force'
  | 'unbreakable'
  | 'flawless'
  | 'night-hunter'
  | 'long-road'
  | 'griffin-slayer'
  | 'bane'
  | 'naturalist'
  | 'inner-peace'
  | 'epic'
  | 'veteran'
  | 'path'
  | 'hundred'

// What a run of hunting adds up to: one process of a session, a whole session, or a career.
export type Deeds = {
  xp: number
  quests: number
  failed: number
  // Quests completed between midnight and five, local time.
  nightQuests: number
  biggestQuest: number
  casts: Record<string, number>
  met: Record<string, number>
  slain: Record<string, number>
  meditations: number
  bestStreak: number
  // The longest one session ran, first deed to last.
  longestMs: number
  firstAt: number
  lastAt: number
  // The local days hunted on, YYYY-MM-DD.
  days: string[]
}

// The career as this process found it in the store, for the session `id`: every other session's
// deeds, this session's own from an earlier run, and the trophies earned (when, in ms). `xpBase`:
// the experience counted before this session began in the same process (after a /clear).
export type Career = { id: string; others: Deeds; prior: Deeds; trophies: Record<string, number>; xpBase: number }

// A moment the HUD plays out once, on its own clock: `at` it starts, for `ms`. Moments queue, one after another.
export type Moment = { at: number; ms: number } & (
  | { kind: 'quest'; status: 'done' | 'failed'; title: string; xp: number }
  | { kind: 'levelUp'; level: number }
  | { kind: 'monster'; monster: MonsterKey; detail: string }
  | { kind: 'slain'; monster: MonsterKey }
  | { kind: 'trophy'; trophy: TrophyKey }
  | { kind: 'restored'; from: number; to: number }
)

// One quest of the session, as the journal lists it.
export type QuestEntry = { title: string; status: QuestStatus; xp: number; startedAt: number; endedAt: number | null; casts: number }

declare module 'claude-code' {
  interface PluginState {
    'witcher-hud': {
      totals: Totals
      measure: Measure
      ghost: Ghost | null
      sign: SignState | null
      quest: Quest
      adrenaline: Adrenaline
      levelUp: number | null
      isHidden: boolean
      // Counts the desktop's redraws that take an old HUD frame away once the new one shows.
      settled: number
      // This process's deeds; with the career, what the store keeps for this session.
      deeds: Deeds
      career: Career | null
      moments: Moment[]
      // Since when the conversation is being compacted: the witcher meditates.
      meditating: number | null
      // The monsters met and not yet slain, each since when.
      hunt: Record<string, number>
      journal: QuestEntry[]
      // The kinds of sound turned off (a kind's name, or a sign's), as the store keeps them.
      muted: string[]
    }
  }
}
