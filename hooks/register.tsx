import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Adrenaline, Ghost, Measure, Quest, QuestStatus, SignState, Totals } from '../types'
import { CLUSTER_W, HUD_H, clusterSvg, questSvg } from './art'
import {
  GOLD,
  GOLD_HI,
  LOW_VITALITY,
  SIGNS,
  STREAK_PER_POINT,
  adrenalineOf,
  detailOf,
  fmt,
  isSignKey,
  levelOf,
  pastWord,
  questLine,
  questTitle,
  signOf,
  spinnerWord,
  xpOf,
} from './lore'
import type { TerminalHud } from './terminal-hud'

const EMPTY: Totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 }
const IDLE: Quest = { title: '', status: 'idle', xpAtStart: 0, xpGained: 0 }

const totals = atom({ plugin: 'witcher-hud', key: 'totals' } as const, EMPTY)
const measure = atom({ plugin: 'witcher-hud', key: 'measure' } as const, {} as Measure)
const ghost = atom({ plugin: 'witcher-hud', key: 'ghost' } as const, null as Ghost | null)
const sign = atom({ plugin: 'witcher-hud', key: 'sign' } as const, null as SignState | null)
const quest = atom({ plugin: 'witcher-hud', key: 'quest' } as const, IDLE)
const adrenaline = atom({ plugin: 'witcher-hud', key: 'adrenaline' } as const, { streak: 0 } as Adrenaline)
const levelUp = atom({ plugin: 'witcher-hud', key: 'levelUp' } as const, null as number | null)
const isHidden = atom({ plugin: 'witcher-hud', key: 'isHidden' } as const, false)

const GHOST_MS = 1800
const LEVEL_UP_MS = 4000
// The desktop measures the band in cells of its code font, about this many pixels wide.
const DESKTOP_CELL_PX = 7.5

// A value an earlier version of the HUD kept in this session may have another shape.
const signNow = (s: unknown): SignState | null =>
  s !== null && typeof s === 'object' && isSignKey((s as { key?: unknown }).key) ? (s as SignState) : null
const questNow = (q: unknown): Quest =>
  q !== null && typeof q === 'object' && typeof (q as { status?: unknown }).status === 'string' ? (q as Quest) : IDLE

const vitalityOf = (m: Measure) => (m.percent === undefined ? undefined : 100 - m.percent)

const sheet = async ($: EngineInterface) => {
  const t = await read($, totals)
  const m = await read($, measure)
  const a = await read($, adrenaline)
  const lv = levelOf(xpOf(t))
  const v = vitalityOf(m)
  const context = m.tokens !== undefined && m.window ? ` (context ${fmt(m.tokens)} of ${fmt(m.window)})` : ''
  return [
    `${lv.title} · Level ${lv.level}`,
    `Vitality    ${v === undefined ? '—' : `${v}%`}${context}`,
    `Stamina     ${m.stamina === undefined ? '—' : `${Math.round(m.stamina)}% of the 5-hour limit left`}`,
    `Adrenaline  ${adrenalineOf(a.streak)}/3 (${a.streak} clean casts in a row)`,
    `Experience  ${fmt(lv.into)} / ${fmt(lv.need)} to level ${lv.level + 1}`,
    `Crowns      ${m.usd === undefined ? '—' : `$${m.usd.toFixed(2)}`}`,
    `Tokens      ↑${fmt(t.input + t.cacheWrite)} ↓${fmt(t.output)} · cache ${fmt(t.cacheRead)} · ${t.calls} contracts`,
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.ui.status(undefined)
    // A reload drops the timers that end these, so they start over here.
    await update($, ghost, () => null)
    await update($, levelUp, () => null)
    await $.command.register({
      name: 'hud',
      description: 'Sheathe or draw the witcher HUD; /hud stats shows the character sheet',
      argumentHint: '[stats]',
    })
    return next(e)
  })

  on('command.run', { command: 'hud' }, async ($, e) => {
    if (e.args.trim() === 'stats') return { text: await sheet($) }
    await update($, isHidden, v => !v)
    return { text: (await read($, isHidden)) ? 'HUD sheathed. /hud draws it again.' : 'HUD drawn.' }
  })

  // A prompt is a new quest, named after its first line.
  on('turn.start', async ($, e, next) => {
    const xp = xpOf(await read($, totals))
    const title = questTitle(e.text)
    await update($, quest, q => ({ title: title || questNow(q).title, status: 'active' as const, xpAtStart: xp, xpGained: 0 }))
    await update($, sign, () => null)
    // Adrenaline fades a point between quests.
    await update($, adrenaline, a => ({ streak: Math.max(0, a.streak - STREAK_PER_POINT) }))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    await update($, sign, () => ({ key: signOf(tool), detail: detailOf(e as unknown as Record<string, unknown>, tool) }))
    const r = await next(e)
    // A refusal is the person's call, not a hit: only a tool that failed costs the streak.
    if (r.deny === undefined) await update($, adrenaline, a => ({ streak: r.isError === true ? 0 : a.streak + 1 }))
    return r
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
        $.ui.toast(`Level up! Ability point gained · Level ${after.level}: ${after.title}`)
        await update($, levelUp, () => after.level)
        $.clock.after(LEVEL_UP_MS, () => void update($, levelUp, l => (l === after.level ? null : l)))
      }
    }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) {
      const xp = xpOf(await read($, totals))
      const status: QuestStatus = e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'abandoned' : 'failed'
      await update($, quest, q => {
        const now = questNow(q)
        return { ...now, status, xpGained: Math.max(0, xp - now.xpAtStart) }
      })
    }
    return r
  })

  on('session.measure', async ($, e, next) => {
    const prev = await read($, measure)
    const fiveHour = e.rateLimits.find(l => l.kind === 'five_hour')
    const now: Measure = {
      percent: e.context.percent,
      tokens: e.context.tokens,
      window: e.context.window,
      usd: e.cost?.usd,
      stamina: fiveHour && 100 - fiveHour.percentUsed,
    }
    await update($, measure, () => now)

    const v = vitalityOf(now)
    const was = vitalityOf(prev)
    if (v !== undefined && was !== undefined && v < was) {
      const id = await $.clock.now()
      await update($, ghost, () => ({ from: was, to: v, id }))
      $.clock.after(GHOST_MS, () => void update($, ghost, g => (g?.id === id ? null : g)))
    }
    if (v !== undefined && v <= LOW_VITALITY && (was ?? 100) > LOW_VITALITY) {
      $.ui.toast(`Vitality low: ${v}%. Meditate to recover: /compact`)
    }
    if (v !== undefined && was !== undefined && v - was >= 25) {
      $.ui.toast(`Meditation complete. Vitality restored to ${v}%`)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)

    const t = await read($, totals)
    const m = await read($, measure)
    const g = await read($, ghost)
    const s = signNow(await read($, sign))
    const q = questNow(await read($, quest))
    const a = await read($, adrenaline)
    const leveledTo = await read($, levelUp)
    const lv = levelOf(xpOf(t))
    const vitality = vitalityOf(m) ?? 100
    const ghostFrom = g !== null && g.to === vitality ? g.from : null
    // The sign shows while Claude works; between quests the wolf rests on the medallion.
    const shown = e.props.isWorking ? (s?.key ?? null) : null
    const line = questLine(q.status, q.title, q.xpGained, s)
    const points = adrenalineOf(a.streak)
    const stamina = m.stamina ?? null
    const usd = m.usd ?? null
    const xpFraction = lv.into / lv.need

    if (e.surface === 'terminal') {
      const { Client } = $.ui.resolve(e)
      const hud: TerminalHud = {
        columns: e.props.bodyColumns,
        glyph: shown ? SIGNS[shown].glyph : '◈',
        tint: shown ? SIGNS[shown].color : GOLD,
        halo: shown ? SIGNS[shown].glow : GOLD_HI,
        isWorking: e.props.isWorking,
        vitality,
        ghostFrom,
        ghostId: g?.id ?? 0,
        stamina,
        adrenaline: points,
        level: lv.level,
        xpFraction,
        usd,
        title: line.title,
        objective: line.objective,
        tone: line.tone,
      }
      return <Client key="witcher-hud" module="./terminal-hud.ts" props={hud} width="100%" height={1} />
    }

    const { Box, Svg } = $.ui.resolve(e)
    const questW = Math.min(380, Math.floor(e.props.bodyColumns * DESKTOP_CELL_PX - CLUSTER_W - 24))
    const cluster = clusterSvg({
      sign: shown,
      isWorking: e.props.isWorking,
      vitality,
      ghostFrom,
      stamina,
      adrenaline: points,
      level: lv.level,
      xpFraction,
      isLevelUp: leveledTo !== null,
      usd,
    })
    const alt = [
      `Vitality ${vitality}%`,
      stamina === null ? '' : `stamina ${Math.round(stamina)}%`,
      `adrenaline ${points} of 3`,
      `level ${lv.level}`,
      usd === null ? '' : `${usd.toFixed(2)} crowns`,
    ]
      .filter(Boolean)
      .join(', ')
    return (
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Svg source={cluster} alt={alt} width={CLUSTER_W} height={HUD_H} />
        {questW >= 220 && (
          <Svg source={questSvg(line, questW)} alt={`${line.title}: ${line.objective}`} width={questW} height={HUD_H} />
        )}
      </Box>
    )
  })

  // The spinner speaks the witcher's trade; on the desktop only where it would say a bare "Working".
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const s = signNow(await read($, sign))
    if (e.surface !== 'terminal' && e.props.word !== 'Working') return next(e)
    return next({ ...e, props: { ...e.props, word: spinnerWord(e.props.mode, s?.key ?? null) } })
  })

  on('ui.render', { component: 'TurnDuration' }, ($, e, next) =>
    next({ ...e, props: { ...e.props, word: pastWord(e.requestId) } }),
  )
}
