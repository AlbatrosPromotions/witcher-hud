import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Measure, Sign, Totals } from '../types'

const EMPTY: Totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 }

const totals = atom({ plugin: 'witcher-hud', key: 'totals' } as const, EMPTY)
const measure = atom({ plugin: 'witcher-hud', key: 'measure' } as const, {} as Measure)
const sign = atom({ plugin: 'witcher-hud', key: 'sign' } as const, null as Sign | null)
const isHidden = atom({ plugin: 'witcher-hud', key: 'isHidden' } as const, false)

const GOLD = '#C9A55C'
const STEEL = '#8A8D91'
const VITALITY = '#B8322A'
const STAMINA = '#E3B341'
const ADRENALINE = '#E8E2D0'
const TOXIC = '#7FA650'

const TITLES = [
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
const LOW_VITALITY = 20

export const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n)

// Cache reads are cheap, so they feed adrenaline rather than XP.
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

// Three adrenaline points, earned by how much of the input the cache served.
export const adrenalineOf = (t: Totals) => {
  const fed = t.cacheRead + t.input + t.cacheWrite
  const ratio = fed === 0 ? 0 : t.cacheRead / fed
  return ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.3 ? 1 : 0
}

export const signOf = (tool: string) =>
  tool === 'Bash'
    ? 'Igni'
    : ['Edit', 'Write', 'NotebookEdit'].includes(tool)
      ? 'Yrden'
      : ['Read', 'Grep', 'Glob'].includes(tool)
        ? 'Axii'
        : ['WebFetch', 'WebSearch'].includes(tool)
          ? 'Aard'
          : tool === 'Agent'
            ? 'Quen'
            : 'Witcher Senses'

export const bar = (fraction: number, width: number) => {
  const full = Math.round(Math.min(1, Math.max(0, fraction)) * width)
  return '█'.repeat(full) + '░'.repeat(width - full)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.ui.status(undefined)
    await $.command.register({ name: 'hud', description: 'Show or hide the witcher HUD above the prompt' })
    return next(e)
  })

  on('command.run', { command: 'hud' }, async $ => {
    await update($, isHidden, v => !v)
    return { text: (await read($, isHidden)) ? 'HUD sheathed. /hud draws it again.' : 'HUD drawn.' }
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    await update($, sign, () => ({ name: signOf(tool), tool }))
    return next(e)
  }).catch(($, e, next) => next(e)) // A HUD never blocks a tool.

  // Every model request, main thread and subagents alike.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    const u = r.usage
    if (u) {
      const before = levelOf(xpOf(await read($, totals))).level
      await update($, totals, t => ({
        input: t.input + u.input_tokens,
        output: t.output + u.output_tokens,
        cacheRead: t.cacheRead + u.cache_read_input_tokens,
        cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
        calls: t.calls + 1,
      }))
      const after = levelOf(xpOf(await read($, totals)))
      if (after.level > before) {
        $.ui.toast(`⚔ LEVEL UP! Ability point gained. Level ${after.level}: ${after.title}`)
      }
    }
    return r
  })

  on('session.measure', async ($, e, next) => {
    const prev = await read($, measure)
    const fiveHour = e.rateLimits.find(l => l.kind === 'five_hour')
    const now: Measure = {
      percent: e.context.percent,
      usd: e.cost?.usd,
      stamina: fiveHour && 100 - fiveHour.percentUsed,
    }
    await update($, measure, () => now)

    const vitality = now.percent === undefined ? undefined : 100 - now.percent
    const prevVitality = prev.percent === undefined ? 100 : 100 - prev.percent
    if (vitality !== undefined && vitality <= LOW_VITALITY && prevVitality > LOW_VITALITY) {
      $.ui.toast(`Vitality low: ${vitality}%. Meditate to recover: /compact`)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const t = await read($, totals)
    const m = await read($, measure)
    const s = await read($, sign)
    const lv = levelOf(xpOf(t))
    const width = Math.min(30, Math.max(8, e.props.bodyColumns - 36))
    const vitality = m.percent === undefined ? 100 : 100 - m.percent
    const adrenaline = adrenalineOf(t)

    const meter = (label: string, color: string, fraction: number, value: string) => (
      <Box gap={1}>
        <Text color={GOLD}>{label.padEnd(10)}</Text>
        <Text color={color}>{bar(fraction, width)}</Text>
        <Text color={STEEL}>{value}</Text>
      </Box>
    )

    return (
      <Box borderStyle="double" borderColor={GOLD} paddingX={1} flexDirection="column">
        <Box gap={2}>
          <Text bold color={GOLD}>◈ LEVEL {lv.level}</Text>
          <Text italic color={ADRENALINE}>{lv.title}</Text>
          <Text color={STEEL}>⚔ {t.calls} contracts</Text>
        </Box>
        {meter('Vitality', vitality > LOW_VITALITY ? VITALITY : TOXIC, vitality / 100, `${vitality}%`)}
        {m.stamina !== undefined && meter('Stamina', STAMINA, m.stamina / 100, `${Math.round(m.stamina)}%`)}
        <Box gap={1}>
          <Text color={GOLD}>{'Adrenaline'.padEnd(10)}</Text>
          <Text color={ADRENALINE}>{'●'.repeat(adrenaline)}</Text>
          <Text color={STEEL}>{'○'.repeat(3 - adrenaline)}</Text>
        </Box>
        <Box gap={2}>
          <Text color={GOLD}>{'Sign'.padEnd(10)}</Text>
          <Text bold color={ADRENALINE}>{s ? `${s.name}` : '-'}</Text>
          {s && <Text color={STEEL}>({s.tool})</Text>}
          {e.props.isWorking && <Text italic color={STAMINA}>medallion humming…</Text>}
        </Box>
        <Box gap={2}>
          <Text color={GOLD}>✦ {fmt(lv.into)} / {fmt(lv.need)} XP</Text>
          <Text color={STAMINA}>⛁ {m.usd === undefined ? '-' : `$${m.usd.toFixed(2)}`} crowns</Text>
          <Text color={STEEL}>↑{fmt(t.input + t.cacheWrite)} ↓{fmt(t.output)}</Text>
        </Box>
      </Box>
    )
  })
}
