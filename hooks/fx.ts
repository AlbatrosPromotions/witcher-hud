// The desktop HUD's effects: the spell each sign casts from the medallion, the moments that take the
// quest tracker's place for a few seconds (a quest completed, a level, a monster met or slain, a
// trophy, meditation), the damage figure, the danger heartbeat and the plate's ambient life.
//
// Every effect is CSS on its own clock: each is drawn with the time it started (`at`, on the
// session's clock) and the drawing's time (`now`), and its animation is delayed by the difference,
// so a redrawn frame takes it up where it stands, and a moment queued for later waits its turn
// without a redraw. A finished effect ends where it began: invisible (`.fx`, `both` fill). Under
// reduce motion nothing animates and every `.fx` stays hidden.
import type { SignKey } from '../types'
import { MID, PLATE_BOTTOM, PLATE_TOP, ROW_LINE, ROW_TITLE, SIZE, baselineAt, fitText, textWidth } from './layout'
import type { Layout } from './layout'

export type Period = 'dawn' | 'day' | 'dusk' | 'night'
export type Tone = 'gold' | 'blood' | 'night' | 'green'
export type BannerKind = 'quest-done' | 'quest-failed' | 'level' | 'monster' | 'slain' | 'trophy' | 'restored'

// A moment as the drawing shows it: its words are already in the HUD's language.
export type Banner = {
  kind: BannerKind
  at: number
  ms: number
  title: string
  line: string
  // The experience a completed quest earned, flown into the level badge.
  xp?: string
  // The vitality meditation restored, refilled along the bar.
  restore?: { from: number; to: number }
}

export type FxArt = {
  now: number
  spell: { key: SignKey; at: number } | null
  hit: { at: number; delta: number } | null
  banners: Banner[]
  meditating: { at: number; title: string; line: string } | null
  period: Period
}

export const SPELL_MS: Record<SignKey, number> = { igni: 1000, aard: 950, quen: 1250, yrden: 1350, axii: 1150, senses: 1400 }
export const HIT_MS = 1400
export const BANNER_MS: Record<BannerKind, number> = {
  'quest-done': 2800,
  'quest-failed': 2000,
  level: 4200,
  monster: 2600,
  slain: 2600,
  trophy: 3400,
  restored: 2600,
}

const TONE: Record<BannerKind, Tone> = {
  'quest-done': 'gold',
  'quest-failed': 'blood',
  level: 'gold',
  monster: 'blood',
  slain: 'gold',
  trophy: 'gold',
  restored: 'green',
}

// The motions' keyframes. `--dx`, `--dy`, `--to`, `--o`: each element's own distances and strength.
export const FX_CSS =
  '.fx{opacity:0;pointer-events:none}.fxc{transform-box:fill-box;transform-origin:center}' +
  '@keyframes whud-flare{0%{opacity:0;transform:scale(.4,.6)}25%{opacity:.95;transform:scale(.9,.9)}100%{opacity:0;transform:scale(1.6,1)}}' +
  '@keyframes whud-spark{0%{opacity:0;transform:translate(0,0)}10%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy))}}' +
  '@keyframes whud-wave{0%{opacity:0;transform:scale(1,1)}4%{opacity:.95}100%{opacity:0;transform:scale(var(--sx),var(--sy))}}' +
  '@keyframes whud-shield{0%{opacity:0;transform:scale(.6)}18%{opacity:1;transform:scale(1.12)}30%{opacity:1;transform:scale(1)}75%{opacity:.85;transform:scale(1)}100%{opacity:0;transform:scale(1.04)}}' +
  '@keyframes whud-flicker{0%{opacity:0}15%{opacity:.8}30%{opacity:.2}45%{opacity:.7}70%{opacity:.3}100%{opacity:0}}' +
  '@keyframes whud-twinkle{0%,100%{opacity:0;transform:scale(.2)}50%{opacity:var(--o,1);transform:scale(1)}}' +
  '@keyframes whud-rune{0%{opacity:0;transform:rotate(-60deg) scale(1.25)}25%{opacity:1;transform:rotate(-10deg) scale(1)}80%{opacity:.9;transform:rotate(30deg) scale(1)}100%{opacity:0;transform:rotate(45deg) scale(.95)}}' +
  '@keyframes whud-contract{0%{opacity:0;transform:scale(1.7)}30%{opacity:.9}100%{opacity:0;transform:scale(.3)}}' +
  '@keyframes whud-spin{0%{opacity:0;transform:rotate(0)}30%{opacity:.85}100%{opacity:0;transform:rotate(-320deg)}}' +
  '@keyframes whud-ring{0%{opacity:0;transform:scale(1)}5%{opacity:.9}100%{opacity:0;transform:scale(2.3)}}' +
  '@keyframes whud-sweep{0%{opacity:0;transform:translateX(0)}8%{opacity:1}88%{opacity:1}100%{opacity:0;transform:translateX(var(--to))}}' +
  '@keyframes whud-rise{0%{opacity:0;transform:translateY(2px)}15%{opacity:1;transform:translateY(0)}70%{opacity:1}100%{opacity:0;transform:translateY(-5px)}}' +
  '@keyframes whud-blink{0%{opacity:0}15%{opacity:var(--o)}100%{opacity:0}}' +
  '@keyframes whud-tremble{0%,22%,100%{transform:rotate(0)}4%{transform:rotate(-3deg)}8%{transform:rotate(3deg)}12%{transform:rotate(-2deg)}16%{transform:rotate(1.5deg)}}' +
  '@keyframes whud-beat{0%{opacity:0}6%{opacity:.9}14%{opacity:.2}22%{opacity:.65}42%,100%{opacity:0}}' +
  '@keyframes whud-star{0%,100%{opacity:0}50%{opacity:var(--o)}}' +
  '@keyframes whud-banner{0%{opacity:0;transform:translateX(-8px)}7%{opacity:1;transform:translateX(0)}90%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(0)}}' +
  '@keyframes whud-draw{0%{stroke-dashoffset:100;opacity:0}2%{opacity:1}22%{stroke-dashoffset:0;opacity:1}70%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}' +
  '@keyframes whud-chip{0%{opacity:0;transform:scale(.7)}10%{opacity:1;transform:scale(1.15)}22%{opacity:1;transform:scale(1)}75%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-4px)}}' +
  '@keyframes whud-arc{0%{opacity:0;transform:translate(0,0) scale(1)}15%{opacity:1}50%{transform:translate(var(--mx),var(--my)) scale(1.2)}88%{opacity:1;transform:translate(var(--dx),var(--dy)) scale(.8)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.4)}}' +
  '@keyframes whud-fly{0%{opacity:0;transform:translate(0,0) scale(.8)}10%{opacity:1;transform:translate(0,0) scale(1.15)}30%{opacity:1;transform:translate(0,0) scale(1)}80%{opacity:.9;transform:translate(calc(var(--dx) * .85),calc(var(--dy) * .85)) scale(.6)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.35)}}' +
  '@keyframes whud-pop{0%,100%{transform:scale(1)}35%{transform:scale(1.28)}60%{transform:scale(.96)}}' +
  '@keyframes whud-jolt{0%,100%{transform:translateX(0)}12%{transform:translateX(-3px)}24%{transform:translateX(3px)}36%{transform:translateX(-2px)}48%{transform:translateX(1px)}60%{transform:translateX(0)}}' +
  '@keyframes whud-refill{0%,15%{transform:scaleX(1)}100%{transform:scaleX(0)}}' +
  '@keyframes whud-rays{0%{opacity:0;transform:rotate(-10deg)}20%{opacity:.7}70%{opacity:.5}100%{opacity:0;transform:rotate(28deg)}}' +
  '@keyframes whud-flame{0%,100%{transform:scaleY(1) skewX(0)}25%{transform:scaleY(1.2) skewX(-5deg)}50%{transform:scaleY(.88) skewX(4deg)}75%{transform:scaleY(1.1) skewX(-2deg)}}' +
  '@keyframes whud-dusk{0%{opacity:0}100%{opacity:var(--o)}}' +
  '@keyframes whud-in{0%{opacity:0}100%{opacity:1}}' +
  '@keyframes whud-out{0%{opacity:1}100%{opacity:0}}' +
  '@keyframes whud-jet{0%{opacity:0;transform:scale(.08,.4)}18%{opacity:1;transform:scale(1,1)}55%{opacity:.85;transform:scale(1.35,.9)}100%{opacity:0;transform:scale(1.7,.5)}}' +
  '@media (prefers-reduced-motion:reduce){.fx,.fxr{display:none}}'

// Effect colours, after the theme: bright on the dark plate, deep on parchment.
export const FX_DARK: Record<string, string> = {
  'fx-gold': '#F6DFA0',
  'fx-blood': '#FF7A62',
  'fx-night': '#BCCBFF',
  'fx-green': '#A6E8B2',
  'fx-flash': '#F1D99A',
  'fx-shine': '#FFF0CC',
  'night-fill': '#0B1330',
  'amb-dawn': 'rgba(255,130,140,.07)',
  'amb-day': 'rgba(0,0,0,0)',
  'amb-dusk': 'rgba(255,150,60,.08)',
  'amb-night': 'rgba(80,110,210,.10)',
  star: '#FFF3CF',
  danger: '#E0442E',
}

export const FX_LIGHT: Record<string, string> = {
  'fx-gold': '#7A5512',
  'fx-blood': '#A82A1A',
  'fx-night': '#33467F',
  'fx-green': '#2B6E3A',
  'fx-flash': '#E9C46A',
  'fx-shine': '#FFFFFF',
  'night-fill': '#AEBBE3',
  'amb-dawn': 'rgba(230,120,130,.08)',
  'amb-day': 'rgba(0,0,0,0)',
  'amb-dusk': 'rgba(230,140,40,.08)',
  'amb-night': 'rgba(70,90,170,.08)',
  star: '#8C7448',
  danger: '#C0473B',
}

const r1 = (n: number) => Math.round(n * 10) / 10
const ms = (n: number) => Math.round(n)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// One run of a motion, `delay` from the drawing's time (negative: it began that long ago).
const once = (name: string, length: number, delay: number, ease = 'ease-out') =>
  `animation:${name} ${ms(length)}ms ${ease} ${ms(delay)}ms 1 both`

// A motion that loops on the session's clock, so every frame shows it at the same point.
const loop = (name: string, length: number, now: number, offset = 0, ease = 'ease-in-out') =>
  `animation:${name} ${ms(length)}ms ${ease} -${ms((((now + offset) % length) + length) % length)}ms infinite`

// A fixed scatter: the same for every frame, so a frame's markup is the same for the same moment.
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

const ink = (key: SignKey) => `var(--sign-${key})`

const diamond = (cx: number, cy: number, h: number) =>
  `M${r1(cx)} ${r1(cy - h)}L${r1(cx + h)} ${r1(cy)}L${r1(cx)} ${r1(cy + h)}L${r1(cx - h)} ${r1(cy)}Z`

// The gradients the effects paint with; only the active sign's are drawn.
export const fxDefs = (fx: FxArt | undefined) => {
  if (fx === undefined) return ''
  const sign = fx.spell?.key
  const signDefs =
    sign === undefined
      ? ''
      : `<radialGradient id="fx-flare"><stop offset="0" style="stop-color:${ink(sign)};stop-opacity:.85"/><stop offset=".5" style="stop-color:${ink(sign)};stop-opacity:.3"/><stop offset="1" style="stop-color:${ink(sign)};stop-opacity:0"/></radialGradient>` +
        `<linearGradient id="fx-rim"><stop offset="0" style="stop-color:${ink(sign)};stop-opacity:0"/><stop offset=".7" style="stop-color:${ink(sign)};stop-opacity:.9"/><stop offset="1" style="stop-color:${ink(sign)};stop-opacity:0"/></linearGradient>` +
        `<linearGradient id="fx-jet"><stop offset="0" style="stop-color:#FFF1C9;stop-opacity:.95"/><stop offset=".25" style="stop-color:${ink(sign)};stop-opacity:.85"/><stop offset="1" style="stop-color:${ink(sign)};stop-opacity:0"/></linearGradient>` +
        `<linearGradient id="fx-scan"><stop offset="0" style="stop-color:${ink(sign)};stop-opacity:0"/><stop offset=".8" style="stop-color:${ink(sign)};stop-opacity:.28"/><stop offset=".97" style="stop-color:${ink(sign)};stop-opacity:.75"/><stop offset="1" style="stop-color:${ink(sign)};stop-opacity:0"/></linearGradient>`
  return (
    signDefs +
    `<linearGradient id="fx-shine"><stop offset="0" style="stop-color:var(--fx-shine);stop-opacity:0"/><stop offset=".5" style="stop-color:var(--fx-shine);stop-opacity:.55"/><stop offset="1" style="stop-color:var(--fx-shine);stop-opacity:0"/></linearGradient>` +
    // The plate's height: what passes it is cut there, not at the frame's edge.
    `<clipPath id="fx-band"><rect x="0" y="${PLATE_TOP}" width="100%" height="${PLATE_BOTTOM - PLATE_TOP}"/></clipPath>` +
    `<linearGradient id="fx-wash-blood"><stop offset="0" style="stop-color:var(--fx-blood)"/><stop offset=".55" style="stop-color:var(--fx-blood);stop-opacity:.6"/><stop offset="1" style="stop-color:var(--fx-blood);stop-opacity:0"/></linearGradient>` +
    `<linearGradient id="fx-beat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--danger);stop-opacity:.7"/><stop offset=".26" style="stop-color:var(--danger);stop-opacity:0"/><stop offset=".74" style="stop-color:var(--danger);stop-opacity:0"/><stop offset="1" style="stop-color:var(--danger);stop-opacity:.7"/></linearGradient>` +
    `<radialGradient id="fx-ray" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(80)"><stop offset="0" style="stop-color:var(--fx-flash);stop-opacity:.9"/><stop offset="1" style="stop-color:var(--fx-flash);stop-opacity:0"/></radialGradient>`
  )
}

// --- The plate's own layers: drawn with the plate's outline, so they never pass its edge. ---

export type PlateLayer = { fill: string; css: string; cls: string }

export const plateLayers = (fx: FxArt | undefined, isDanger: boolean): PlateLayer[] => {
  if (fx === undefined) return []
  const out: PlateLayer[] = []
  if (fx.period !== 'day') out.push({ fill: `var(--amb-${fx.period})`, css: '', cls: '' })
  if (fx.meditating !== null)
    out.push({ fill: 'var(--night-fill)', css: `--o:.6;${once('whud-dusk', 900, fx.meditating.at - fx.now)}`, cls: 'fx' })
  if (isDanger) out.push({ fill: 'url(#fx-beat)', css: loop('whud-beat', 1200, fx.now, 0, 'linear'), cls: 'fx' })
  for (const b of fx.banners)
    if (b.kind === 'level') out.push({ fill: 'var(--fx-flash)', css: `--o:.28;${once('whud-blink', 1000, b.at - fx.now + 120)}`, cls: 'fx' })
  return out
}

// --- Spells, cast from the medallion at (MID, MID). ---

// An ellipse as tall as the frame, so its light has faded out where the frame cuts it.
const flare = (r: number, delay: number, length = 700) =>
  `<ellipse class="fx fxc" cx="${MID}" cy="${MID}" rx="${r}" ry="${MID}" fill="url(#fx-flare)" style="${once('whud-flare', length, delay)}"/>`

type Spark = { x: number; y: number; dx: number; dy: number; r: number; fill: string; length: number; delay: number }
const spark = (s: Spark) =>
  `<circle class="fx" cx="${r1(s.x)}" cy="${r1(s.y)}" r="${r1(s.r)}" style="fill:${s.fill};--dx:${r1(s.dx)}px;--dy:${r1(s.dy)}px;${once('whud-spark', s.length, s.delay, 'cubic-bezier(.2,.7,.3,1)')}"/>`

// Sparks from the medallion's rim, `from`..`to` degrees (0 is to the right), flying `near`..`far`.
const sparks = (n: number, salt: number, from: number, to: number, near: number, far: number, flat: number, fills: string[], delay: number, length: number, size = 1) =>
  Array.from({ length: n }, (_, i) => {
    const deg = from + ((to - from) * (i + rnd(i, salt) * 0.8)) / n
    const rad = (deg * Math.PI) / 180
    const dist = near + (far - near) * rnd(i, salt + 1)
    return spark({
      x: MID + 19 * Math.cos(rad),
      y: MID + 19 * Math.sin(rad),
      dx: dist * Math.cos(rad),
      dy: dist * Math.sin(rad) * flat,
      r: size * (0.7 + 0.9 * rnd(i, salt + 2)),
      fill: fills[i % fills.length]!,
      length: length * (0.75 + 0.5 * rnd(i, salt + 3)),
      delay: delay + 140 * rnd(i, salt + 4),
    })
  }).join('')

const hexPath = (r: number, turn: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const rad = ((60 * k + turn) * Math.PI) / 180
    return `${k === 0 ? 'M' : 'L'}${r1(MID + r * Math.cos(rad))} ${r1(MID + r * Math.sin(rad))}`
  }).join('') + 'Z'

const PIVOT = `transform-box:view-box;transform-origin:${MID}px ${MID}px`

// Behind the medallion: the sign's light swelling from it.
export const spellUnder = (fx: FxArt | undefined) => {
  const s = fx?.spell
  if (!fx || !s) return ''
  const d = s.at - fx.now
  return flare(s.key === 'axii' ? 24 : 30, d, s.key === 'quen' || s.key === 'yrden' ? 900 : 700)
}

// In front of it: what the sign does.
export const spellOver = (fx: FxArt | undefined) => {
  const s = fx?.spell
  if (!fx || !s) return ''
  const d = s.at - fx.now
  const c = ink(s.key)
  switch (s.key) {
    case 'igni':
      // A stream of fire from the medallion along the plate, and embers flying off it.
      return (
        `<ellipse class="fx" cx="${MID + 17 + 80}" cy="${MID}" rx="80" ry="9" fill="url(#fx-jet)" filter="url(#glow)" style="transform-box:fill-box;transform-origin:left center;${once('whud-jet', 760, d, 'cubic-bezier(.2,.7,.3,1)')}"/>` +
        `<ellipse class="fx" cx="${MID + 17 + 46}" cy="${MID}" rx="46" ry="3.2" fill="url(#fx-jet)" style="transform-box:fill-box;transform-origin:left center;${once('whud-jet', 620, d + 30, 'cubic-bezier(.2,.7,.3,1)')}"/>` +
        `<g filter="url(#glow)">${sparks(18, 1, -70, 70, 60, 220, 0.28, [c, '#FFE2A8', '#FF9A4A'], d + 60, 900, 1.3)}</g>`
      )
    case 'aard':
      return (
        [0, 150]
          .map(
            off =>
              `<ellipse class="fx fxc" cx="${MID}" cy="${MID}" rx="19" ry="19" fill="none" stroke-width="2" vector-effect="non-scaling-stroke" style="stroke:${c};--sx:16;--sy:1.6;${once('whud-wave', 820, d + off, 'cubic-bezier(.15,.6,.3,1)')}"/>`,
          )
          .join('') + sparks(9, 2, -22, 22, 90, 240, 0.25, [c, '#FFFFFF'], d + 40, 700)
      )
    case 'quen':
      return (
        `<path class="fx fxc" d="${hexPath(22, 0)}" stroke-width="1.6" stroke-linejoin="round" filter="url(#glow)" style="stroke:${c};fill:${c};fill-opacity:.12;${once('whud-shield', 1250, d)}"/>` +
        `<path class="fx fxc" d="${hexPath(20.4, 30)}" fill="none" stroke-width=".8" style="stroke:${c};${once('whud-flicker', 950, d + 120, 'linear')}"/>` +
        Array.from({ length: 6 }, (_, k) => {
          const rad = (60 * k * Math.PI) / 180
          return `<path class="fx fxc" d="${diamond(MID + 22 * Math.cos(rad), MID + 22 * Math.sin(rad), 2.2)}" style="fill:#FFF4CF;${once('whud-twinkle', 600, d + 160 + 70 * k)}"/>`
        }).join('')
      )
    case 'yrden': {
      // The trap's rune circle just outside the medallion (it stays inside the frame), and its field
      // spreading along the plate.
      const runes = Array.from({ length: 6 }, (_, k) => {
        const rad = ((60 * k + 30) * Math.PI) / 180
        return `<path d="${diamond(MID + 20.6 * Math.cos(rad), MID + 20.6 * Math.sin(rad), 1.5)}" style="fill:${c}"/>`
      }).join('')
      return (
        `<g class="fx" style="${PIVOT};${once('whud-rune', 1350, d, 'cubic-bezier(.3,.6,.4,1)')}">` +
        `<circle cx="${MID}" cy="${MID}" r="20.6" fill="none" stroke-width="1.1" stroke-dasharray="3.2 2" style="stroke:${c}"/>${runes}</g>` +
        `<ellipse class="fx fxc" cx="${MID}" cy="${MID}" rx="19" ry="15.5" fill="none" stroke-width="1.2" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" style="stroke:${c};--sx:9;--sy:1;${once('whud-wave', 1300, d + 120, 'cubic-bezier(.2,.6,.3,1)')}"/>` +
        sparks(6, 3, -60, 60, 26, 70, 0.4, [c], d + 200, 1000)
      )
    }
    case 'axii': {
      const spiral = Array.from({ length: 48 }, (_, i) => {
        const t = (i / 47) * 3 * Math.PI
        const r = 3 + (t / (3 * Math.PI)) * 20
        return `${i === 0 ? 'M' : 'L'}${r1(MID + r * Math.cos(t))} ${r1(MID + r * Math.sin(t))}`
      }).join('')
      return (
        [0, 160, 320]
          .map(
            off =>
              `<circle class="fx fxc" cx="${MID}" cy="${MID}" r="19" fill="none" stroke-width="1.3" vector-effect="non-scaling-stroke" style="stroke:${c};${once('whud-contract', 900, d + off, 'ease-in')}"/>`,
          )
          .join('') +
        `<path class="fx" d="${spiral}" fill="none" stroke-width=".9" stroke-linecap="round" style="stroke:${c};${PIVOT};${once('whud-spin', 1150, d, 'cubic-bezier(.4,0,.6,1)')}"/>`
      )
    }
    case 'senses':
      return [0, 260]
        .map(
          off =>
            `<circle class="fx fxc" cx="${MID}" cy="${MID}" r="19" fill="none" stroke-width="1.8" vector-effect="non-scaling-stroke" style="stroke:${c};${once('whud-ring', 900, d + off)}"/>`,
        )
        .join('')
  }
}

// Across the plate: the cast's light runs along its gold rims; Witcher Senses scan the whole plate.
export const spellAcross = (fx: FxArt | undefined) => {
  const s = fx?.spell
  if (!fx || !s) return ''
  const d = s.at - fx.now
  const rims = [PLATE_TOP, PLATE_BOTTOM - 1.6]
    .map(y => `<rect class="fx" x="${MID - 120}" y="${y}" width="120" height="1.6" fill="url(#fx-rim)" style="--to:1100px;${once('whud-sweep', 760, d + 40, 'ease-in')}"/>`)
    .join('')
  const scan =
    s.key === 'senses'
      ? `<rect class="fx" x="-90" y="${PLATE_TOP + 1}" width="90" height="${PLATE_BOTTOM - PLATE_TOP - 2}" fill="url(#fx-scan)" style="--to:1150px;${once('whud-sweep', 1400, d + 80, 'cubic-bezier(.45,0,.55,1)')}"/>`
      : ''
  return `<g clip-path="url(#from-mid)">${rims}${scan}</g>`
}

// --- The medallion in danger trembles; the badge glows and pops on a level. ---

export const trembleCss = (fx: FxArt | undefined) =>
  fx === undefined ? '' : `.tremble{${PIVOT};${loop('whud-tremble', 1200, fx.now, 0, 'linear')}}`

// --- The character's own effects, per band: the damage figure, the refill, the rush, the rays. ---

export const hitOf = (L: Layout, fx: FxArt | undefined, vitality: number) => {
  const h = fx?.hit
  if (!fx || !h || h.delta < 1) return ''
  const d = h.at - fx.now
  const inner = L.vit.w - 2
  const x = L.vit.x + 1 + Math.round((inner * clamp(vitality, 0, 100)) / 100)
  // The figure starts on the bar's top edge, outlined in the plate's colour so it reads over the bar.
  const cy = L.vit.y + 1
  return (
    `<rect class="fx" x="${L.vit.x + 1}" y="${L.vit.y + 1}" width="${inner}" height="${L.vit.h - 2}" rx="1" style="fill:var(--fx-blood);--o:.45;${once('whud-blink', 520, d)}"/>` +
    `<text class="tt fx" x="${x}" y="${baselineAt(cy, 12)}" text-anchor="middle" font-size="12" stroke-width="2.6" stroke-linejoin="round" style="fill:var(--fx-blood);stroke:var(--plate-top);paint-order:stroke;font-weight:700;${once('whud-rise', HIT_MS, d + 60)}">−${h.delta}%</text>`
  )
}

export const refillOf = (L: Layout, fx: FxArt | undefined) => {
  if (fx === undefined) return ''
  return fx.banners
    .filter(b => b.restore !== undefined && b.restore.to > b.restore.from)
    .map(b => {
      const d = b.at - fx.now
      const inner = L.vit.w - 2
      const x0 = L.vit.x + 1 + Math.round((inner * clamp(b.restore!.from, 0, 100)) / 100)
      const x1 = L.vit.x + 1 + Math.round((inner * clamp(b.restore!.to, 0, 100)) / 100)
      return (
        // The refilled stretch is covered, then uncovered from its start: the bar fills back up.
        `<rect class="fxr" x="${x0}" y="${L.vit.y + 1}" width="${x1 - x0}" height="${L.vit.h - 2}" style="fill:var(--vit-track);transform-box:fill-box;transform-origin:right center;${once('whud-refill', 1700, d + 200, 'cubic-bezier(.3,0,.2,1)')}"/>` +
        `<rect class="fx" x="${x0 - 4}" y="${L.vit.y}" width="4" height="${L.vit.h}" rx="1" style="fill:var(--fx-green);--to:${x1 - x0}px;${once('whud-sweep', 1500, d + 350, 'cubic-bezier(.3,0,.2,1)')}"/>`
      )
    })
    .join('')
}

export const rushOf = (L: Layout, fx: FxArt | undefined, adrenaline: number) => {
  if (fx === undefined || adrenaline < 3) return ''
  return L.pips.cys
    .map(
      (cy, i) =>
        `<path class="fx" d="${diamond(L.pips.cx, cy, L.pips.half + 0.9)}" filter="url(#glow)" style="fill:var(--fx-gold);${loop('whud-star', 1400, fx.now, i * 180)};--o:.75"/>`,
    )
    .join('')
}

export const raysOf = (L: Layout, fx: FxArt | undefined) => {
  if (fx === undefined) return ''
  const { cx, cy } = L.badge
  return fx.banners
    .filter(b => b.kind === 'level')
    .map(b => {
      const d = b.at - fx.now
      const rays = Array.from({ length: 12 }, (_, k) => {
        const a = (30 * k * Math.PI) / 180
        const w = 0.045
        const p = (r: number, t: number) => `${r1(r * Math.cos(a + t))} ${r1(r * Math.sin(a + t))}`
        return `M0 0L${p(80, -w)}L${p(80, w)}Z`
      }).join('')
      return `<g clip-path="url(#fx-band)"><g transform="translate(${cx} ${cy})"><path class="fx" d="${rays}" fill="url(#fx-ray)" style="transform-box:view-box;transform-origin:0 0;${once('whud-rays', 3200, d + 100, 'ease-out')}"/></g></g>`
    })
    .join('')
}

// The badge pops as a level comes, and its ring flashes as a quest's experience flies in.
export const badgeMotion = (fx: FxArt | undefined) => {
  if (fx === undefined) return ''
  const level = fx.banners.find(b => b.kind === 'level')
  return level === undefined ? '' : `transform-box:fill-box;transform-origin:center;${once('whud-pop', 800, level.at - fx.now + 200)}`
}

export const ringFlashOf = (L: Layout, fx: FxArt | undefined) => {
  if (fx === undefined) return ''
  const { cx, cy, ring } = L.badge
  const path = `M${cx} ${cy - ring}L${cx + ring} ${cy}L${cx} ${cy + ring}L${cx - ring} ${cy}Z`
  return fx.banners
    .filter(b => b.xp !== undefined)
    .map(
      b =>
        `<path class="fx" d="${path}" fill="none" stroke-width="3" stroke-linejoin="round" filter="url(#glow)" style="stroke:var(--fx-gold);--o:1;${once('whud-blink', 800, b.at - fx.now + 1420)}"/>`,
    )
    .join('')
}

// --- The plate's ambient life: stars over the character at night or in meditation. ---

const sparkle = (x: number, y: number, h: number) => {
  const k = h * 0.28
  return `M${r1(x)} ${r1(y - h)}L${r1(x + k)} ${r1(y - k)}L${r1(x + h)} ${r1(y)}L${r1(x + k)} ${r1(y + k)}L${r1(x)} ${r1(y + h)}L${r1(x - k)} ${r1(y + k)}L${r1(x - h)} ${r1(y)}L${r1(x - k)} ${r1(y - k)}Z`
}

// In the free strips above the vitality bar and under the stamina bar, never beside words.
export const ambientOf = (L: Layout, fx: FxArt | undefined) => {
  if (fx === undefined || (fx.period !== 'night' && fx.meditating === null)) return ''
  const top = (PLATE_TOP + L.vit.y) / 2
  const low = L.sta === null ? (L.vit.y + L.vit.h + PLATE_BOTTOM) / 2 : (L.sta.y + L.sta.h + PLATE_BOTTOM) / 2
  const room = Math.min(L.vit.y - PLATE_TOP, PLATE_BOTTOM - (L.sta === null ? L.vit.y + L.vit.h : L.sta.y + L.sta.h))
  const h = Math.max(1, Math.min(2, room / 2 - 0.6))
  return Array.from({ length: 7 }, (_, i) => {
    const x = L.vit.x + 6 + ((L.vit.w - 12) * i) / 6
    return `<path class="fx fxc" d="${sparkle(x, i % 2 === 0 ? top : low, h * (0.75 + 0.25 * rnd(i, 8)))}" style="fill:var(--star);--o:${r1(0.6 + 0.4 * rnd(i, 9))};${loop('whud-twinkle', ms(2600 + 1600 * rnd(i, 10)), fx.now, ms(5000 * rnd(i, 11)))}"/>`
  }).join('')
}

// --- The moments, in the quest tracker's place. ---

// The quest's own rows are gone this long after a moment begins, before its words come.
export const YIELD_MS = 120

const BANNER_SPACING = 1.4

// Their glyphs, 12px across about (gx, gy).
const iconOf = (kind: BannerKind | 'meditating', gx: number, gy: number, c: string) => {
  const line = (w = 1.5) => `fill="none" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" style="stroke:${c}"`
  switch (kind) {
    case 'quest-done':
      return `<path d="M${gx - 3.6} ${gy}L${gx - 1.1} ${gy + 2.5}L${gx + 3.6} ${gy - 2.8}" ${line(1.7)}/>`
    case 'quest-failed':
      return `<path d="M${gx - 2.8} ${gy - 2.8}L${gx + 2.8} ${gy + 2.8}M${gx + 2.8} ${gy - 2.8}L${gx - 2.8} ${gy + 2.8}" ${line(1.7)}/>`
    case 'level':
    case 'restored':
      return `<path d="M${gx} ${gy - 6}L${gx + 1.6} ${gy - 1.6}L${gx + 6} ${gy}L${gx + 1.6} ${gy + 1.6}L${gx} ${gy + 6}L${gx - 1.6} ${gy + 1.6}L${gx - 6} ${gy}L${gx - 1.6} ${gy - 1.6}Z" style="fill:${c}"/>`
    case 'monster':
      return [-3.5, 0, 3.5].map(o => `<path d="M${gx + o - 1.6} ${gy - 5}Q${gx + o + 1.4} ${gy} ${gx + o - 0.6} ${gy + 5}" ${line(1.3)}/>`).join('')
    case 'slain':
      return (
        `<path d="M${gx - 4.6} ${gy + 4.6}L${gx + 4.8} ${gy - 4.8}" ${line(1.6)}/>` +
        `<path d="M${gx - 4.4} ${gy + 0.8}L${gx - 0.8} ${gy + 4.4}" ${line(1.3)}/>` +
        `<circle cx="${gx - 5.4}" cy="${gy + 5.4}" r="1" style="fill:${c}"/>`
      )
    case 'trophy':
      return (
        `<path d="M${gx - 3.8} ${gy - 5}H${gx + 3.8}V${gy - 2}Q${gx + 3.8} ${gy + 1.6} ${gx} ${gy + 1.8}Q${gx - 3.8} ${gy + 1.6} ${gx - 3.8} ${gy - 2}Z" style="fill:${c}"/>` +
        `<path d="M${gx - 3.8} ${gy - 3.8}Q${gx - 6.2} ${gy - 3.6} ${gx - 4.6} ${gy - 0.6}M${gx + 3.8} ${gy - 3.8}Q${gx + 6.2} ${gy - 3.6} ${gx + 4.6} ${gy - 0.6}M${gx} ${gy + 1.8}V${gy + 4}M${gx - 3} ${gy + 5}H${gx + 3}" ${line(1.1)}/>`
      )
    case 'meditating': {
      // A campfire: crossed logs, two flames that flicker.
      const flame = (dx: number, h: number, len: number) =>
        `<path d="M${gx + dx} ${gy + 2.6}Q${gx + dx - 2.6} ${gy - h / 3} ${gx + dx} ${gy + 2.6 - h}Q${gx + dx + 2.6} ${gy - h / 3} ${gx + dx} ${gy + 2.6}Z" style="fill:${dx === 0 ? '#FFB070' : '#F07A3C'};transform-box:fill-box;transform-origin:center bottom;animation:whud-flame ${len}ms ease-in-out infinite"/>`
      return (
        flame(-1.6, 6, 700) +
        flame(0.4, 8.4, 900) +
        `<path d="M${gx - 5} ${gy + 5.2}L${gx + 5} ${gy + 2.8}M${gx - 5} ${gy + 2.8}L${gx + 5} ${gy + 5.2}" fill="none" stroke-width="1.6" stroke-linecap="round" style="stroke:#8C6A2E"/>`
      )
    }
  }
}

const textAt = (x: number, centre: number, size: number, body: string, style: string, spacing = 0) =>
  `<text class="tt" x="${r1(x)}" y="${baselineAt(centre, size)}" font-size="${size}"${spacing ? ` letter-spacing="${spacing}"` : ''} filter="url(#shadow)" style="${style}">${body}</text>`

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// A moment's words are cut to a few steps of room, not to each band's own: a moment is drawn in
// every band, and its markup is then the same across most of them (art.ts draws a run once).
const ROOM_STEPS = [720, 560, 440, 340, 260, 200, 150, 110, 0]
const roomOf = (room: number) => ROOM_STEPS.find(step => step <= room) ?? 0

// The two rows of a moment: its title in spaced capitals, its line under it after the glyph.
const rowsOf = (L: Layout, kind: BannerKind | 'meditating', tone: Tone, title: string, line: string) => {
  const q = L.quest!
  const c = `var(--fx-${tone})`
  const top = fitText(title.toUpperCase(), roomOf(q.right - q.x), t => textWidth(t, SIZE.title, BANNER_SPACING))
  const bottom = fitText(line, roomOf(q.right - q.textX), t => textWidth(t, SIZE.body))
  const gx = q.glyph.x + q.glyph.w / 2
  const gy = q.glyph.y + q.glyph.h / 2
  return (
    `<g filter="url(#glow)">${textAt(q.x, ROW_TITLE, SIZE.title, esc(top), `fill:${c}`, BANNER_SPACING)}</g>` +
    iconOf(kind, gx, gy, c) +
    textAt(q.textX, ROW_LINE, SIZE.body, esc(bottom), 'fill:var(--text)')
  )
}

// The light and the flash stay in the quest's room (its step, so they are the same across bands).
const shine = (L: Layout, delay: number) => {
  const q = L.quest!
  return `<rect class="fx" x="${q.x - 90}" y="${PLATE_TOP + 1}" width="90" height="${PLATE_BOTTOM - PLATE_TOP - 2}" fill="url(#fx-shine)" style="--to:${roomOf(q.right - q.x)}px;${once('whud-sweep', 1300, delay, 'ease-in-out')}"/>`
}

const flash = (L: Layout, delay: number, fill: 'blood', strength: number) => {
  const q = L.quest!
  return `<rect class="fx" x="${q.x - 6}" y="${PLATE_TOP + 1}" width="${roomOf(q.right - q.x) + 12}" height="${PLATE_BOTTOM - PLATE_TOP - 2}" fill="url(#fx-wash-${fill})" style="--o:${strength};${once('whud-blink', 700, delay)}"/>`
}

// A stroke drawn across the quest's room, quickly, then fading.
const slash = (x0: number, y0: number, x1: number, y1: number, c: string, width: number, delay: number, glow = false) =>
  `<path class="fx" d="M${r1(x0)} ${r1(y0)}Q${r1((x0 + x1) / 2 + 4)} ${r1((y0 + y1) / 2 - 2)} ${r1(x1)} ${r1(y1)}" pathLength="100" stroke-dasharray="100" fill="none" stroke-width="${width}" stroke-linecap="round"${glow ? ' filter="url(#glow)"' : ''} style="stroke:${c};${once('whud-draw', 900, delay, 'cubic-bezier(.2,.8,.3,1)')}"/>`

// Where a moment's words end: after its line, or after its title where the line fills its room.
const after = (L: Layout, b: Banner): { x: number; end: number; row: 'line' | 'title' } => {
  const q = L.quest!
  const lineRoom = roomOf(q.right - q.textX)
  const line = Math.min(lineRoom, textWidth(b.line, SIZE.body))
  if (line + 60 <= lineRoom) return { x: q.textX + line + 10, end: q.textX + lineRoom, row: 'line' }
  const titleRoom = roomOf(q.right - q.x)
  const title = Math.min(titleRoom, textWidth(b.title.toUpperCase(), SIZE.title, BANNER_SPACING))
  return { x: q.x + title + 12, end: q.x + titleRoom, row: 'title' }
}

const sparkBurst = (gx: number, gy: number, delay: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * 2 * Math.PI + rnd(i, 21)
    const dist = 10 + 14 * rnd(i, 22)
    return `<path class="fx" d="${diamond(gx, gy, 1.3)}" style="fill:var(--fx-gold);--dx:${r1(dist * Math.cos(a))}px;--dy:${r1(dist * Math.sin(a) * 0.7)}px;${once('whud-spark', 800, delay + 60 * rnd(i, 23), 'cubic-bezier(.2,.7,.3,1)')}"/>`
  }).join('')

// What plays around a moment's words; it reads only the quest's left side and the badge, the same
// in every band of one layout.
const extrasOf = (L: Layout, b: Banner, d: number) => {
  const q = L.quest!
  const gx = q.glyph.x + q.glyph.w / 2
  const gy = q.glyph.y + q.glyph.h / 2
  switch (b.kind) {
    case 'quest-done': {
      if (b.xp === undefined) return shine(L, d + 150)
      // The experience shows after the line's words, then flies into the level badge.
      const chipW = textWidth(b.xp, 10.5, 0, true)
      const slot = after(L, b)
      const row = slot.row === 'line' ? ROW_LINE : ROW_TITLE
      if (slot.x + chipW > slot.end) return shine(L, d + 150)
      // The figure pops up where the words end; three motes of it fly over them into the badge.
      const chip =
        `<text class="tt fx" x="${r1(slot.x)}" y="${baselineAt(row, 10.5)}" font-size="10.5" filter="url(#glow)" style="fill:var(--fx-gold);font-weight:700;transform-box:fill-box;transform-origin:left center;${once('whud-chip', 1900, d + 300)}">${esc(b.xp)}</text>`
      const sx = slot.x + 6
      const dx = L.badge.cx - sx
      const dy = L.badge.cy - row
      const motes = [0, 1, 2]
        .map(
          i =>
            `<path class="fx" d="${diamond(sx, row, 2)}" filter="url(#glow)" style="fill:var(--fx-gold);--dx:${r1(dx)}px;--dy:${r1(dy)}px;--mx:${r1(dx / 2)}px;--my:${r1(-row + PLATE_TOP + 3 + i * 3)}px;transform-box:fill-box;transform-origin:center;${once('whud-arc', 700, d + 700 + i * 80, 'cubic-bezier(.45,0,.55,1)')}"/>`,
        )
        .join('')
      return shine(L, d + 150) + chip + motes
    }
    case 'quest-failed':
      return flash(L, d, 'blood', 0.3)
    case 'level':
      return shine(L, d + 250)
    case 'monster': {
      // Claw marks torn across the plate after the words, where they fit.
      const x = Math.max(after(L, b).x, q.x + textWidth(b.title.toUpperCase(), SIZE.title, BANNER_SPACING) + 14)
      const claws =
        x + 50 > q.x + roomOf(q.right - q.x)
          ? ''
          : [0, 1, 2].map(i => slash(x + i * 12, PLATE_TOP + 3, x + 20 + i * 12, PLATE_BOTTOM - 3, 'var(--fx-blood)', 2.2, d + 140 + i * 70)).join('')
      return flash(L, d, 'blood', 0.3) + claws
    }
    case 'slain':
      return slash(q.x + 4, PLATE_BOTTOM - 4, q.x + 190, PLATE_TOP + 4, 'var(--fx-gold)', 2.4, d + 40, true) + shine(L, d + 380)
    case 'trophy':
      return shine(L, d + 200) + sparkBurst(gx, gy, d + 120)
    case 'restored':
      return shine(L, d + 300)
  }
}

// Every moment's words, each on its own turn, and meditation's while it lasts.
export const bannersOf = (L: Layout, fx: FxArt | undefined) => {
  if (fx === undefined || L.quest === null) return ''
  const moments = fx.banners
    .map(b => {
      const d = b.at - fx.now
      const rows = rowsOf(L, b.kind, TONE[b.kind], b.title, b.line)
      const body = b.kind === 'quest-failed' || b.kind === 'monster' ? `<g style="${once('whud-jolt', 520, d + 40)}">${rows}</g>` : rows
      return `<g class="fx" style="${once('whud-banner', b.ms - YIELD_MS, d + YIELD_MS, 'linear')}">${body}</g>`
    })
    .join('')
  const m = fx.meditating
  const meditation =
    m === null ? '' : `<g class="fx" style="${once('whud-in', 500, m.at - fx.now + YIELD_MS)}">${rowsOf(L, 'meditating', 'night', m.title, m.line)}</g>`
  return moments + meditation
}

// And what plays around them.
export const bannerFxOf = (L: Layout, fx: FxArt | undefined) => {
  if (fx === undefined || L.quest === null) return ''
  return fx.banners.map(b => extrasOf(L, b, b.at - fx.now)).join('')
}

// While moments play, the quest's own rows step aside: gone before the first moment's words come,
// back once the last one's have gone.

export const yieldCss = (fx: FxArt | undefined) => {
  if (fx === undefined || fx.banners.length === 0) return ''
  const start = Math.min(...fx.banners.map(b => b.at))
  const end = Math.max(...fx.banners.map(b => b.at + b.ms))
  const length = end - start + 160
  const out = r1((YIELD_MS / length) * 100)
  const back = r1(((end - start) / length) * 100)
  return `@keyframes whud-yield{0%{opacity:1}${out}%{opacity:0}${back}%{opacity:0}100%{opacity:1}}.qline{${once('whud-yield', length, start - fx.now, 'linear')}}`
}
