export type Totals = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  calls: number
}

export type Measure = { percent?: number; usd?: number; stamina?: number }

export type Sign = { name: string; tool: string }

declare module 'claude-code' {
  interface PluginState {
    'witcher-hud': { totals: Totals; measure: Measure; sign: Sign | null; isHidden: boolean }
  }
}
