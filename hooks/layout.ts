// The desktop HUD's geometry, in one place: every drawn thing is a box placed on one grid.
// The rules the art keeps, and tests/geometry.test.ts checks:
// - every group is centred on the midline, MID;
// - groups along the row are GAP apart, edge to edge;
// - fills, tracks and the seam between the drawings sit on whole pixels, 1px strokes on half pixels;
// - text is measured with the embedded title font's own advances, then cut to the room it has.
import { TITLE_ADVANCE, TITLE_CHARS, TITLE_METRICS } from './font'

export const H = 44
export const MID = 22
export const PLATE_TOP = 6
export const PLATE_BOTTOM = 38
export const GAP = 10
// The plate's pointed right end.
export const TIP = 12
export const MAX_W = 960

// The narrowest band the drawing is laid out for; a narrower one shows its left end.
export const MIN_W = 240
// The desktop drawing is laid out at every STEP of width, and where a tier changes.
export const STEP = 16

export const SIZE = { title: 14, body: 12.5, vit: 13, sta: 10.5, level: 13, sign: 9.5, mono: 10.5, crowns: 12.5 } as const
export const SIGN_SPACING = 1
// The quest's title is drawn a little spaced, and measured so.
export const TITLE_SPACING = 0.2
// SF Mono and Menlo advance 0.6 em; a little over, so a cut never runs long.
const MONO_EM = 0.61

export type Box = { x: number; y: number; w: number; h: number }

const ADVANCE = new Map<string, number>(Array.from(TITLE_CHARS, (ch, i) => [ch, TITLE_ADVANCE[i] ?? 600]))
// A character the subset lacks falls back to a system serif: counted wide.
const FALLBACK_ADVANCE = 620

export const textWidth = (s: string, size: number, spacing = 0) => {
  let em = 0
  for (const ch of s) em += ADVANCE.get(ch) ?? FALLBACK_ADVANCE
  return (em / 1000) * size + spacing * [...s].length
}

export const monoWidth = (s: string, size: number) => [...s].length * MONO_EM * size

export const capHeight = (size: number) => (TITLE_METRICS.capHeight / 1000) * size

// The baseline that centres a run's capitals and figures on y.
export const baselineAt = (centre: number, size: number) => round2(centre + capHeight(size) / 2)

// The box a run of capitals takes, its left edge at x.
export const capBox = (x: number, centre: number, width: number, size: number): Box => ({
  x,
  y: round2(centre - capHeight(size) / 2),
  w: round2(width),
  h: round2(capHeight(size)),
})

const round2 = (n: number) => Math.round(n * 100) / 100

// Cut a text to a width, at a word where one is near, with an ellipsis.
// The width of a cut grows with its length, so the longest cut that fits is found by halving.
export const fitText = (s: string, room: number, measure: (t: string) => number): string => {
  if (measure(s) <= room) return s
  const chars = [...s]
  const fits = (k: number) => measure(chars.slice(0, k).join('').trimEnd() + '…') <= room
  let n = 0
  let top = chars.length - 1
  while (n < top) {
    const k = (n + top + 1) >> 1
    if (fits(k)) n = k
    else top = k - 1
  }
  if (n <= 0) return ''
  const cut = chars.slice(0, n).join('')
  const space = cut.lastIndexOf(' ')
  return (space > cut.length * 0.6 ? cut.slice(0, space) : cut).trimEnd() + '…'
}

// Text rows of the quest and the sheet: a title above, a line below, mirrored about MID.
export const ROW_TITLE = MID - 7
export const ROW_LINE = MID + 7

export type LayoutInput = {
  width: number
  hasStamina: boolean
  // The crowns as drawn ("1.87"), or null where the session has no cost yet.
  crowns: string | null
}

export type Layout = {
  width: number
  // Where the character drawing ends and the quest drawing begins: a whole pixel.
  split: number
  isCompact: boolean
  medallion: { cx: number; cy: number; ring: number; box: Box }
  vit: Box
  sta: Box | null
  // Each figure is centred on its own bar, not on MID; the box is for overlap checks.
  numbers: { x: number; vitCentre: number; staCentre: number; box: Box }
  pips: { cx: number; cys: [number, number, number]; half: number; box: Box }
  badge: { cx: number; cy: number; ring: number; inner: number; box: Box }
  divider: { x: number; top: number; bottom: number; box: Box } | null
  quest: { x: number; right: number; glyph: Box; textX: number } | null
  crowns: { coin: { cx: number; cy: number; r: number }; textX: number; box: Box } | null
  // Where the plate ends: its pointed tip, at the right of the last drawing.
  plateEnd: number
}

const NUMBERS_W = Math.ceil(Math.max(textWidth('100%', SIZE.vit), textWidth('100%', SIZE.sta)))
const COIN_R = 5

export const layout = (input: LayoutInput): Layout => {
  const width = Math.max(MIN_W, Math.min(MAX_W, Math.floor(input.width)))
  const isCompact = width < 560
  const VW = isCompact ? 110 : 150

  // The medallion: a ring of radius 19, studs reaching 21 from its centre.
  const medallion = { cx: MID, cy: MID, ring: 19, box: { x: MID - 21, y: MID - 21, w: 42, h: 42 } }

  // Vitality over stamina, the pair centred on MID: 10 + 3 + 5.
  const BX = medallion.box.x + medallion.box.w + GAP
  const vit = input.hasStamina ? { x: BX, y: 13, w: VW, h: 10 } : { x: BX, y: 17, w: VW, h: 10 }
  const sta = input.hasStamina ? { x: BX, y: 26, w: VW, h: 5 } : null

  // The figures beside them, each centred on its bar; a narrower gap ties them to it.
  const NX = BX + VW + 6
  const vitCentre = vit.y + vit.h / 2
  const staCentre = sta ? sta.y + sta.h / 2 : vitCentre
  const numbersBox = sta
    ? { x: NX, y: round2(vitCentre - capHeight(SIZE.vit) / 2), w: NUMBERS_W, h: round2(staCentre + capHeight(SIZE.sta) / 2 - (vitCentre - capHeight(SIZE.vit) / 2)) }
    : capBox(NX, vitCentre, NUMBERS_W, SIZE.vit)
  const numbers = { x: NX, vitCentre, staCentre, box: numbersBox }

  // Adrenaline: three pips in a column, filling from the bottom.
  const half = 3
  const PX = NX + NUMBERS_W + GAP
  const pips = {
    cx: PX + half,
    cys: [MID + 8, MID, MID - 8] as [number, number, number],
    half,
    box: { x: PX, y: MID - 8 - half, w: half * 2, h: 16 + half * 2 },
  }

  // The level badge, its XP ring outermost: half-diagonal 14 and a 2px stroke.
  const ring = 14
  const reach = ring + 1
  const LX = PX + half * 2 + GAP
  const badge = { cx: LX + reach, cy: MID, ring, inner: 10, box: { x: LX, y: MID - reach, w: reach * 2, h: reach * 2 } }
  const badgeRight = LX + reach * 2

  // Room for the quest: from past the divider to before the tip.
  const DX = Math.ceil(badgeRight + GAP)
  const dividerBox = { x: DX, y: MID - 2.5, w: 5, h: 5 }
  const questX = DX + 5 + GAP
  const plateEndFull = width - 1
  const questRight = plateEndFull - TIP - GAP
  const hasQuest = questRight - questX >= 120

  if (!hasQuest) {
    const plateEnd = Math.ceil(badgeRight + GAP + TIP)
    return {
      width: plateEnd + 1,
      split: plateEnd + 1,
      isCompact,
      medallion,
      vit,
      sta,
      numbers,
      pips,
      badge,
      divider: null,
      quest: null,
      crowns: null,
      plateEnd,
    }
  }

  const divider = { x: DX + 2.5, top: MID - 12, bottom: MID + 12, box: dividerBox }
  const split = Math.floor(DX + 5 + GAP / 2)

  let crowns: Layout['crowns'] = null
  let right = questRight
  if (input.crowns !== null) {
    const tw = Math.ceil(textWidth(input.crowns, SIZE.crowns))
    const w = COIN_R * 2 + 5 + tw
    if (questRight - questX - w - GAP >= 200) {
      const x = questRight - w
      crowns = {
        coin: { cx: x + COIN_R, cy: MID, r: COIN_R },
        textX: x + COIN_R * 2 + 5,
        box: { x, y: MID - COIN_R, w, h: COIN_R * 2 },
      }
      right = x - GAP
    }
  }

  // The objective's glyph column: 12px, its text after a 5px gap; the title starts flush with the glyph.
  const glyph = { x: questX, y: ROW_LINE - 6, w: 12, h: 12 }
  return {
    width,
    split,
    isCompact,
    medallion,
    vit,
    sta,
    numbers,
    pips,
    badge,
    divider,
    quest: { x: questX, right, glyph, textX: questX + 12 + 5 },
    crowns,
    plateEnd: plateEndFull,
  }
}

// One width range of the desktop drawing, [lo, hi) in CSS pixels, drawn as laid out at its lowest
// width. What sits at the right (the plate's tip, the crowns) is drawn at its distance from the
// right edge, the rest from the left, so whatever fits at the band's lowest width fits across it.
export type Band = { lo: number; hi: number; L: Layout }

const tierOf = (L: Layout) => `${L.isCompact}${L.quest !== null}${L.crowns !== null}`
const bandCache = new Map<string, Band[]>()

// The drawing's bands: one every STEP from MIN_W to MAX_W, and one from each width where a tier
// (the compact bars, the quest, the crowns) starts. The first reaches down to 0, the last up without end.
export const bands = (input: Omit<LayoutInput, 'width'>): Band[] => {
  const key = `${input.hasStamina}|${input.crowns}`
  const known = bandCache.get(key)
  if (known) return known
  const at = (width: number) => layout({ ...input, width })
  const starts = new Set<number>()
  for (let w = MIN_W; w <= MAX_W; w += STEP) starts.add(w)
  let tier = tierOf(at(MIN_W))
  for (let w = MIN_W + 1; w <= MAX_W; w++) {
    const now = tierOf(at(w))
    if (now !== tier) starts.add(w)
    tier = now
  }
  const sorted = [...starts].sort((a, b) => a - b)
  const out = sorted.map((lo, i) => ({ lo: i === 0 ? 0 : lo, hi: sorted[i + 1] ?? Infinity, L: at(lo) }))
  // The crowns change as the session spends; a few recent ones are kept.
  if (bandCache.size >= 8) bandCache.delete(bandCache.keys().next().value as string)
  bandCache.set(key, out)
  return out
}
