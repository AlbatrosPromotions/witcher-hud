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

export type SignState = { key: SignKey; detail: string }

export type Quest = { title: string; status: QuestStatus; xpAtStart: number; xpGained: number }

export type Adrenaline = { streak: number }

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
    }
  }
}
