// The terminal HUD: one row of cells, animated on the terminal's own frame clock.
import type { ClientModule, RenderElement, TextProps } from 'claude-code'

export type TerminalHud = {
  columns: number
  glyph: string
  tint: string
  halo: string
  isWorking: boolean
  vitality: number
  ghostFrom: number | null
  ghostId: number
  stamina: number | null
  adrenaline: number
  level: number
  xpFraction: number
  usd: number | null
  title: string
  objective: string
  tone: 'active' | 'done' | 'failed' | 'idle'
}

const RED = '#B8322A'
const RED_HI = '#E8503F'
const RED_TRACK = '#2E110D'
const GHOST = '#E9A397'
const YELLOW = '#E3B341'
const YELLOW_TRACK = '#3A3112'
const GOLD = '#C9A55C'
const PARCHMENT = '#E6DCC3'
const ORB = '#F3E6C4'
const DIM = '#5E5649'
const TONE = { active: PARCHMENT, done: GOLD, failed: '#D27466', idle: '#8F8778' }

const TICK_MS = 90
const DRAIN_DELAY = 5
const DRAIN_TICKS = 9
const LOW = 20

type Ref = { p: TerminalHud; tick: number; ghostId: number; ghostAt: number }
type State = { ref: Ref; frame: number }

const isAnimating = (r: Ref) =>
  r.p.isWorking || r.tick - r.ghostAt <= DRAIN_DELAY + DRAIN_TICKS || r.p.vitality <= LOW

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const clip = (s: string, n: number) => (s.length <= n ? s : n <= 1 ? '' : s.slice(0, n - 1).trimEnd() + '…')

// Two bars in one row of cells: the cell's background is vitality, a lower-quarter block on it stamina.
const barCells = (p: TerminalHud, width: number, tick: number, sinceHit: number) => {
  const filled = Math.round((width * clamp(p.vitality, 0, 100)) / 100)
  const progress = clamp((sinceHit - DRAIN_DELAY) / DRAIN_TICKS, 0, 1)
  const ghostEnd = p.ghostFrom === null ? p.vitality : p.ghostFrom + (p.vitality - p.ghostFrom) * progress
  const ghost = Math.max(filled, Math.round((width * clamp(ghostEnd, 0, 100)) / 100))
  const stamina = p.stamina === null ? -1 : Math.round((width * clamp(p.stamina, 0, 100)) / 100)
  const red = p.vitality <= LOW && tick % 12 < 2 ? RED_HI : RED
  const runs: { bg: string; fg: string; ch: string; n: number }[] = []
  for (let i = 0; i < width; i++) {
    const bg = i < filled ? red : i < ghost ? GHOST : RED_TRACK
    const cell = p.stamina === null ? { bg, fg: bg, ch: ' ' } : { bg, fg: i < stamina ? YELLOW : YELLOW_TRACK, ch: '▂' }
    const last = runs[runs.length - 1]
    if (last && last.bg === cell.bg && last.fg === cell.fg) last.n += 1
    else runs.push({ ...cell, n: 1 })
  }
  return runs
}

const TerminalHudView: ClientModule<TerminalHud, State> = (p, surface) => {
  let state = surface.state
  if (state === undefined) {
    const ref: Ref = { p, tick: 0, ghostId: p.ghostId, ghostAt: -1000 }
    state = { ref, frame: 0 }
    surface.every(TICK_MS, () => {
      ref.tick += 1
      if (isAnimating(ref)) surface.setState({ ref, frame: ref.tick })
    })
    surface.setState(state)
  }
  const r = state.ref
  r.p = p
  if (p.ghostId !== r.ghostId) {
    r.ghostId = p.ghostId
    r.ghostAt = r.tick
  }

  const { Box, Text } = surface.elements
  const text = (children: string, props: TextProps = {}) => Text({ ...props, children })
  const columns = surface.columns > 0 ? surface.columns : p.columns
  const parts: RenderElement[] = []

  // The medallion hums while Claude works.
  const isLit = p.isWorking && Math.floor(r.tick / 3) % 2 === 1
  parts.push(text(` ${p.glyph} `, { color: isLit ? p.halo : p.tint, bold: true }))

  const barWidth = clamp(Math.round(columns * 0.16), 10, 24)
  for (const run of barCells(p, barWidth, r.tick, r.tick - r.ghostAt)) {
    parts.push(text(run.ch.repeat(run.n), { color: run.fg, backgroundColor: run.bg }))
  }
  const pct = ` ${Math.round(p.vitality)}%`
  parts.push(text(pct, { color: p.vitality <= LOW ? RED_HI : PARCHMENT }))

  const points = clamp(p.adrenaline, 0, 3)
  parts.push(text('  '), text('◆'.repeat(points), { color: ORB }), text('◇'.repeat(3 - points), { color: DIM }))

  const level = `  Lv ${p.level} `
  const xpCells = 6
  const xpFull = Math.round(xpCells * clamp(p.xpFraction, 0, 1))
  const crowns = p.usd === null ? '' : `  ⛁ ${p.usd.toFixed(2)}`

  const used = 3 + barWidth + pct.length + 5
  let room = columns - used - level.length - xpCells - crowns.length - 2
  const showCrowns = crowns !== '' && room >= 14
  if (!showCrowns) room += crowns.length
  const showLevel = room >= 14
  if (!showLevel) room += level.length + xpCells

  if (showLevel) {
    parts.push(
      text(level, { color: GOLD, bold: true }),
      text('━'.repeat(xpFull), { color: GOLD }),
      text('─'.repeat(xpCells - xpFull), { color: DIM }),
    )
  }
  if (showCrowns) parts.push(text(crowns, { color: YELLOW }))

  // The quest tracker takes what is left: the objective whole first, then as much of the quest's name as fits.
  if (room >= 8) {
    parts.push(text('  '))
    const titleRoom = Math.min(p.title.length, room - 3 - p.objective.length)
    const showTitle = p.title !== '' && titleRoom >= Math.min(12, p.title.length)
    if (showTitle) parts.push(text(clip(p.title, titleRoom), { color: GOLD }))
    parts.push(text(showTitle ? ' ◆ ' : '◆ ', { color: GOLD }))
    const left = room - (showTitle ? titleRoom + 3 : 2)
    parts.push(text(clip(p.objective, left), { color: TONE[p.tone], wrap: 'truncate-end' }))
  }

  return Box({ flexDirection: 'row', children: parts })
}

export default TerminalHudView
