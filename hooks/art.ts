// The desktop HUD as one SVG drawing, from the boxes hooks/layout.ts places: the character
// (medallion, vitality and stamina, adrenaline, level) on the left, the quest or the character
// sheet on the right, on one plate. Colours are CSS variables, so one drawing follows the
// app's light or dark appearance; motion is CSS, so a reduced-motion setting stills it.
//
// The drawing fills whatever width its frame has: the plate's tip and the crowns are placed from
// the right edge, everything else from the left, and the parts that change with the width (the
// compact bars, the quest, the crowns, where each text is cut) are drawn once per band of widths
// (layout.ts `bands`), the frame's own width picking one with a CSS media query. Nothing in it
// depends on the band width the engine reports, so a redraw never moves or drops a part.
import type { SignKey } from '../types'
import { TITLE_FAMILY, TITLE_WOFF2 } from './font'
import {
  H,
  MAX_W,
  MID,
  PLATE_BOTTOM,
  PLATE_TOP,
  ROW_LINE,
  ROW_TITLE,
  SIGN_SPACING,
  SIZE,
  TIP,
  TITLE_SPACING,
  baselineAt,
  fitText,
  monoWidth,
  textWidth,
} from './layout'
import type { Band, Layout } from './layout'
import { GOLD_HI, SIGNS } from './lore'
import type { QuestLine } from './lore'

export type Theme = 'auto' | 'dark' | 'light'

export const themeOf = (value: unknown): Theme => (value === 'dark' || value === 'light' ? value : 'auto')

type Palette = Record<string, string>

const SIGN_KEYS: SignKey[] = ['igni', 'yrden', 'senses', 'axii', 'aard', 'quen']

const DARK: Palette = {
  'plate-top': '#1D1711',
  'plate-bot': '#0B0806',
  rim: '#C9A55C',
  title: '#C9A55C',
  'idle-title': '#A88F5E',
  text: '#E6DCC3',
  idle: '#8F8778',
  num: '#E6DCC3',
  low: '#FF8A73',
  'vit-track': '#1B0A08',
  'vit-edge': '#4A1F19',
  'sta-track': '#17130A',
  'sta-edge': '#43361A',
  'sta-num': '#E3B341',
  mono: '#D9CFB6',
  'pip-on': 'url(#pip)',
  'pip-off': '#15110C',
  'pip-edge': '#6A5228',
  'pip-on-edge': '#A7823A',
  badge: '#120E0A',
  'badge-num': GOLD_HI,
  ring: '#3A3020',
  'ring-fill': '#D9B56A',
  done: '#C9A55C',
  failed: '#D27466',
  cross: '#C0473B',
  coin: '#C9A55C',
  shadow: '.9',
  'sign-igni': '#F58A50',
  'sign-yrden': '#C2ABFA',
  'sign-senses': '#F06A50',
  'sign-axii': '#8EDC9D',
  'sign-aard': '#9DCDFF',
  'sign-quen': '#F2C14E',
}

// Parchment: the bright sign colours are darkened to stay legible on it.
const LIGHT: Palette = {
  'plate-top': '#FBF6EA',
  'plate-bot': '#EFE4CB',
  rim: '#A8864A',
  title: '#6E4B14',
  'idle-title': '#8C7448',
  text: '#3A2E1E',
  idle: '#7C715E',
  num: '#3A2E1E',
  low: '#B0301E',
  'vit-track': '#F1DCD5',
  'vit-edge': '#CFA399',
  'sta-track': '#F1E7C6',
  'sta-edge': '#CDB678',
  'sta-num': '#8E6A0E',
  mono: '#4A3B26',
  'pip-on': '#A67C2C',
  'pip-off': '#F7F0DF',
  'pip-edge': '#B89A62',
  'pip-on-edge': '#6E4B14',
  badge: '#FBF6EA',
  'badge-num': '#6E4B14',
  ring: '#E6D8B4',
  'ring-fill': '#8C6A2E',
  done: '#7A5A1C',
  failed: '#B0301E',
  cross: '#B0301E',
  coin: '#6E4B14',
  shadow: '0',
  'sign-igni': '#B84A12',
  'sign-yrden': '#5E40B8',
  'sign-senses': '#B23420',
  'sign-axii': '#2B7A3E',
  'sign-aard': '#2A64A6',
  'sign-quen': '#8C6608',
}

const vars = (p: Palette) =>
  Object.entries(p)
    .map(([k, v]) => `--${k}:${v}`)
    .join(';')

const FONT_FACE = `@font-face{font-family:'${TITLE_FAMILY}';src:url(data:font/woff2;base64,${TITLE_WOFF2}) format('woff2')}`

// The motions' lengths, in ms; a redraw starts each where the last drawing had it (see `phase`).
export const MOTION_MS = { shake: 900, breathe: 2400, drainAfter: 450, drain: 800, pulse: 1200, glow: 1000 } as const

const MOTION =
  '@keyframes whud-shake{0%{transform:rotate(0)}12%{transform:rotate(-7deg)}24%{transform:rotate(6deg)}36%{transform:rotate(-4deg)}48%{transform:rotate(2deg)}60%,100%{transform:rotate(0)}}' +
  '@keyframes whud-breathe{0%,100%{opacity:.2}50%{opacity:.65}}' +
  '@keyframes whud-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}' +
  '@keyframes whud-pulse{0%,100%{opacity:0}12%{opacity:.5}24%{opacity:0}36%{opacity:.3}48%{opacity:0}}' +
  '@keyframes whud-glow{0%,100%{opacity:.35}50%{opacity:1}}' +
  `.shake{transform-box:view-box;transform-origin:${MID}px ${MID}px;animation:whud-shake ${MOTION_MS.shake}ms ease-out 1}` +
  `.aura{animation:whud-breathe ${MOTION_MS.breathe}ms ease-in-out infinite}` +
  `.ghost{transform-box:fill-box;transform-origin:left center;animation:whud-drain ${MOTION_MS.drain}ms ease-in ${MOTION_MS.drainAfter}ms forwards}` +
  `.low{opacity:0;animation:whud-pulse ${MOTION_MS.pulse}ms linear infinite}` +
  `.levelup{animation:whud-glow ${MOTION_MS.glow}ms ease-in-out infinite}` +
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}.low,.ghost{opacity:0}}'

const TITLE_FONT = `'${TITLE_FAMILY}', 'Hoefler Text', Baskerville, 'PT Serif', Georgia, serif`
const MONO_FONT = "'SF Mono', Menlo, ui-monospace, monospace"
const NUMS = 'font-variant-numeric:lining-nums tabular-nums'

// The drawing takes its frame's width (up to MAX_W) and its height; the sheet shows in the quest's
// place while the pointer is on the character. A band's parts are hidden but where its range holds.
const FRAME =
  `.hud{display:block;width:100%;max-width:${MAX_W}px;height:${H}px;overflow:hidden}` +
  '.anchor{overflow:visible}' +
  `.tt{font-family:${TITLE_FONT}}.tm{font-family:${MONO_FONT}}` +
  '.sheet{display:none}.char:hover~.right .sheet{display:inline}.char:hover~.right .quest{display:none}' +
  '.v{display:none}'

// A redrawn HUD is a new frame, and a new frame starts its motions over: the medallion's aura would
// jump back to its faintest, a shake or a draining ghost would play again. Each motion is started
// instead where it stands at the drawing's time, so the new frame takes up the old one's motion.
const phase = (c: Clock | undefined) => {
  if (c === undefined) return ''
  const ago = (at: number) => Math.max(0, Math.round(c.now - at))
  const loop = (ms: number) => Math.round(((c.now % ms) + ms) % ms)
  return (
    `.aura{animation-delay:-${loop(MOTION_MS.breathe)}ms}` +
    `.low{animation-delay:-${loop(MOTION_MS.pulse)}ms}` +
    `.levelup{animation-delay:-${loop(MOTION_MS.glow)}ms}` +
    (c.castAt === null ? '' : `.shake{animation-delay:-${ago(c.castAt)}ms}`) +
    (c.ghostAt === null ? '' : `.ghost{animation-delay:${MOTION_MS.drainAfter - ago(c.ghostAt)}ms}`)
  )
}

const style = (theme: Theme, ranges: string, clock?: Clock) =>
  '<style>' +
  FONT_FACE +
  (theme === 'auto'
    ? `svg{${vars(DARK)}}@media (prefers-color-scheme:light){svg{${vars(LIGHT)}}}`
    : `svg{${vars(theme === 'light' ? LIGHT : DARK)}}`) +
  MOTION +
  phase(clock) +
  FRAME +
  ranges +
  '</style>'

const fill = (name: string, extra = '') => `style="fill:var(--${name})${extra === '' ? '' : `;${extra}`}"`
const strokeOf = (name: string) => `style="stroke:var(--${name})"`

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const r1 = (n: number) => Math.round(n * 10) / 10

const diamond = (cx: number, cy: number, h: number) =>
  `M${r1(cx)} ${r1(cy - h)}L${r1(cx + h)} ${r1(cy)}L${r1(cx)} ${r1(cy + h)}L${r1(cx - h)} ${r1(cy)}Z`

const text = (x: number, centre: number, size: number, body: string, attrs: string, face = 'tt') =>
  `<text class="${face}" x="${r1(x)}" y="${baselineAt(centre, size)}" font-size="${size}" ${attrs}>${body}</text>`

// Original line glyphs in the spirit of the five signs, drawn around (20, 20), about 18px across.
export const glyph = (sign: SignKey | null, tint: string) => {
  const line = (w = 1.6) =>
    `fill="none" stroke="${tint}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`
  switch (sign) {
    case 'igni':
      return `<path d="M20 11.4L27.8 25.9H12.2Z" ${line()}/><path d="M20 15.4C23 18.8 22.8 22 20 24.3C17.2 22 17 18.8 20 15.4Z" fill="${tint}"/>`
    case 'aard':
      return `<path d="M12.6 26.6L20 12.2L27.4 26.6" ${line()}/><path d="M15.8 26.6Q20 20.6 24.2 26.6" ${line(1.3)}/><circle cx="20" cy="17.6" r="1.3" fill="${tint}"/>`
    case 'yrden':
      return `<circle cx="20" cy="20" r="7.8" ${line()}/><path d="M20 14.4L24.8 22.8H15.2Z" ${line(1.2)}/><circle cx="20" cy="20" r="1.2" fill="${tint}"/>`
    case 'quen':
      return `<path d="M20 11.2L27.4 15.5V24.5L20 28.8L12.6 24.5V15.5Z" ${line()}/><path d="${diamond(20, 20, 3.4)}" fill="${tint}"/>`
    case 'axii':
      return `<path d="M15.6 12.6Q10.6 20 15.6 27.4M24.4 12.6Q29.4 20 24.4 27.4" ${line()}/><circle cx="20" cy="20" r="2.6" fill="${tint}"/><path d="M20 13.4V15.6M20 24.4V26.6" ${line(1.2)}/>`
    case 'senses':
      return `<path d="M11.2 20Q20 12.4 28.8 20Q20 27.6 11.2 20Z" ${line()}/><ellipse cx="20" cy="20" rx="1.5" ry="5" fill="${tint}"/>`
    case null:
      // The snarling wolf of the School's medallion.
      return (
        `<path d="M11.8 10.2L16.2 14.9L20 14.1L23.8 14.9L28.2 10.2L27.7 18.7L25.7 22.7L23.1 26.1L21.6 29.7L20 30.7L18.4 29.7L16.9 26.1L14.3 22.7L12.3 18.7Z" fill="url(#gold)" stroke="#2A1D0D" stroke-width=".5"/>` +
        `<path d="M13.2 12.4L15.5 15L13.5 16.4ZM26.8 12.4L24.5 15L26.5 16.4Z" fill="#4A3417"/>` +
        `<path d="M20 15.2V19.4" stroke="#6E5226" stroke-width=".7"/>` +
        `<path d="M15.1 19L18.5 20.6L15.6 21.2ZM24.9 19L21.5 20.6L24.4 21.2Z" fill="#E0442E"/>` +
        `<path d="M18.9 25.1H21.1L20 26.5Z" fill="#1A120A"/>` +
        `<path d="M17.4 27.1Q20 29.6 22.6 27.1" fill="#1A120A"/>` +
        `<path d="M18.4 27.4L18.9 28.6L19.3 27.6ZM21.6 27.4L21.1 28.6L20.7 27.6Z" fill="#F4EBD3"/>`
      )
  }
}

const DEFS =
  `<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3DFA6"/><stop offset=".55" stop-color="#C9A55C"/><stop offset="1" stop-color="#7A5A26"/></linearGradient>` +
  `<linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--plate-top)"/><stop offset="1" style="stop-color:var(--plate-bot)"/></linearGradient>` +
  `<linearGradient id="vline" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--rim);stop-opacity:0"/><stop offset=".5" style="stop-color:var(--rim)"/><stop offset="1" style="stop-color:var(--rim);stop-opacity:0"/></linearGradient>` +
  `<filter id="shadow" x="-10%" y="-40%" width="120%" height="180%"><feDropShadow dx="0" dy=".8" stdDeviation=".7" flood-color="#000" style="flood-opacity:var(--shadow)"/></filter>` +
  `<filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`

const CHARACTER_DEFS =
  `<radialGradient id="well" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#2F271D"/><stop offset="1" stop-color="#090705"/></radialGradient>` +
  `<linearGradient id="vit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E35D49"/><stop offset=".45" stop-color="#B3301F"/><stop offset="1" stop-color="#66110B"/></linearGradient>` +
  `<linearGradient id="sta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F8E08A"/><stop offset=".5" stop-color="#D9A72E"/><stop offset="1" stop-color="#8E6510"/></linearGradient>` +
  `<radialGradient id="pip" cx=".5" cy=".4" r=".62"><stop offset="0" stop-color="#FFFBEA"/><stop offset=".55" stop-color="#F0D58E"/><stop offset="1" stop-color="#A7823A"/></radialGradient>`

// The plate from the medallion's centre on: the fluid plate is drawn from far left of the right edge.
const FROM_MID = `<clipPath id="from-mid"><rect x="${MID}" y="0" width="100%" height="${H}"/></clipPath>`

// Children drawn at their distance from the right edge: x 0 is the edge, -1 the last pixel.
const anchored = (body: string) => `<svg class="anchor" x="100%" y="0" overflow="visible">${body}</svg>`

// The plate's fill and its gold hairlines, x0 to x1 in this drawing, pointed at `tip` when it ends here.
const plate = (x0: number, x1: number, tip: number | null) => {
  const fillPath =
    tip === null
      ? `M${x0} ${PLATE_TOP}H${x1}V${PLATE_BOTTOM}H${x0}Z`
      : `M${x0} ${PLATE_TOP}H${tip - TIP}L${tip} ${MID}L${tip - TIP} ${PLATE_BOTTOM}H${x0}Z`
  const rim =
    tip === null
      ? `M${x0} ${PLATE_TOP + 0.5}H${x1}M${x0} ${PLATE_BOTTOM - 0.5}H${x1}`
      : `M${x0} ${PLATE_TOP + 0.5}H${tip - TIP}L${tip - 0.7} ${MID}L${tip - TIP} ${PLATE_BOTTOM - 0.5}H${x0}`
  return (
    `<path d="${fillPath}" fill="url(#plate)"/>` +
    `<path d="${rim}" fill="none" stroke-width="1" stroke-opacity=".8" stroke-linejoin="miter" ${strokeOf('rim')}/>`
  )
}

export type Tips = { vitality: string; stamina: string; adrenaline: string; level: string }

// When the drawing is made and when its one-off motions began, on the session's clock (ms).
export type Clock = { now: number; castAt: number | null; ghostAt: number | null }

export type CharacterArt = {
  theme: Theme
  // Without it every motion starts at its beginning.
  clock?: Clock
  sign: SignKey | null
  isWorking: boolean
  // A sign was just cast: the medallion shakes, once.
  isCasting: boolean
  vitality: number
  ghostFrom: number | null
  stamina: number | null
  adrenaline: number
  level: number
  xpFraction: number
  isLevelUp: boolean
  tips: Tips
}

const medallion = (L: Layout, a: CharacterArt) => {
  const { cx, cy, ring } = L.medallion
  const tint = a.sign ? SIGNS[a.sign].color : '#C9A55C'
  const halo = a.sign ? SIGNS[a.sign].glow : GOLD_HI
  const studs = [0, 90, 180, 270]
    .map(deg => {
      const rad = (deg * Math.PI) / 180
      return `<path d="${diamond(cx + ring * Math.sin(rad), cy - ring * Math.cos(rad), 2)}" fill="url(#gold)" stroke="#1C150D" stroke-width=".4"/>`
    })
    .join('')
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const rad = ((i * 30 + 15) * Math.PI) / 180
    const p = (r: number) => `${r1(cx + r * Math.sin(rad))} ${r1(cy - r * Math.cos(rad))}`
    return `M${p(15.6)}L${p(16.8)}`
  }).join('')
  const aura = a.isWorking
    ? `<circle class="aura" cx="${cx}" cy="${cy}" r="${ring}" fill="none" stroke="${halo}" stroke-width="2.4" filter="url(#glow)"/>`
    : ''
  // The glyphs are drawn for a ring of 18.2 around (20, 20).
  const k = r1(ring / 18.2 * 100) / 100
  return (
    `<g${a.isCasting ? ' class="shake"' : ''}>` +
    aura +
    `<circle cx="${cx}" cy="${cy}" r="${ring}" fill="url(#well)" stroke="url(#gold)" stroke-width="2"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${ring - 3}" fill="none" stroke="#5E4520" stroke-width=".8"/>` +
    `<path d="${ticks}" stroke="#8C6A2E" stroke-width=".7"/>${studs}` +
    `<g filter="url(#glow)" transform="translate(${cx} ${cy}) scale(${k}) translate(-20 -20)">${glyph(a.sign, tint)}</g></g>`
  )
}

const bars = (L: Layout, a: CharacterArt) => {
  const v = clamp(a.vitality, 0, 100)
  const isLow = v <= 20
  const { vit, sta } = L
  const inner = vit.w - 2
  const vW = Math.round((inner * v) / 100)
  const ghostTo = a.ghostFrom !== null && a.ghostFrom > v ? Math.round((inner * clamp(a.ghostFrom, 0, 100)) / 100) : vW
  const track = (b: { x: number; y: number; w: number; h: number }, name: string) =>
    `<rect x="${b.x + 0.5}" y="${b.y + 0.5}" width="${b.w - 1}" height="${b.h - 1}" rx="1.5" style="fill:var(--${name}-track);stroke:var(--${name}-edge)" stroke-width="1"/>`
  const vitality =
    `<g><title>${esc(a.tips.vitality)}</title>` +
    track(vit, 'vit') +
    (ghostTo > vW ? `<rect class="ghost" x="${vit.x + 1 + vW}" y="${vit.y + 1}" width="${ghostTo - vW}" height="${vit.h - 2}" fill="#F3B9AC" opacity=".9"/>` : '') +
    (vW > 0
      ? `<rect x="${vit.x + 1}" y="${vit.y + 1}" width="${vW}" height="${vit.h - 2}" rx="1" fill="url(#vit)"/>` +
        `<rect x="${vit.x + 1}" y="${vit.y + 2}" width="${vW}" height="1" fill="#FFCDBE" opacity=".35"/>`
      : '') +
    (isLow && vW > 0 ? `<rect class="low" x="${vit.x + 1}" y="${vit.y + 1}" width="${vW}" height="${vit.h - 2}" rx="1" fill="#FF7A62"/>` : '') +
    text(L.numbers.x, L.numbers.vitCentre, SIZE.vit, `${Math.round(v)}%`, `${fill(isLow ? 'low' : 'num', NUMS)} filter="url(#shadow)"`) +
    `</g>`
  if (sta === null || a.stamina === null) return vitality
  const s = clamp(a.stamina, 0, 100)
  const sW = Math.round(((sta.w - 2) * s) / 100)
  return (
    vitality +
    `<g><title>${esc(a.tips.stamina)}</title>` +
    track(sta, 'sta') +
    (sW > 0 ? `<rect x="${sta.x + 1}" y="${sta.y + 1}" width="${sW}" height="${sta.h - 2}" rx=".8" fill="url(#sta)"/>` : '') +
    text(L.numbers.x, L.numbers.staCentre, SIZE.sta, `${Math.round(s)}%`, `${fill(s <= 15 ? 'low' : 'sta-num', NUMS)} filter="url(#shadow)"`) +
    `</g>`
  )
}

const pips = (L: Layout, a: CharacterArt) => {
  const { cx, cys, half } = L.pips
  // Drawn 0.4 inside the half, so the 0.8 stroke stays in the column.
  const shapes = cys
    .map((cy, i) =>
      i < a.adrenaline
        ? `<path d="${diamond(cx, cy, half - 0.4)}" stroke-width=".8" style="fill:var(--pip-on);stroke:var(--pip-on-edge)"/>`
        : `<path d="${diamond(cx, cy, half - 0.4)}" stroke-width=".8" style="fill:var(--pip-off);stroke:var(--pip-edge)"/>`,
    )
    .join('')
  // A transparent box so the tooltip answers across the whole column, not just on the pips.
  return `<g><title>${esc(a.tips.adrenaline)}</title><rect x="${L.pips.box.x}" y="${L.pips.box.y}" width="${L.pips.box.w}" height="${L.pips.box.h}" fill="transparent"/>${shapes}</g>`
}

const badge = (L: Layout, a: CharacterArt) => {
  const { cx, cy, ring, inner } = L.badge
  const ringPath = `M${cx} ${cy - ring}L${cx + ring} ${cy}L${cx} ${cy + ring}L${cx - ring} ${cy}Z`
  const xp = r1(clamp(a.xpFraction, 0, 1) * 100)
  return (
    `<g><title>${esc(a.tips.level)}</title>` +
    `<path d="${ringPath}" fill="none" stroke-width="2" stroke-linejoin="round" ${strokeOf('ring')}/>` +
    (xp > 0
      ? `<path d="${ringPath}" pathLength="100" fill="none" stroke-width="2" stroke-linejoin="round" stroke-dasharray="${xp} 100" ${strokeOf('ring-fill')}/>`
      : '') +
    (a.isLevelUp
      ? `<path class="levelup" d="${ringPath}" fill="none" stroke="${GOLD_HI}" stroke-width="2" stroke-linejoin="round" filter="url(#glow)"/>`
      : '') +
    `<path d="${diamond(cx, cy, inner)}" stroke="url(#gold)" stroke-width="1.2" ${fill('badge')}/>` +
    `<text class="tt" x="${cx}" y="${baselineAt(cy, SIZE.level)}" text-anchor="middle" font-size="${a.level >= 10 ? 11 : SIZE.level}" ${fill('badge-num', NUMS)}>${a.level}</text>` +
    `</g>`
  )
}

const divider = (L: Layout) =>
  L.divider === null
    ? ''
    : `<path d="M${L.divider.x} ${L.divider.top}V${L.divider.bottom}" stroke="url(#vline)" stroke-width="1"/>` +
      `<path d="${diamond(L.divider.x, MID, 2.5)}" fill="url(#gold)"/>`

export type Cast = { key: SignKey; name: string; detail: string }

export type HudArt = CharacterArt & {
  line: QuestLine
  // The sign at work, drawn in its own colour; null draws the line's objective.
  cast: Cast | null
  crowns: string | null
  // The character sheet, shown in the quest's place while the pointer is on the character.
  sheet: { title: string; stats: string }
}

const bullet = (tone: QuestLine['tone'], cx: number, cy: number) =>
  ({
    active: `<path d="${diamond(cx, cy, 2.6)}" ${fill('text')}/>`,
    idle: `<path d="${diamond(cx, cy, 2.6)}" fill="none" stroke-width=".9" ${strokeOf('idle')}/>`,
    done: `<path d="M${cx - 3.4} ${cy}L${cx - 1.1} ${cy + 2.3}L${cx + 3.4} ${cy - 2.6}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${strokeOf('done')}/>`,
    failed: `<path d="M${cx - 2.6} ${cy - 2.6}L${cx + 2.6} ${cy + 2.6}M${cx + 2.6} ${cy - 2.6}L${cx - 2.6} ${cy + 2.6}" stroke-width="1.5" stroke-linecap="round" ${strokeOf('cross')}/>`,
  })[tone]

// Each band's plate: pointed after the badge while the quest has no room, else reaching the right edge.
const FLUID_PLATE = `<g clip-path="url(#from-mid)">${anchored(plate(-2 * MAX_W, 0, -1))}</g>`
const plateOf = (L: Layout) => (L.quest === null ? plate(MID, L.plateEnd, L.plateEnd) : FLUID_PLATE)

// The character's own hover area, up to where the quest's room begins.
const characterOf = (L: Layout, a: CharacterArt) =>
  `<rect x="0" y="0" width="${L.split}" height="${H}" fill="transparent"/>` + bars(L, a) + pips(L, a) + badge(L, a) + divider(L)

const titleOf = (L: Layout, title: string, ink: string) => {
  if (L.quest === null) return ''
  const { x, right } = L.quest
  const cut = fitText(title, right - x, t => textWidth(t, SIZE.title, TITLE_SPACING))
  return text(x, ROW_TITLE, SIZE.title, esc(cut), `letter-spacing="${TITLE_SPACING}" ${fill(ink)} filter="url(#shadow)"`)
}

// The quest's lower row: the sign's glyph and name, or the objective's bullet.
const lineHeadOf = (L: Layout, a: HudArt) => {
  if (L.quest === null) return ''
  const { glyph: g, textX } = L.quest
  const gx = g.x + g.w / 2
  const gy = g.y + g.h / 2
  if (a.cast === null) return bullet(a.line.tone, gx, gy)
  const ink = `var(--sign-${a.cast.key})`
  return (
    `<g transform="translate(${gx} ${gy}) scale(.66) translate(-20 -20)">${glyph(a.cast.key, ink)}</g>` +
    text(textX, ROW_LINE, SIZE.sign, esc(a.cast.name.toUpperCase()), `letter-spacing="${SIGN_SPACING}" style="fill:${ink}" filter="url(#shadow)"`)
  )
}

// The rest of that row: the sign's detail in mono after its name, or the objective, cut to the room.
const lineTextOf = (L: Layout, a: HudArt) => {
  if (L.quest === null) return ''
  const { right, textX } = L.quest
  if (a.cast !== null) {
    const x = textX + textWidth(a.cast.name.toUpperCase(), SIZE.sign, SIGN_SPACING) + 6
    const detail = fitText(a.cast.detail, right - x, t => monoWidth(t, SIZE.mono))
    return text(x, ROW_LINE, SIZE.mono, esc(detail), `${fill('mono')} filter="url(#shadow)"`, 'tm')
  }
  const tone = { active: 'text', done: 'done', failed: 'failed', idle: 'idle' }[a.line.tone]
  const objective = fitText(a.line.objective, right - textX, t => textWidth(t, SIZE.body))
  return text(textX, ROW_LINE, SIZE.body, esc(objective), `${fill(tone)} filter="url(#shadow)"`)
}

const statsOf = (L: Layout, stats: string) => {
  if (L.quest === null) return ''
  const { x, right } = L.quest
  return text(x, ROW_LINE, SIZE.body, esc(fitText(stats, right - x, t => textWidth(t, SIZE.body))), `${fill('text', NUMS)} filter="url(#shadow)"`)
}

// The crowns keep their distance from the right edge: drawn at L's coordinates less its width.
const crownsOf = (L: Layout, crowns: string | null) => {
  if (L.crowns === null || crowns === null) return ''
  const { coin, textX } = L.crowns
  const dx = L.width
  return anchored(
    `<circle cx="${coin.cx - dx}" cy="${coin.cy}" r="${coin.r}" fill="url(#gold)" stroke="#4E3A1B" stroke-width=".5"/>` +
      `<circle cx="${coin.cx - dx}" cy="${coin.cy}" r="${coin.r - 2.2}" fill="none" stroke="#7A5A26" stroke-width=".7"/>` +
      text(textX - dx, MID, SIZE.crowns, esc(crowns), `${fill('coin', NUMS)} filter="url(#shadow)"`),
  )
}

// The width ranges the drawing's parts show in, each a class its media query shows.
const rangeClasses = () => {
  const names = new Map<string, string>()
  const rules: string[] = []
  const nameOf = (lo: number, hi: number) => {
    const key = `${lo}-${hi}`
    const known = names.get(key)
    if (known !== undefined) return known
    const name = `b${names.size}`
    names.set(key, name)
    const query = [lo > 0 ? `(width>=${lo}px)` : '', hi < Infinity ? `(width<${hi}px)` : ''].filter(Boolean).join(' and ')
    rules.push(`@media ${query}{.${name}{display:inline}}`)
    return name
  }
  return { nameOf, css: () => rules.join('') }
}

// One part drawn per run of bands it looks the same in; a part that is the same in all is drawn once.
const perBand = (B: Band[], nameOf: (lo: number, hi: number) => string, draw: (L: Layout) => string) => {
  const drawn = B.map(b => draw(b.L))
  let out = ''
  for (let i = 0; i < B.length; ) {
    let j = i
    while (j + 1 < B.length && drawn[j + 1] === drawn[i]) j++
    const markup = drawn[i]!
    const lo = B[i]!.lo
    const hi = B[j]!.hi
    if (markup !== '') out += lo <= 0 && hi === Infinity ? markup : `<g class="v ${nameOf(lo, hi)}">${markup}</g>`
    i = j + 1
  }
  return out
}

export const hudSvg = (B: Band[], a: HudArt): string => {
  const { nameOf, css } = rangeClasses()
  const each = (draw: (L: Layout) => string) => perBand(B, nameOf, draw)
  const titleInk = a.line.tone === 'idle' ? 'idle-title' : 'title'
  const body =
    `<g class="plate">${each(plateOf)}</g>` +
    `<g class="char">${medallion(B[0]!.L, a)}${each(L => characterOf(L, a))}</g>` +
    '<g class="right">' +
    `<g class="quest">${each(L => titleOf(L, a.line.title, titleInk))}${each(L => lineHeadOf(L, a))}${each(L => lineTextOf(L, a))}</g>` +
    `<g class="sheet">${each(L => titleOf(L, a.sheet.title, 'title'))}${each(L => statsOf(L, a.sheet.stats))}</g>` +
    each(L => crownsOf(L, a.crowns)) +
    '</g>'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="hud" width="${MAX_W}" height="${H}">` +
    style(a.theme, css(), a.clock) +
    `<defs>${DEFS}${CHARACTER_DEFS}${FROM_MID}</defs>` +
    body +
    '</svg>'
  )
}
