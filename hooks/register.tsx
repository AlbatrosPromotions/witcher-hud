import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Adrenaline, Career, Deeds, Ghost, Measure, Moment, Quest, QuestEntry, QuestStatus, SignKey, SignState, Totals } from '../types'
import { hudSvg, themeOf } from './art'
import type { HudArt, Theme } from './art'
import { MONSTERS, MONSTER_WORDS, NO_DEEDS, TROPHIES, TROPHY_WORDS, continueRun, deedsOf, isEarned, isNight, join, localOf, monsterOf } from './career'
import { BANNER_MS, HIT_MS, SPELL_MS } from './fx'
import type { Banner, BannerKind, FxArt, Period } from './fx'
import { H, MAX_W, bands } from './layout'
import type { Band } from './layout'
import {
  ASH,
  BLOOD,
  GOLD,
  GOLD_HI,
  LOW_VITALITY,
  SIGNS,
  SOUND_GROUPS,
  SOUND_KEYS,
  STREAK_PER_POINT,
  WORDS,
  adrenalineOf,
  clip,
  detailOf,
  durationRu,
  fmt,
  isSignKey,
  langOf,
  levelOf,
  money,
  pastWord,
  questLine,
  signName,
  questTitle,
  signOf,
  spinnerWord,
  titleOf,
  xpOf,
} from './lore'
import type { Lang, SoundGroup } from './lore'
import type { TerminalHud } from './terminal-hud'

const EMPTY: Totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 }
const IDLE: Quest = { title: '', status: 'idle', xpAtStart: 0, xpGained: 0 }
const EMPTY_CAREER: Career = { id: '', others: NO_DEEDS, prior: NO_DEEDS, trophies: {}, xpBase: 0 }

const totals = atom({ plugin: 'witcher-hud', key: 'totals' } as const, EMPTY)
const measure = atom({ plugin: 'witcher-hud', key: 'measure' } as const, {} as Measure)
const ghost = atom({ plugin: 'witcher-hud', key: 'ghost' } as const, null as Ghost | null)
const sign = atom({ plugin: 'witcher-hud', key: 'sign' } as const, null as SignState | null)
const quest = atom({ plugin: 'witcher-hud', key: 'quest' } as const, IDLE)
const adrenaline = atom({ plugin: 'witcher-hud', key: 'adrenaline' } as const, { streak: 0 } as Adrenaline)
const levelUp = atom({ plugin: 'witcher-hud', key: 'levelUp' } as const, null as number | null)
const isHidden = atom({ plugin: 'witcher-hud', key: 'isHidden' } as const, false)
const settled = atom({ plugin: 'witcher-hud', key: 'settled' } as const, 0)
const deeds = atom({ plugin: 'witcher-hud', key: 'deeds' } as const, NO_DEEDS)
const career = atom({ plugin: 'witcher-hud', key: 'career' } as const, null as Career | null)
const moments = atom({ plugin: 'witcher-hud', key: 'moments' } as const, [] as Moment[])
const meditating = atom({ plugin: 'witcher-hud', key: 'meditating' } as const, null as number | null)
const hunt = atom({ plugin: 'witcher-hud', key: 'hunt' } as const, {} as Record<string, number>)
const journal = atom({ plugin: 'witcher-hud', key: 'journal' } as const, [] as QuestEntry[])
// Until the person picks, only a quest's end sounds: every other kind starts off.
const DEFAULT_MUTED = ['signs', 'levels', 'monsters', 'trophies', 'meditation', 'danger']
const muted = atom({ plugin: 'witcher-hud', key: 'muted' } as const, DEFAULT_MUTED)

const GHOST_MS = 1800
const LEVEL_UP_MS = 4000
// The medallion shakes once as a sign is cast; a redraw this soon after still shakes.
const CAST_MS = 900
// An Svg's source is held to this many characters.
const SVG_LIMIT = 131072
// A new HUD frame is laid over the one on show while it loads; this long after, it has loaded, and
// a redraw takes the old one away. A frame newer still, arriving before LOAD_MS, replaces it.
const LOAD_MS = 400
const SETTLE_MS = 700
const THEMES: Theme[] = ['auto', 'dark', 'light']
// A loss of vitality this large is a hit: the bar flashes and the damage rises from it.
const HIT_AT = 3
const JOURNAL = 'journal'
const JOURNAL_SIZE = 200
const SOUND_PANE = 'sound'

// --- The career in the store: one record per session, the trophies, and the old sessions rolled up. ---
const CAREER = 'career:v1:'
const RUN = `${CAREER}s:`
const TROPHY = `${CAREER}trophy:`
const ROLLED = `${CAREER}base`
// Past this many session records, all but the newest KEEP_RUNS are added into one.
const ROLL_AT = 400
const KEEP_RUNS = 100

// --- Moments: queued one after another; a minor one waits no longer than this, and so many at most. ---
const MOMENT_WAIT_MS = 8000
const MOMENTS_MINOR = 4
const MOMENTS_MAJOR = 6
// The moments drawn at once: the one playing and the next. Each one drawn is thousands of characters
// at every band, and the Svg is held to SVG_LIMIT; the rest are drawn as those play out.
const MOMENTS_DRAWN = 2

// --- Sounds: a sign's clip skips a repeat of itself and a burst of casts; a louder moment wins. ---
type Sound = SignKey | 'quest-done' | 'quest-failed' | 'level-up' | 'monster' | 'slain' | 'trophy' | 'restored' | 'danger' | 'meditate'
type SoundLevel = 'on' | 'quiet' | 'off'
const soundLevelOf = (v: unknown): SoundLevel => (v === 'quiet' || v === 'off' ? v : 'on')
const LOUDNESS: Record<SoundLevel, number> = { on: 1, quiet: 0.35, off: 0 }
const SIGN_GAIN = 0.8
const SAME_SIGN_MS = 2500
const ANY_SIGN_MS = 800
const YIELD_SOUND_MS = 1200
const priorityOf = (s: Sound) => (isSignKey(s) ? 1 : s === 'level-up' ? 3 : 2)
// The kinds of sound turned off, kept in the store for every session: a kind's name, or a sign's.
const MUTED = 'sound:v1:muted'
const GROUP_OF: Record<Sound, SoundGroup> = {
  igni: 'signs',
  aard: 'signs',
  quen: 'signs',
  yrden: 'signs',
  axii: 'signs',
  senses: 'signs',
  'quest-done': 'quests',
  'quest-failed': 'quests',
  'level-up': 'levels',
  monster: 'monsters',
  slain: 'monsters',
  trophy: 'trophies',
  meditate: 'meditation',
  restored: 'meditation',
  danger: 'danger',
}
// What the settings play for a kind when asked to.
const SAMPLE_OF: Record<SoundGroup, Sound> = {
  signs: 'igni',
  quests: 'quest-done',
  levels: 'level-up',
  monsters: 'monster',
  trophies: 'trophy',
  meditation: 'meditate',
  danger: 'danger',
}
const mutedNow = (v: unknown): string[] => (Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string' && SOUND_KEYS.includes(k)) : [])
const isMuted = (sound: Sound, off: string[]) => off.includes(sound) || off.includes(GROUP_OF[sound])
const SOUND_OF: Record<BannerKind, Sound> = {
  'quest-done': 'quest-done',
  'quest-failed': 'quest-failed',
  level: 'level-up',
  monster: 'monster',
  slain: 'slain',
  trophy: 'trophy',
  restored: 'restored',
}

type Unplaced<M> = M extends unknown ? Omit<M, 'at' | 'ms'> : never
type NewMoment = Unplaced<Moment>
const kindOf = (m: NewMoment): BannerKind =>
  m.kind === 'quest' ? (m.status === 'done' ? 'quest-done' : 'quest-failed') : m.kind === 'levelUp' ? 'level' : m.kind

// A value an earlier version of the HUD kept in this session may have another shape.
const signNow = (s: unknown): SignState | null =>
  s !== null && typeof s === 'object' && isSignKey((s as { key?: unknown }).key) ? (s as SignState) : null
const questNow = (q: unknown): Quest =>
  q !== null && typeof q === 'object' && typeof (q as { status?: unknown }).status === 'string' ? (q as Quest) : IDLE
const careerNow = (c: Career | null): Career => c ?? EMPTY_CAREER

// This session's experience, its run of deeds (earlier processes of it included), and the whole career.
const sessionXpOf = (c: Career, t: Totals) => Math.max(0, xpOf(t) - c.xpBase)
const careerXpOf = (c: Career, t: Totals) => c.others.xp + c.prior.xp + sessionXpOf(c, t)
const runOf = (c: Career, d: Deeds, t: Totals) => continueRun(c.prior, { ...d, xp: sessionXpOf(c, t) })
const wholeOf = (c: Career, d: Deeds, t: Totals) => join(c.others, runOf(c, d, t))
const one = (r: Record<string, number>, k: string) => ({ ...r, [k]: (r[k] ?? 0) + 1 })
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)

// The light of the hour the witcher hunts in; a runtime without a clock's zone hunts by day.
const periodOf = (ms: number): Period => {
  try {
    const h = new Date(ms).getHours()
    return h >= 22 || h < 5 ? 'night' : h < 8 ? 'dawn' : h < 18 ? 'day' : 'dusk'
  } catch {
    return 'day'
  }
}

// Long texts cut at every band may outgrow the limit; every other band then goes, until it fits.
const fittedSvg = (B: Band[], art: HudArt): string => {
  const source = hudSvg(B, art)
  if (source.length <= SVG_LIMIT || B.length < 2) return source
  const fewer = B.filter((_, i) => i % 2 === 0).map((b, i, kept) => ({ ...b, hi: kept[i + 1]?.lo ?? Infinity }))
  return fittedSvg(fewer, art)
}

const vitalityOf = (m: Measure) => (m.percent === undefined ? undefined : 100 - m.percent)

// The career as the store holds it: this session's own record, every other one, and the trophies.
const loadCareer = async ($: EngineInterface, id: string, xpBase: number): Promise<Career> => {
  const keys = await $.store.keys()
  let rolled = deedsOf(await $.store.get(ROLLED))
  let prior = NO_DEEDS
  const runs: [string, Deeds][] = []
  const trophies: Record<string, number> = {}
  for (const k of keys) {
    if (k === RUN + id) prior = deedsOf(await $.store.get(k))
    else if (k.startsWith(RUN)) runs.push([k, deedsOf(await $.store.get(k))])
    else if (k.startsWith(TROPHY)) {
      const at = await $.store.get(k)
      trophies[k.slice(TROPHY.length)] = typeof at === 'number' ? at : 0
    }
  }
  if (runs.length > ROLL_AT) {
    // The oldest records become one, written before they go, so a crash loses none.
    runs.sort((a, b) => a[1].lastAt - b[1].lastAt)
    const old = runs.splice(0, runs.length - KEEP_RUNS)
    rolled = old.reduce((all, [, d]) => join(all, d), rolled)
    await $.store.set(ROLLED, rolled)
    for (const [k] of old) await $.store.delete(k)
  }
  return { id, others: runs.reduce((all, [, d]) => join(all, d), rolled), prior, trophies, xpBase }
}

// What `register` was given, for the helpers below: the engine checks that a function handed `$`
// is one declared at the top of the file, so these live here and read it.
const config = { lang: 'en' as Lang, loudness: 1 }
const wordsNow = () => WORDS[config.lang]
const nNow = (x: number) => fmt(x, config.lang)
// The last clip heard and the last sign's, so a burst of casts is not a burst of sound.
let heard = { at: -Infinity, priority: 0 }
let lastSign = { key: null as SignKey | null, at: -Infinity }
let loading: Promise<void> | null = null

// A clip plays where the session is on show, never in a headless run; one that cannot play is silence.
const play = async ($: EngineInterface, sound: Sound) => {
  const loudness = config.loudness
  if (loudness === 0) return
  try {
    if (isMuted(sound, mutedNow(await read($, muted)))) return
    const now = await $.clock.now()
    const priority = priorityOf(sound)
    if (priority < heard.priority && now - heard.at < YIELD_SOUND_MS) return
    if (isSignKey(sound)) {
      if (now - lastSign.at < ANY_SIGN_MS || (sound === lastSign.key && now - lastSign.at < SAME_SIGN_MS)) return
      lastSign = { key: sound, at: now }
    }
    if ((await $.session.surfaces()).length === 0) return
    heard = { at: now, priority }
    await $.audio.play({ asset: `sounds/${sound}.wav` }, { gain: loudness * (isSignKey(sound) ? SIGN_GAIN : 1) })
  } catch {
    // No player, no surface, no sound.
  }
}

// A clip the person asked to hear in the settings: played at once, whatever is turned off, and
// at the quiet volume when all sound is off.
const listen = async ($: EngineInterface, sound: Sound) => {
  try {
    const loudness = config.loudness || LOUDNESS.quiet
    await $.audio.play({ asset: `sounds/${sound}.wav` }, { gain: loudness * (isSignKey(sound) ? SIGN_GAIN : 1) })
  } catch {
    // No player, no sound.
  }
}

// What the store holds of the kinds turned off, read as a session starts; nothing there yet, the
// default: a quest's end alone sounds.
const loadMuted = async ($: EngineInterface) => {
  try {
    const kept = await $.store.get(MUTED)
    const off = kept === undefined ? DEFAULT_MUTED : mutedNow(kept)
    await update($, muted, () => off)
  } catch {
    // The store unread, the session keeps what it had.
  }
}

// A kind (or a sign) turned off or on: for this session at once, and kept for the next.
const setMuted = async ($: EngineInterface, key: string, isOff: boolean) => {
  await update($, muted, list => {
    const rest = mutedNow(list).filter(k => k !== key)
    return isOff ? [...rest, key] : rest
  })
  try {
    await $.store.set(MUTED, await read($, muted))
  } catch {
    // Kept for this session only.
  }
}

// What a sound key is called in the settings: a kind's name, or a sign's.
const soundNameOf = (key: string) => (isSignKey(key) ? signName(key, config.lang) : wordsNow().sounds.group[key as SoundGroup].name)

// The settings as text, where no pane can be placed.
const soundText = async ($: EngineInterface) => {
  const w = wordsNow().sounds
  const off = mutedNow(await read($, muted))
  const rows = SOUND_GROUPS.map(g => `${off.includes(g) ? '✗' : '♪'} ${w.group[g].name} · ${w.state(!off.includes(g))}`)
  const signs = (Object.keys(SIGNS) as SignKey[]).filter(k => off.includes(k)).map(k => signName(k, config.lang))
  if (signs.length > 0) rows.push(`✗ ${signs.join(', ')}`)
  return [...(config.loudness === 0 ? [w.allOff] : []), ...rows, '', w.usage].join('\n')
}

// A moment plays after the ones queued before it, its sound as it begins.
const announce = async ($: EngineInterface, m: NewMoment) => {
  const now = await $.clock.now()
  const kind = kindOf(m)
  const isMajor = kind === 'level' || kind === 'trophy'
  const placed = { at: -1 }
  await update($, moments, list => {
    const live = (Array.isArray(list) ? list : []).filter(x => x.at + x.ms > now)
    const last = live.at(-1)
    const at = Math.max(now, last === undefined ? now : last.at + last.ms)
    if (live.length >= (isMajor ? MOMENTS_MAJOR : MOMENTS_MINOR) || (!isMajor && at - now > MOMENT_WAIT_MS)) return live
    placed.at = at
    return [...live, { ...m, at, ms: BANNER_MS[kind] } as Moment]
  })
  if (placed.at < 0) return
  const wait = placed.at - now
  if (wait <= 0) void play($, SOUND_OF[kind])
  else $.clock.after(wait, () => void play($, SOUND_OF[kind]))
}

// The career this session adds to, read from the store once per session id.
const ensureCareer = async ($: EngineInterface) => {
  try {
    const id = await $.session.id()
    const c = await read($, career)
    if (c !== null && c.id === id) return
    loading ??= (async () => {
      const loaded = await loadCareer($, id, c?.xpBase ?? 0)
      await update($, career, was => ({ ...loaded, trophies: { ...(was?.trophies ?? {}), ...loaded.trophies } }))
    })().finally(() => {
      loading = null
    })
    await loading
  } catch {
    // No store: the career is this session alone.
  }
}

// This session's record; a headless run, which shows no HUD, keeps none.
const save = async ($: EngineInterface) => {
  try {
    if ((await $.session.surfaces()).length === 0) return
    await ensureCareer($)
    const c = await read($, career)
    if (c === null || c.id === '') return
    await $.store.set(RUN + c.id, runOf(c, await read($, deeds), await read($, totals)))
  } catch {
    // Kept in the session; the next save tries again.
  }
}

// Each trophy the deeds have earned and nobody has yet: kept for good, toasted, played out.
const earn = async ($: EngineInterface) => {
  const lang = config.lang
  const words = wordsNow()
  try {
    const c = careerNow(await read($, career))
    const whole = wholeOf(c, await read($, deeds), await read($, totals))
    const level = levelOf(whole.xp).level
    const fresh = TROPHIES.filter(r => c.trophies[r.key] === undefined && isEarned(r, whole, level))
    if (fresh.length === 0) return
    const now = await $.clock.now()
    for (const r of fresh) {
      let isKnown = false
      try {
        isKnown = (await $.store.get(TROPHY + r.key)) !== undefined
        if (!isKnown) await $.store.set(TROPHY + r.key, now)
      } catch {
        // Earned in this session all the same.
      }
      await update($, career, was => {
        const at = careerNow(was)
        return { ...at, trophies: { ...at.trophies, [r.key]: now } }
      })
      if (isKnown) continue
      const t = TROPHY_WORDS[lang][r.key]
      $.ui.toast(words.trophyToast(t.name, t.does))
      await announce($, { kind: 'trophy', trophy: r.key })
    }
  } catch {
    // A trophy waits for the next deed.
  }
}

// A failed call meets a monster of its kind; the next one of that kind to land slays it.
const hunted = async ($: EngineInterface, tool: string, input: Record<string, unknown>, isError: boolean, at: number) => {
  const monster = monsterOf(tool, input)
  const isHunted = (await read($, hunt))[monster] !== undefined
  if (isError && !isHunted) {
    await update($, hunt, h => ({ ...h, [monster]: at }))
    await update($, deeds, d => ({ ...d, met: one(d.met, monster) }))
    await announce($, { kind: 'monster', monster, detail: detailOf(input, tool) })
  } else if (!isError && isHunted) {
    await update($, hunt, h => Object.fromEntries(Object.entries(h).filter(([k]) => k !== monster)))
    await update($, deeds, d => ({ ...d, slain: one(d.slain, monster) }))
    await announce($, { kind: 'slain', monster })
  }
}

const bannerOf = (m: Moment): Banner => {
  const lang = config.lang
  const words = wordsNow()
  const n = nNow
  const at = { at: m.at, ms: m.ms }
  const w = words.moment
  switch (m.kind) {
    case 'quest':
      return m.status === 'done'
        ? { kind: 'quest-done', ...at, title: w.questDone, line: m.title || words.newQuest, ...(m.xp > 0 ? { xp: w.xp(n(m.xp)) } : {}) }
        : { kind: 'quest-failed', ...at, title: w.questFailed, line: m.title || words.newQuest }
    case 'levelUp':
      return { kind: 'level', ...at, title: w.levelUp(m.level), line: w.levelLine(titleOf(m.level, lang)) }
    case 'monster': {
      const beast = MONSTER_WORDS[lang][m.monster]
      return { kind: 'monster', ...at, title: beast.name, line: m.detail ? w.monsterLine(m.detail) : beast.lore }
    }
    case 'slain':
      return { kind: 'slain', ...at, title: w.slain, line: w.slainLine(MONSTER_WORDS[lang][m.monster].name) }
    case 'trophy': {
      const t = TROPHY_WORDS[lang][m.trophy]
      return { kind: 'trophy', ...at, title: w.trophy, line: `${t.name} · ${t.does}` }
    }
    case 'restored':
      return { kind: 'restored', ...at, title: w.restored, line: w.restoredLine(m.to), restore: { from: m.from, to: m.to } }
  }
}

const sheet = async ($: EngineInterface) => {
  const lang = config.lang
  const words = wordsNow()
  const n = nNow
  const w = words.sheet
  const j = words.journal
  const t = await read($, totals)
  const m = await read($, measure)
  const a = await read($, adrenaline)
  const c = careerNow(await read($, career))
  const whole = wholeOf(c, await read($, deeds), t)
  const lv = levelOf(whole.xp, lang)
  const v = vitalityOf(m)
  const context = m.tokens !== undefined && m.window ? ` (${w.context(n(m.tokens), n(m.window))})` : ''
  const rows: [string, string][] = [
    [w.vitality, `${v === undefined ? '—' : `${v}%`}${context}`],
    [w.stamina, m.stamina === undefined ? '—' : w.staminaLeft(Math.round(m.stamina))],
    [w.adrenaline, `${adrenalineOf(a.streak)}/3 (${w.streak(a.streak)})`],
    [w.experience, `${w.toLevel(n(lv.into), n(lv.need), lv.level + 1)} · ${j.thisSession(n(sessionXpOf(c, t)))}`],
    [w.crowns, m.usd === undefined ? '—' : `$${money(m.usd, lang)}`],
    [w.tokens, `↑${n(t.input + t.cacheWrite)} ↓${n(t.output)} · ${w.cache} ${n(t.cacheRead)} · ${w.contracts(t.calls)}`],
  ]
  const pad = Math.max(...rows.map(([label]) => label.length)) + 2
  return [
    `${lv.title} · ${w.level} ${lv.level}`,
    ...rows.map(([label, value]) => label.padEnd(pad) + value),
    '',
    j.career(whole.quests, sum(whole.slain), sum(whole.casts), whole.days.length),
    j.trophies(Object.keys(c.trophies).length, TROPHIES.length),
  ].join('\n')
}

// One drawing of the desktop HUD: what it shows (`key`), its source and alt text, and when it was made.
type Frame = { key: string; source: string; alt: string; at: number }

export const register: Register = (on, options) => {
  const lang = langOf(options.language)
  const theme = themeOf(options.theme)
  const loudness = LOUDNESS[soundLevelOf(options.sound)]
  const words = WORDS[lang]
  const n = (x: number) => fmt(x, lang)
  config.lang = lang
  config.loudness = loudness
  // The desktop draws an interactive Svg in a frame, and a new source is a new frame, blank until it
  // loads: drawn in place of the old one, the HUD would blink on every update. So `base`, the frame on
  // show, stays as it is, and a newer one, `top`, is laid over it until it has loaded.
  let base: Frame | null = null
  let top: Frame | null = null
  // When the first moment drawn ends and a redraw moves the window of moments on.
  let wakeAt = 0
  on('session.start', async ($, e, next) => {
    $.ui.status(undefined)
    // A reload drops the timers that end these, so they start over here.
    await update($, ghost, () => null)
    await update($, levelUp, () => null)
    await $.command.register({
      name: 'hud',
      description: words.command,
      argumentHint: '[journal | stats | sound [on|quiet|off] | sound <kind> on|off | lang en|ru | theme auto|dark|light]',
    })
    await ensureCareer($)
    await loadMuted($)
    return next(e)
  })

  // The run ends: kept in the store. After a /clear or a resume the process goes on as another session.
  on('session.end', async ($, e, next) => {
    try {
      await save($)
      if (e.reason === 'clear' || e.reason === 'resume') {
        const t = await read($, totals)
        await update($, career, c => ({ ...careerNow(c), id: '', xpBase: xpOf(t) }))
        await update($, deeds, () => NO_DEEDS)
        await update($, journal, () => [])
        await update($, hunt, () => ({}))
      }
    } catch {
      // Ending stays fast.
    }
    return next(e)
  })

  on('command.run', { command: 'hud' }, async ($, e) => {
    const args = e.args.trim()
    if (args === 'stats') return { text: await sheet($) }
    if (args === 'journal') {
      const r = await $.ui.open({ id: JOURNAL, title: words.journal.title })
      return { text: r.isPlaced ? words.journal.opened : words.journal.notPlaced }
    }
    const chosen = /^lang(?:uage)?\s+(en|ru)$/i.exec(args)?.[1]
    if (chosen !== undefined) {
      const to = langOf(chosen.toLowerCase())
      // Written to the plugin's options in settings, which reloads the HUD in that language.
      const r = await $.config.set({ key: `${$.plugin.name}.language`, value: to })
      return { text: r.deny ?? WORDS[to].language }
    }
    const look = /^theme\s+(auto|dark|light)$/i.exec(args)?.[1]
    if (look !== undefined) {
      const to = themeOf(look.toLowerCase())
      const r = await $.config.set({ key: `${$.plugin.name}.theme`, value: to })
      return { text: r.deny ?? words.theme[to] }
    }
    const hear = /^sound\s+(on|quiet|off)$/i.exec(args)?.[1]
    if (hear !== undefined) {
      const to = soundLevelOf(hear.toLowerCase())
      const r = await $.config.set({ key: `${$.plugin.name}.sound`, value: to })
      return { text: r.deny ?? words.sound[to] }
    }
    if (/^sound$/i.test(args)) {
      const r = await $.ui.open({ id: SOUND_PANE, title: words.sounds.title })
      return { text: r.isPlaced ? words.sounds.opened : await soundText($) }
    }
    const [, which = '', state = ''] = /^sound\s+(\S+)\s+(on|off)$/i.exec(args) ?? []
    const key = which.toLowerCase()
    if (SOUND_KEYS.includes(key)) {
      const isOff = state.toLowerCase() === 'off'
      await setMuted($, key, isOff)
      return { text: (isOff ? words.sounds.muted : words.sounds.unmuted)(soundNameOf(key)) }
    }
    if (/^sound\b/i.test(args)) return { text: await soundText($) }
    await update($, isHidden, v => !v)
    return { text: (await read($, isHidden)) ? words.sheathed : words.drawn }
  })

  // A prompt is a new quest, named after its first line; a subagent's prompt is part of the one at hand.
  on('turn.start', async ($, e, next) => {
    // Engines before 2.1.31x raised it for the main loop alone, and had no `agentId` on it.
    if ((e as { agentId?: string }).agentId !== undefined) return next(e)
    await ensureCareer($)
    const xp = xpOf(await read($, totals))
    const title = questTitle(e.text)
    await update($, quest, q => ({ title: title || questNow(q).title, status: 'active' as const, xpAtStart: xp, xpGained: 0 }))
    await update($, sign, () => null)
    // Adrenaline fades a point between quests.
    await update($, adrenaline, a => ({ streak: Math.max(0, a.streak - STREAK_PER_POINT) }))
    const now = await $.clock.now()
    await update($, deeds, d => ({ ...d, firstAt: d.firstAt || now, lastAt: now }))
    // A turn with no prompt of its own carries on the last quest.
    const named = title || questNow(await read($, quest)).title || words.newQuest
    await update($, journal, list => {
      const last = list.at(-1)
      if (title === '' && last !== undefined) return [...list.slice(0, -1), { ...last, status: 'active' as const, endedAt: null }]
      return [...list, { title: named, status: 'active' as const, xp: 0, startedAt: now, endedAt: null, casts: 0 }].slice(-JOURNAL_SIZE)
    })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const at = await $.clock.now()
    const key = signOf(tool)
    const input = e as unknown as Record<string, unknown>
    await update($, sign, () => ({ key, detail: detailOf(input, tool), at }))
    void play($, key)
    const r = await next(e)
    // A refusal is the person's call, not a hit: only a tool that failed costs the streak.
    if (r.deny === undefined) {
      try {
        const isError = r.isError === true
        await update($, adrenaline, a => ({ streak: isError ? 0 : a.streak + 1 }))
        const streak = (await read($, adrenaline)).streak
        await update($, deeds, d => ({ ...d, casts: one(d.casts, key), bestStreak: Math.max(d.bestStreak, streak), lastAt: at }))
        await update($, journal, list => {
          const last = list.at(-1)
          return last === undefined || last.endedAt !== null ? list : [...list.slice(0, -1), { ...last, casts: last.casts + 1 }]
        })
        await hunted($, tool, input, isError, at)
        await earn($)
      } catch {
        // The tool's result goes back as it came.
      }
    }
    return r
  }).catch(($, e, next) => next(e)) // A HUD never blocks a tool.

  // Every model request, main thread and subagents alike.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    const u = r.usage
    if (u) {
      const c = careerNow(await read($, career))
      const before = levelOf(careerXpOf(c, await read($, totals))).level
      await update($, totals, t => ({
        input: t.input + u.input_tokens,
        output: t.output + u.output_tokens,
        cacheRead: t.cacheRead + u.cache_read_input_tokens,
        cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
        calls: t.calls + 1,
      }))
      const after = levelOf(careerXpOf(careerNow(await read($, career)), await read($, totals)), lang)
      if (after.level > before) {
        $.ui.toast(words.levelUp(after.level, after.title))
        await update($, levelUp, () => after.level)
        $.clock.after(LEVEL_UP_MS, () => void update($, levelUp, l => (l === after.level ? null : l)))
        await announce($, { kind: 'levelUp', level: after.level })
        await earn($)
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
      try {
        const q = questNow(await read($, quest))
        const now = await $.clock.now()
        const local = localOf(now)
        await update($, deeds, d =>
          status === 'done'
            ? {
                ...d,
                quests: d.quests + 1,
                biggestQuest: Math.max(d.biggestQuest, q.xpGained),
                nightQuests: d.nightQuests + (isNight(local.hour) ? 1 : 0),
                days: d.days.includes(local.day) ? d.days : [...d.days, local.day],
                lastAt: now,
              }
            : { ...d, failed: d.failed + (status === 'failed' ? 1 : 0), lastAt: now },
        )
        await update($, journal, list => {
          const last = list.at(-1)
          return last === undefined ? list : [...list.slice(0, -1), { ...last, status, xp: last.xp + q.xpGained, endedAt: now }]
        })
        if (status === 'done' || status === 'failed') await announce($, { kind: 'quest', status, title: q.title, xp: q.xpGained })
        await save($)
        await earn($)
      } catch {
        // The quest is told in the tracker all the same.
      }
    }
    return r
  })

  // A compaction is a meditation: the witcher sits by the fire while the journal is condensed.
  // A precompute runs unseen and installs nothing, so the witcher does not sit down for it.
  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)
    const at = await $.clock.now()
    await update($, meditating, () => at)
    void play($, 'meditate')
    let isDone = false
    try {
      const r = await next(e)
      isDone = !('skip' in r && typeof r.skip === 'string')
      return r
    } finally {
      try {
        await update($, meditating, () => null)
        if (isDone) {
          await update($, deeds, d => ({ ...d, meditations: d.meditations + 1 }))
          await save($)
          await earn($)
        }
      } catch {
        // The meditation is over all the same.
      }
    }
  }).catch(($, e, next) => next(e))

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
      $.ui.toast(words.lowVitality(v))
      void play($, 'danger')
    }
    if (v !== undefined && was !== undefined && v - was >= 25) {
      $.ui.toast(words.meditated(v))
      await announce($, { kind: 'restored', from: was, to: v })
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
    const c = careerNow(await read($, career))
    const lv = levelOf(careerXpOf(c, t), lang)
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
    // Read so that the redraw a new frame asks for takes the old one away.
    await read($, settled)
    const list = await read($, moments)
    const med = await read($, meditating)
    const now = await $.clock.now()
    const w = words.sheet
    const crowns = usd === null ? null : money(usd, lang)
    const castAt = shown !== null && s?.at !== undefined ? s.at : null
    const ghostAt = ghostFrom !== null && g !== null ? g.id : null
    const context = m.tokens !== undefined && m.window ? ` · ${w.context(n(m.tokens), n(m.window))}` : ''
    const tips = {
      vitality: `${w.vitality} ${vitality}%${context}`,
      stamina: stamina === null ? '' : `${w.stamina}: ${w.staminaLeft(Math.round(stamina))}`,
      adrenaline: `${w.adrenaline} ${points}/3 · ${w.streak(a.streak)}`,
      level: `${lv.title} · ${w.level} ${lv.level} · ${w.toLevel(n(lv.into), n(lv.need), lv.level + 1)}`,
    }
    const cast = q.status === 'active' && s !== null ? { key: s.key, name: signName(s.key, lang), detail: s.detail } : null
    const sheetTitle = words.hover.title(lv.title, lv.level)
    const sheetStats = [
      `${w.experience} ${n(lv.into)} / ${n(lv.need)}`,
      `↑${n(t.input + t.cacheWrite)} ↓${n(t.output)}`,
      `${w.cache} ${n(t.cacheRead)}`,
      w.contracts(t.calls),
    ].join(' · ')
    const shows = {
      theme,
      sign: shown,
      isWorking: e.props.isWorking,
      vitality,
      ghostFrom,
      stamina,
      adrenaline: points,
      level: lv.level,
      xpFraction,
      isLevelUp: leveledTo !== null,
      tips,
      line,
      cast,
      crowns,
      sheet: { title: sheetTitle, stats: sheetStats },
    }
    // The effects, each on its own clock: the sign's burst while it lasts, the hit while the ghost
    // drains, the moments still to play or playing, the meditation, and the hour's light.
    const hitBy = g !== null && ghostFrom !== null ? Math.round(g.from - g.to) : 0
    const live = (Array.isArray(list) ? list : []).filter(x => x.at + x.ms > now)
    const first = live[0]
    if (live.length > MOMENTS_DRAWN && first !== undefined && wakeAt !== first.at + first.ms) {
      wakeAt = first.at + first.ms
      $.clock.after(Math.max(0, wakeAt - now) + 20, () => void update($, settled, k => k + 1))
    }
    const effects: Omit<FxArt, 'now'> = {
      spell: shown !== null && castAt !== null && now - castAt < SPELL_MS[shown] + 200 ? { key: shown, at: castAt } : null,
      hit: g !== null && hitBy >= HIT_AT && now - g.id < HIT_MS + 200 ? { at: g.id, delta: hitBy } : null,
      banners: live.slice(0, MOMENTS_DRAWN).map(bannerOf),
      meditating: med === null ? null : { at: med, title: words.moment.meditating, line: words.moment.meditatingLine },
      period: periodOf(now),
    }
    // What the HUD shows, and the motions' starts: a redraw with the same key keeps its frame.
    const key = JSON.stringify([shows, castAt, ghostAt, effects])
    const draw = (): Frame => {
      // One drawing for every width: it reads its own frame's width, so the band's reported columns
      // (which a redraw may report in passing) never change what is drawn.
      const source = fittedSvg(bands({ hasStamina: stamina !== null, crowns }), {
        ...shows,
        isCasting: castAt !== null && now - castAt < CAST_MS,
        clock: { now, castAt, ghostAt },
        fx: { now, ...effects },
      })
      const alt = [
        `${words.alt.vitality} ${vitality}%`,
        stamina === null ? '' : `${words.alt.stamina} ${Math.round(stamina)}%`,
        words.alt.adrenaline(points),
        `${words.alt.level} ${lv.level}`,
        crowns === null ? '' : `${words.alt.crowns} ${crowns}`,
        `${line.title}: ${line.objective}`,
      ]
        .filter(Boolean)
        .join(', ')
      return { key, source, alt, at: now }
    }
    const newest = top ?? base
    if (newest === null) base = draw()
    else if (newest.key !== key) {
      // A top frame this old has loaded and is on show; one younger is still loading, and the new
      // one takes its place over the same base.
      if (top !== null && now - top.at >= LOAD_MS) base = top
      top = draw()
      $.clock.after(SETTLE_MS + 50, () => void update($, settled, k => k + 1))
    } else if (top !== null && now - top.at >= SETTLE_MS) {
      base = top
      top = null
    }
    const shownBase = base ?? draw()
    // The desktop draws an interactive Svg as a frame styled `width: <width>px; max-width: 100%`, and
    // a frame given no width is the browser's default 300px. So the frame is asked for MAX_W and
    // the band's own width holds it to the band: it fills the band up to MAX_W, at a width that no
    // reported column count sets, and the drawing inside reads that width.
    // A redraw keeps a frame whose element is unchanged and does not move it, so the base frame
    // stays where it is, in the flow; the top one lies over it, absolute, and turns into the base in place.
    return (
      <Box key="witcher-hud" width="100%" overflow="hidden">
        <Box width="100%">
          <Svg source={shownBase.source} alt={shownBase.alt} width={MAX_W} height={H} isInteractive />
        </Box>
        {top === null ? null : (
          <Box position="absolute" top={0} left={0} width="100%">
            <Svg source={top.source} alt={top.alt} width={MAX_W} height={H} isInteractive />
          </Box>
        )}
      </Box>
    )
  })

  // The witcher's journal: the career, this session's quests, the bestiary, the trophies, the signs.
  on('ui.render', { component: 'Pane', requestId: JOURNAL }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const j = words.journal
    const t = await read($, totals)
    const c = careerNow(await read($, career))
    const whole = wholeOf(c, await read($, deeds), t)
    const lv = levelOf(whole.xp, lang)
    const quests = (await read($, journal)).slice().reverse()
    const hunting = await read($, hunt)
    const room = Math.max(24, e.props.bodyColumns)
    const barWidth = Math.max(8, Math.min(36, room - 26))
    const filled = Math.round((barWidth * lv.into) / lv.need)
    const mark: Record<QuestStatus, [string, string]> = {
      done: ['✓', GOLD],
      failed: ['✗', BLOOD],
      abandoned: ['○', ASH],
      active: ['◆', GOLD_HI],
      idle: ['·', ASH],
    }
    const earned = TROPHIES.filter(r => c.trophies[r.key] !== undefined)
    const locked = TROPHIES.filter(r => c.trophies[r.key] === undefined)
    const heading = (text: string) => (
      <Text bold color={GOLD}>
        {text}
      </Text>
    )
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>{`◈ ${lv.title} · ${words.sheet.level} ${lv.level}`}</Text>
          <Box flexDirection="row" gap={1}>
            <Text color={GOLD}>{'━'.repeat(filled)}</Text>
            <Text dimColor>{'─'.repeat(barWidth - filled)}</Text>
            <Text dimColor>{`${n(lv.into)} / ${n(lv.need)}`}</Text>
          </Box>
          <Text dimColor>{j.career(whole.quests, sum(whole.slain), sum(whole.casts), whole.days.length)}</Text>
          <Text dimColor>{j.thisSession(n(sessionXpOf(c, t)))}</Text>
        </Box>

        <Box flexDirection="column">
          {heading(j.session)}
          {quests.length === 0 ? <Text dimColor>{j.noQuests}</Text> : null}
          {quests.map(entry => (
            <Box flexDirection="row" gap={1}>
              <Text color={mark[entry.status][1]}>{mark[entry.status][0]}</Text>
              <Text dimColor={entry.status === 'abandoned'}>{clip(entry.title, room - 14)}</Text>
              {entry.xp > 0 ? <Text dimColor>{words.moment.xp(n(entry.xp))}</Text> : null}
            </Box>
          ))}
        </Box>

        <Box flexDirection="column">
          {heading(j.bestiary)}
          {MONSTERS.map(k => {
            const beast = MONSTER_WORDS[lang][k]
            const met = whole.met[k] ?? 0
            if (met === 0)
              return (
                <Box flexDirection="row" gap={1}>
                  <Text dimColor>{`☐ ${beast.name}`}</Text>
                  <Text dimColor>{`· ${j.unknown}`}</Text>
                </Box>
              )
            return (
              <Box flexDirection="column">
                <Box flexDirection="row" gap={1}>
                  <Text bold>{`☒ ${beast.name}`}</Text>
                  <Text dimColor>{`· ${j.met(met)} · ${j.slain(whole.slain[k] ?? 0)}`}</Text>
                  {hunting[k] !== undefined ? <Text color={BLOOD}>{`· ${j.hunting}`}</Text> : null}
                </Box>
                <Text dimColor>{`  ${beast.lore}`}</Text>
              </Box>
            )
          })}
        </Box>

        <Box flexDirection="column">
          {heading(j.trophies(earned.length, TROPHIES.length))}
          {earned.map(r => (
            <Box flexDirection="row" gap={1}>
              <Text color={GOLD}>★</Text>
              <Text bold>{TROPHY_WORDS[lang][r.key].name}</Text>
              <Text dimColor>{`· ${TROPHY_WORDS[lang][r.key].does}`}</Text>
            </Box>
          ))}
          {locked.map(r => {
            const [have, need] = r.progress(whole, lv.level)
            return (
              <Box flexDirection="row" gap={1}>
                <Text dimColor>☆</Text>
                <Text dimColor>{`${TROPHY_WORDS[lang][r.key].name} · ${TROPHY_WORDS[lang][r.key].does} · ${n(Math.min(have, need))}/${n(need)}`}</Text>
              </Box>
            )
          })}
        </Box>

        <Box flexDirection="column">
          {heading(j.signs)}
          <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
            {(Object.keys(SIGNS) as SignKey[]).map(k => (
              <Box flexDirection="row" gap={1}>
                <Text color={SIGNS[k].color}>{SIGNS[k].glyph}</Text>
                <Text>{`${signName(k, lang)} ${n(whole.casts[k] ?? 0)}`}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    )
  })

  // The sound settings: the volume, and each kind of sound turned on or off, with a sample to hear.
  on('ui.render', { component: 'Pane', requestId: SOUND_PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const w = words.sounds
    const off = mutedNow(await read($, muted))
    const level = soundLevelOf(options.sound)
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          <Text bold color={GOLD}>
            {w.volume}
          </Text>
          {(['on', 'quiet', 'off'] as const).map(to => (
            <Button
              key={`volume:${to}`}
              label={w.level[to]}
              variant={to === level ? 'primary' : 'secondary'}
              onPress={() => void $.config.set({ key: `${$.plugin.name}.sound`, value: to })}
            />
          ))}
        </Box>
        {level === 'off' ? <Text dimColor>{w.allOff}</Text> : null}

        {SOUND_GROUPS.map(g => {
          const isOn = !off.includes(g)
          return (
            <Box key={`kind:${g}`} flexDirection="column">
              <Box flexDirection="row" gap={1} flexWrap="wrap">
                <Text color={isOn ? GOLD : ASH}>{isOn ? '♪' : '✗'}</Text>
                <Text bold={isOn} dimColor={!isOn}>
                  {w.group[g].name}
                </Text>
                <Text dimColor>{`· ${w.group[g].when}`}</Text>
              </Box>
              <Box flexDirection="row" gap={1} flexWrap="wrap">
                <Text> </Text>
                <Button key={`toggle:${g}`} label={isOn ? w.turnOff : w.turnOn} onPress={() => void setMuted($, g, isOn)} />
                <Button key={`listen:${g}`} label={w.listen} dimColor onPress={() => void listen($, SAMPLE_OF[g])} />
              </Box>
              {g === 'signs' && isOn ? (
                <Box flexDirection="row" gap={1} flexWrap="wrap">
                  <Text> </Text>
                  {(Object.keys(SIGNS) as SignKey[]).map(k => {
                    const isSignOn = !off.includes(k)
                    return (
                      <Button
                        key={`toggle:${k}`}
                        plain
                        dimColor={!isSignOn}
                        label={`${isSignOn ? SIGNS[k].glyph : '✗'} ${signName(k, lang)}`}
                        onPress={() => void setMuted($, k, isSignOn)}
                      />
                    )
                  })}
                </Box>
              ) : null}
            </Box>
          )
        })}
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
