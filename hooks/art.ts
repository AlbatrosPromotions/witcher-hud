// The desktop HUD as SVG markup: the medallion and bars on the left, the quest tracker on the right.
import type { SignKey } from '../types'
import { ASH, BLOOD, GOLD, GOLD_HI, LOW_VITALITY, PARCHMENT, SIGNS, clip } from './lore'
import type { QuestLine } from './lore'

export const HUD_H = 40
export const CLUSTER_W = 350

const TITLE_FONT = "Cinzel, 'Trajan Pro', 'Big Caslon', 'Hoefler Text', Baskerville, Georgia, serif"
const BODY_FONT = "'Hoefler Text', Baskerville, 'Palatino Linotype', Palatino, Georgia, serif"
const NUM_FONT = "Baskerville, 'Hoefler Text', 'Palatino Linotype', Palatino, Georgia, serif"
const NUMS = 'style="font-variant-numeric: lining-nums tabular-nums"'

export type ClusterArt = {
  sign: SignKey | null
  isWorking: boolean
  vitality: number
  ghostFrom: number | null
  stamina: number | null
  adrenaline: number
  level: number
  xpFraction: number
  isLevelUp: boolean
  usd: number | null
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const r1 = (n: number) => Math.round(n * 10) / 10

const diamond = (cx: number, cy: number, h: number) =>
  `M${r1(cx)} ${r1(cy - h)}L${r1(cx + h)} ${r1(cy)}L${r1(cx)} ${r1(cy + h)}L${r1(cx - h)} ${r1(cy)}Z`

// Original line glyphs in the spirit of the five signs, drawn around (20, 20).
const glyph = (sign: SignKey | null, tint: string) => {
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

const GOLD_DEFS =
  `<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3DFA6"/><stop offset=".55" stop-color="#C9A55C"/><stop offset="1" stop-color="#7A5A26"/></linearGradient>` +
  `<linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1D1711"/><stop offset="1" stop-color="#0B0806"/></linearGradient>` +
  `<linearGradient id="rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C9A55C" stop-opacity="0"/><stop offset=".1" stop-color="#C9A55C" stop-opacity=".75"/><stop offset=".9" stop-color="#C9A55C" stop-opacity=".75"/><stop offset="1" stop-color="#C9A55C" stop-opacity="0"/></linearGradient>` +
  `<filter id="shadow" x="-10%" y="-40%" width="120%" height="180%"><feDropShadow dx="0" dy=".8" stdDeviation=".7" flood-color="#000" flood-opacity=".9"/></filter>`

// A dark plate with a gold hairline and pointed ends, so the HUD reads on a light theme as on a dark one.
const plate = (x0: number, x1: number, isLeftPointed: boolean) => {
  const [top, mid, bottom, tip] = [3, 20, 37, 8]
  const left = isLeftPointed ? x0 + tip : x0
  const d = `M${left} ${top}H${x1 - tip}L${x1} ${mid}L${x1 - tip} ${bottom}H${left}${isLeftPointed ? `L${x0} ${mid}` : ''}Z`
  return `<path d="${d}" fill="url(#plate)" fill-opacity=".96" stroke="url(#rim)" stroke-width=".9"/>`
}

export const clusterSvg = (a: ClusterArt): string => {
  const W = CLUSTER_W
  const H = HUD_H
  const X = 46
  const VW = 214
  const SW = 160
  const tint = a.sign ? SIGNS[a.sign].color : GOLD
  const halo = a.sign ? SIGNS[a.sign].glow : GOLD_HI
  const v = clamp(a.vitality, 0, 100)
  const vW = r1((VW * v) / 100)
  const ghost = a.ghostFrom !== null && a.ghostFrom > v ? r1((VW * (clamp(a.ghostFrom, 0, 100) - v)) / 100) : 0
  const sW = a.stamina === null ? 0 : r1((SW * clamp(a.stamina, 0, 100)) / 100)
  const xW = r1(VW * clamp(a.xpFraction, 0, 1))
  const isLow = v <= LOW_VITALITY

  const shake = a.isWorking
    ? `<animateTransform attributeName="transform" type="rotate" values="0 20 20;-7 20 20;6 20 20;-5 20 20;3 20 20;0 20 20;0 20 20" keyTimes="0;.07;.14;.21;.28;.36;1" dur="1.3s" repeatCount="indefinite"/>`
    : ''
  const aura = a.isWorking
    ? `<circle cx="20" cy="20" r="18.4" fill="none" stroke="${halo}" stroke-width="2" filter="url(#glow)" opacity=".15"><animate attributeName="opacity" values=".1;.75;.1" dur="1.3s" repeatCount="indefinite"/></circle>`
    : ''
  const studs = [0, 90, 180, 270]
    .map(deg => {
      const rad = (deg * Math.PI) / 180
      return `<path d="${diamond(20 + 18.2 * Math.sin(rad), 20 - 18.2 * Math.cos(rad), 1.7)}" fill="url(#gold)" stroke="#1C150D" stroke-width=".4"/>`
    })
    .join('')
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const rad = ((i * 30 + 15) * Math.PI) / 180
    const p = (r: number) => `${r1(20 + r * Math.sin(rad))} ${r1(20 - r * Math.cos(rad))}`
    return `M${p(15.9)}L${p(17.1)}`
  }).join('')

  const emblem =
    `<g>${shake}${aura}` +
    `<circle cx="20" cy="20" r="18.2" fill="url(#well)" stroke="url(#gold)" stroke-width="1.8"/>` +
    `<circle cx="20" cy="20" r="15.3" fill="none" stroke="#5E4520" stroke-width=".8"/>` +
    `<path d="${ticks}" stroke="#8C6A2E" stroke-width=".7"/>${studs}` +
    `<g filter="url(#glow)">${glyph(a.sign, tint)}</g></g>`

  const pips = [0, 1, 2]
    .map(i => {
      const d = diamond(X + 4 + i * 9, 7.9, 2.7)
      return i < a.adrenaline
        ? `<path d="${d}" fill="url(#pip)" filter="url(#glow)"/>`
        : `<path d="${d}" fill="#15110C" stroke="#6A5228" stroke-width=".7"/>`
    })
    .join('')

  const vitality =
    `<rect x="${X - 0.6}" y="11.6" width="${VW + 1.2}" height="9.6" rx="1.6" fill="#1B0A08" stroke="#4A1F19" stroke-width=".8"/>` +
    (ghost > 0
      ? `<rect x="${r1(X + vW)}" y="12.1" width="${ghost}" height="8.6" fill="#F3B9AC" opacity=".9"><animate attributeName="width" from="${ghost}" to="0" begin=".45s" dur=".8s" fill="freeze"/></rect>`
      : '') +
    `<rect x="${X}" y="12.1" width="${vW}" height="8.6" rx="1" fill="url(#vit)"/>` +
    `<rect x="${X}" y="12.7" width="${vW}" height="1.1" fill="#FFCDBE" opacity=".35"/>` +
    (isLow
      ? `<rect x="${X}" y="12.1" width="${vW}" height="8.6" rx="1" fill="#FF7A62" opacity="0"><animate attributeName="opacity" values="0;.55;0;.35;0;0" keyTimes="0;.1;.2;.3;.42;1" dur="1.2s" repeatCount="indefinite"/></rect>`
      : '') +
    `<path d="M${X + VW + 3} 10.6V22.2" stroke="url(#gold)" stroke-width="1.2"/>`

  const stamina =
    a.stamina === null
      ? ''
      : `<rect x="${X - 0.5}" y="23.4" width="${SW + 1}" height="4.6" rx="1" fill="#17130A" stroke="#43361A" stroke-width=".7"/>` +
        `<rect x="${X}" y="23.9" width="${sW}" height="3.6" rx=".8" fill="url(#sta)"/>`

  const xp =
    `<rect x="${X}" y="30.6" width="${VW}" height="1.5" fill="#2A2317"/>` +
    `<rect x="${X}" y="30.6" width="${xW}" height="1.5" fill="url(#xp)"/>`

  const NX = X + VW + 10
  const numbers =
    `<text x="${NX}" y="20.4" font-family="${NUM_FONT}" font-size="12.5" ${NUMS} fill="${isLow ? '#FF8A73' : PARCHMENT}" filter="url(#shadow)">${Math.round(v)}%</text>` +
    `<circle cx="${NX + 3.6}" cy="29.4" r="3.6" fill="url(#gold)" stroke="#4E3A1B" stroke-width=".5"/>` +
    `<circle cx="${NX + 3.6}" cy="29.4" r="1.9" fill="none" stroke="#7A5A26" stroke-width=".7"/>` +
    `<text x="${NX + 10}" y="33.2" font-family="${NUM_FONT}" font-size="11.5" ${NUMS} fill="${GOLD}" filter="url(#shadow)">${a.usd === null ? '—' : a.usd.toFixed(2)}</text>`

  const LX = 326
  const level =
    (a.isLevelUp
      ? `<path d="${diamond(LX, 20, 14)}" fill="none" stroke="${GOLD_HI}" stroke-width="1.3" filter="url(#glow)"><animate attributeName="opacity" values=".15;1;.15" dur="1s" repeatCount="indefinite"/></path>`
      : '') +
    `<path d="${diamond(LX, 20, 11)}" fill="#120E0A" stroke="url(#gold)" stroke-width="1.4"/>` +
    `<path d="${diamond(LX, 20, 8.2)}" fill="none" stroke="#5E4520" stroke-width=".7"/>` +
    `<text x="${LX}" y="24.3" text-anchor="middle" font-family="${NUM_FONT}" font-size="${a.level >= 10 ? 10.5 : 12.5}" font-weight="600" ${NUMS} fill="${GOLD_HI}">${a.level}</text>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>${GOLD_DEFS}` +
    `<radialGradient id="well" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#2F271D"/><stop offset="1" stop-color="#090705"/></radialGradient>` +
    `<linearGradient id="vit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E35D49"/><stop offset=".45" stop-color="#B3301F"/><stop offset="1" stop-color="#66110B"/></linearGradient>` +
    `<linearGradient id="sta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F8E08A"/><stop offset=".5" stop-color="#D9A72E"/><stop offset="1" stop-color="#8E6510"/></linearGradient>` +
    `<linearGradient id="xp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7A5A26"/><stop offset="1" stop-color="#F1D99A"/></linearGradient>` +
    `<radialGradient id="pip" cx=".5" cy=".4" r=".62"><stop offset="0" stop-color="#FFFBEA"/><stop offset=".55" stop-color="#F0D58E"/><stop offset="1" stop-color="#A7823A"/></radialGradient>` +
    `<filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `</defs>` +
    plate(14, W - 2, false) +
    emblem +
    pips +
    vitality +
    stamina +
    xp +
    numbers +
    level +
    `</svg>`
  )
}

export const questSvg = (q: QuestLine, width: number): string => {
  const W = Math.round(width)
  const H = HUD_H
  const titleChars = Math.max(6, Math.floor((W - 41) / 7.6))
  const objectiveChars = Math.max(6, Math.floor((W - 50) / 6.2))
  const tone = { active: PARCHMENT, done: GOLD, failed: '#D27466', idle: ASH }[q.tone]
  const bullet = {
    active: `<path d="${diamond(29, 29.3, 2.6)}" fill="#E2D8BF"/>`,
    idle: `<path d="${diamond(29, 29.3, 2.4)}" fill="none" stroke="${ASH}" stroke-width=".9"/>`,
    done: `<path d="M26.2 29.3L28.4 31.6L32 27" fill="none" stroke="${GOLD}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    failed: `<path d="M26.7 27L31.3 31.6M31.3 27L26.7 31.6" stroke="${BLOOD}" stroke-width="1.4" stroke-linecap="round"/>`,
  }[q.tone]
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>${GOLD_DEFS}</defs>` +
    plate(2, W - 2, true) +
    `<path d="${diamond(18.5, 12.2, 3.6)}" fill="url(#gold)"/><circle cx="18.5" cy="12.2" r="1.1" fill="#0B0907"/>` +
    `<text x="27" y="16.6" font-family="${TITLE_FONT}" font-size="13.5" letter-spacing=".3" fill="${q.tone === 'idle' ? '#A88F5E' : GOLD}" filter="url(#shadow)">${esc(clip(q.title, titleChars))}</text>` +
    bullet +
    `<text x="36" y="33.2" font-family="${BODY_FONT}" font-size="12" fill="${tone}" filter="url(#shadow)">${esc(clip(q.objective, objectiveChars))}</text>` +
    `</svg>`
  )
}
