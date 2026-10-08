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
  WORDS,
  adrenalineOf,
  detailOf,
  durationRu,
  fmt,
  isSignKey,
  langOf,
  levelOf,
  money,
  pastWord,
  questLine,
  questTitle,
  signOf,
  spinnerWord,
  xpOf,
} from './lore'
import type { Lang } from './lore'
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

const sheet = async ($: EngineInterface, lang: Lang) => {
  const w = WORDS[lang].sheet
  const t = await read($, totals)
  const m = await read($, measure)
  const a = await read($, adrenaline)
  const lv = levelOf(xpOf(t), lang)
  const v = vitalityOf(m)
  const n = (x: number) => fmt(x, lang)
  const context = m.tokens !== undefined && m.window ? ` (${w.context(n(m.tokens), n(m.window))})` : ''
  const rows: [string, string][] = [
    [w.vitality, `${v === undefined ? '—' : `${v}%`}${context}`],
    [w.stamina, m.stamina === undefined ? '—' : w.staminaLeft(Math.round(m.stamina))],
    [w.adrenaline, `${adrenalineOf(a.streak)}/3 (${w.streak(a.streak)})`],
    [w.experience, w.toLevel(n(lv.into), n(lv.need), lv.level + 1)],
    [w.crowns, m.usd === undefined ? '—' : `$${money(m.usd, lang)}`],
    [w.tokens, `↑${n(t.input + t.cacheWrite)} ↓${n(t.output)} · ${w.cache} ${n(t.cacheRead)} · ${w.contracts(t.calls)}`],
  ]
  const pad = Math.max(...rows.map(([label]) => label.length)) + 2
  return [`${lv.title} · ${w.level} ${lv.level}`, ...rows.map(([label, value]) => label.padEnd(pad) + value)].join('\n')
}

export const register: Register = (on, options) => {
  const lang = langOf(options.language)
  const words = WORDS[lang]

  on('session.start', async ($, e, next) => {
    $.ui.status(undefined)
    // A reload drops the timers that end these, so they start over here.
    await update($, ghost, () => null)
    await update($, levelUp, () => null)
    await $.command.register({ name: 'hud', description: words.command, argumentHint: '[stats | lang en|ru]' })
    return next(e)
  })

  on('command.run', { command: 'hud' }, async ($, e) => {
    const args = e.args.trim()
    if (args === 'stats') return { text: await sheet($, lang) }
    const chosen = /^lang(?:uage)?\s+(en|ru)$/i.exec(args)?.[1]
    if (chosen !== undefined) {
      const to = langOf(chosen.toLowerCase())
      // Written to the plugin's options in settings, which reloads the HUD in that language.
      const r = await $.config.set({ key: `${$.plugin.name}.language`, value: to })
      return { text: r.deny ?? WORDS[to].language }
    }
    await update($, isHidden, v => !v)
    return { text: (await read($, isHidden)) ? words.sheathed : words.drawn }
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
      const after = levelOf(xpOf(await read($, totals)), lang)
      if (after.level > before) {
        $.ui.toast(words.levelUp(after.level, after.title))
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
    if (v !== undefined && v <= LOW_VITALITY && (was ?? 100) > LOW_VITALITY) $.ui.toast(words.lowVitality(v))
    if (v !== undefined && was !== undefined && v - was >= 25) $.ui.toast(words.meditated(v))
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
    const lv = levelOf(xpOf(t), lang)
    const vitality = vitalityOf(m) ?? 100
    const ghostFrom = g !== null && g.to === vitality ? g.from : null
    // The sign shows while Claude works; between quests the wolf rests on the medallion.
    const shown = e.props.isWorking ? (s?.key ?? null) : null
    const line = questLine(q.status, q.title, q.xpGained, s, lang)
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
        levelLabel: words.levelShort,
        xpFraction,
        crowns: usd === null ? null : money(usd, lang),
        title: line.title,
        objective: line.objective,
        tone: line.tone,
      }
      return <Client key="witcher-hud" module="./terminal-hud.ts" props={hud} width="100%" height={1} />
    }

    const { Box, Svg } = $.ui.resolve(e)
    const questW = Math.min(380, Math.floor(e.props.bodyColumns * DESKTOP_CELL_PX - CLUSTER_W - 24))
    const cluster = clusterSvg({
      lang,
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
      `${words.alt.vitality} ${vitality}%`,
      stamina === null ? '' : `${words.alt.stamina} ${Math.round(stamina)}%`,
      words.alt.adrenaline(points),
      `${words.alt.level} ${lv.level}`,
      usd === null ? '' : `${words.alt.crowns} ${money(usd, lang)}`,
    ]
      .filter(Boolean)
      .join(', ')
    return (
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Svg source={cluster} alt={alt} width={CLUSTER_W} height={HUD_H} />
        {questW >= 220 && (
          <Svg source={questSvg(line, questW, lang)} alt={`${line.title}: ${line.objective}`} width={questW} height={HUD_H} />
        )}
      </Box>
    )
  })

  // The spinner speaks the witcher's trade; on the desktop only where it would say a bare "Working".
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const s = signNow(await read($, sign))
    if (e.surface !== 'terminal' && e.props.word !== 'Working') return next(e)
    return next({ ...e, props: { ...e.props, word: spinnerWord(e.props.mode, s?.key ?? null, lang) } })
  })

  // The line that closes a turn: the engine's "<word> for 3s" in English, a line of our own in Russian.
  on('ui.render', { component: 'TurnDuration' }, ($, e, next) => {
    if (lang === 'en') return next({ ...e, props: { ...e.props, word: pastWord(e.requestId, lang) } })
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{`✻ ${pastWord(e.requestId, lang)} ${durationRu(e.props.durationMs)}`}</Text>
  })
}
