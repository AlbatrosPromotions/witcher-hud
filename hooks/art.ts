// The desktop HUD as SVG markup, drawn from the boxes hooks/layout.ts places: the character
// (medallion, vitality and stamina, adrenaline, level) on the left, the quest or the character
// sheet on the right, on one plate. Colours are CSS variables, so one drawing follows the
// app's light or dark appearance; motion is CSS, so a reduced-motion setting stills it.
import type { SignKey } from '../types'
import { TITLE_FAMILY, TITLE_WOFF2 } from './font'
import {
  H,
  MID,
  PLATE_BOTTOM,
  PLATE_TOP,
  ROW_LINE,
  ROW_TITLE,
  SIGN_SPACING,
  SIZE,
  TIP,
  baselineAt,
  fitText,
  monoWidth,
  textWidth,
} from './layout'
import type { Layout } from './layout'
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

const MOTION =
  '@keyframes whud-shake{0%{transform:rotate(0)}12%{transform:rotate(-7deg)}24%{transform:rotate(6deg)}36%{transform:rotate(-4deg)}48%{transform:rotate(2deg)}60%,100%{transform:rotate(0)}}' +
  '@keyframes whud-breathe{0%,100%{opacity:.2}50%{opacity:.65}}' +
  '@keyframes whud-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}' +
  '@keyframes whud-pulse{0%,100%{opacity:0}12%{opacity:.5}24%{opacity:0}36%{opacity:.3}48%{opacity:0}}' +
  '@keyframes whud-glow{0%,100%{opacity:.35}50%{opacity:1}}' +
  `.shake{transform-box:view-box;transform-origin:${MID}px ${MID}px;animation:whud-shake .9s ease-out 1}` +
  '.aura{animation:whud-breathe 2.4s ease-in-out infinite}' +
  '.ghost{transform-box:fill-box;transform-origin:left center;animation:whud-drain .8s ease-in .45s forwards}' +
  '.low{opacity:0;animation:whud-pulse 1.2s linear infinite}' +
  '.levelup{animation:whud-glow 1s ease-in-out infinite}' +
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}.low,.ghost{opacity:0}}'

const style = (theme: Theme) =>
  '<style>' +
  FONT_FACE +
  (theme === 'auto'
    ? `svg{${vars(DARK)}}@media (prefers-color-scheme:light){svg{${vars(LIGHT)}}}`
    : `svg{${vars(theme === 'light' ? LIGHT : DARK)}}`) +
  MOTION +
  '</style>'

const fill = (name: string, extra = '') => `style="fill:var(--${name})${extra === '' ? '' : `;${extra}`}"`
const strokeOf = (name: string) => `style="stroke:var(--${name})"`

const TITLE_FONT = `'${TITLE_FAMILY}', 'Hoefler Text', Baskerville, 'PT Serif', Georgia, serif`
const MONO_FONT = "'SF Mono', Menlo, ui-monospace, monospace"
const NUMS = 'font-variant-numeric:lining-nums tabular-nums'

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const r1 = (n: number) => Math.round(n * 10) / 10

const diamond = (cx: number, cy: number, h: number) =>
  `M${r1(cx)} ${r1(cy - h)}L${r1(cx + h)} ${r1(cy)}L${r1(cx)} ${r1(cy + h)}L${r1(cx - h)} ${r1(cy)}Z`

const text = (x: number, centre: number, size: number, body: string, attrs: string) =>
  `<text x="${r1(x)}" y="${baselineAt(centre, size)}" font-family="${TITLE_FONT}" font-size="${size}" ${attrs}>${body}</text>`

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

const svgOpen = (w: number, theme: Theme, defs: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}">${style(theme)}<defs>${DEFS}${defs}</defs>`

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

export type CharacterArt = {
  theme: Theme
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
    `<text x="${cx}" y="${baselineAt(cy, SIZE.level)}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="${a.level >= 10 ? 11 : SIZE.level}" ${fill('badge-num', NUMS)}>${a.level}</text>` +
    `</g>`
  )
}

const divider = (L: Layout) =>
  L.divider === null
    ? ''
    : `<path d="M${L.divider.x} ${L.divider.top}V${L.divider.bottom}" stroke="url(#vline)" stroke-width="1"/>` +
      `<path d="${diamond(L.divider.x, MID, 2.5)}" fill="url(#gold)"/>`

export const characterSvg = (L: Layout, a: CharacterArt): string =>
  svgOpen(L.split, a.theme, CHARACTER_DEFS) +
  plate(MID, L.split, L.quest === null ? L.plateEnd : null) +
  medallion(L, a) +
  bars(L, a) +
  pips(L, a) +
  badge(L, a) +
  divider(L) +
  '</svg>'

export type Cast = { key: SignKey; name: string; detail: string }

export type QuestArt = {
  theme: Theme
  line: QuestLine
  // The sign at work, drawn in its own colour; null draws the line's objective.
  cast: Cast | null
  crowns: string | null
}

// The quest and the sheet share the right-hand drawing: the plate from the split to the tip.
const rightPlate = (L: Layout) => plate(0, L.width - L.split, L.plateEnd - L.split)

const bullet = (tone: QuestLine['tone'], cx: number, cy: number) =>
  ({
    active: `<path d="${diamond(cx, cy, 2.6)}" ${fill('text')}/>`,
    idle: `<path d="${diamond(cx, cy, 2.6)}" fill="none" stroke-width=".9" ${strokeOf('idle')}/>`,
    done: `<path d="M${cx - 3.4} ${cy}L${cx - 1.1} ${cy + 2.3}L${cx + 3.4} ${cy - 2.6}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${strokeOf('done')}/>`,
    failed: `<path d="M${cx - 2.6} ${cy - 2.6}L${cx + 2.6} ${cy + 2.6}M${cx + 2.6} ${cy - 2.6}L${cx - 2.6} ${cy + 2.6}" stroke-width="1.5" stroke-linecap="round" ${strokeOf('cross')}/>`,
  })[tone]

const crownsMark = (L: Layout, crowns: string | null, dx: number) => {
  if (L.crowns === null || crowns === null) return ''
  const { coin, textX } = L.crowns
  return (
    `<circle cx="${coin.cx - dx}" cy="${coin.cy}" r="${coin.r}" fill="url(#gold)" stroke="#4E3A1B" stroke-width=".5"/>` +
    `<circle cx="${coin.cx - dx}" cy="${coin.cy}" r="${coin.r - 2.2}" fill="none" stroke="#7A5A26" stroke-width=".7"/>` +
    text(textX - dx, MID, SIZE.crowns, esc(crowns), `${fill('coin', NUMS)} filter="url(#shadow)"`)
  )
}

export const questSvg = (L: Layout, q: QuestArt): string => {
  if (L.quest === null) return ''
  const dx = L.split
  const { x, right, glyph: g, textX } = L.quest
  const titleRoom = right - x
  const title = fitText(q.line.title, titleRoom, t => textWidth(t, SIZE.title))
  const titleFill = q.line.tone === 'idle' ? 'idle-title' : 'title'
  const gx = g.x + g.w / 2 - dx
  const gy = g.y + g.h / 2
  let line: string
  if (q.cast) {
    const ink = `var(--sign-${q.cast.key})`
    const name = q.cast.name.toUpperCase()
    const nameW = textWidth(name, SIZE.sign, SIGN_SPACING)
    const detailX = textX + nameW + 6
    const detail = fitText(q.cast.detail, right - detailX, t => monoWidth(t, SIZE.mono))
    line =
      `<g transform="translate(${gx} ${gy}) scale(.66) translate(-20 -20)">${glyph(q.cast.key, ink)}</g>` +
      text(textX - dx, ROW_LINE, SIZE.sign, esc(name), `letter-spacing="${SIGN_SPACING}" style="fill:${ink}" filter="url(#shadow)"`) +
      `<text x="${r1(detailX - dx)}" y="${baselineAt(ROW_LINE, SIZE.mono)}" font-family="${MONO_FONT}" font-size="${SIZE.mono}" ${fill('mono')} filter="url(#shadow)">${esc(detail)}</text>`
  } else {
    const tone = { active: 'text', done: 'done', failed: 'failed', idle: 'idle' }[q.line.tone]
    const objective = fitText(q.line.objective, right - textX, t => textWidth(t, SIZE.body))
    line = bullet(q.line.tone, gx, gy) + text(textX - dx, ROW_LINE, SIZE.body, esc(objective), `${fill(tone)} filter="url(#shadow)"`)
  }
  return (
    svgOpen(L.width - L.split, q.theme, '') +
    rightPlate(L) +
    text(x - dx, ROW_TITLE, SIZE.title, esc(title), `letter-spacing=".2" ${fill(titleFill)} filter="url(#shadow)"`) +
    line +
    crownsMark(L, q.crowns, dx) +
    '</svg>'
  )
}

export type SheetArt = { theme: Theme; title: string; stats: string; crowns: string | null }

// The character sheet, shown in the quest's place while the pointer is on the character.
export const sheetSvg = (L: Layout, s: SheetArt): string => {
  if (L.quest === null) return ''
  const dx = L.split
  const { x, right } = L.quest
  const room = right - x
  return (
    svgOpen(L.width - L.split, s.theme, '') +
    rightPlate(L) +
    text(x - dx, ROW_TITLE, SIZE.title, esc(fitText(s.title, room, t => textWidth(t, SIZE.title))), `letter-spacing=".2" ${fill('title')} filter="url(#shadow)"`) +
    text(x - dx, ROW_LINE, SIZE.body, esc(fitText(s.stats, room, t => textWidth(t, SIZE.body))), `${fill('text', NUMS)} filter="url(#shadow)"`) +
    crownsMark(L, s.crowns, dx) +
    '</svg>'
  )
}
