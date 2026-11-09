// The desktop HUD's geometry: symmetry about the midline, even gaps, whole pixels, no overlaps,
// text that fits its room. Checked over the widths a band can have, so a defect is found by
// a rule rather than by eye.
import { expect, test } from 'claude-code/testing'

import { hudSvg } from '../hooks/art'
import type { HudArt } from '../hooks/art'
import {
  GAP,
  H,
  MAX_W,
  MID,
  MIN_W,
  PLATE_BOTTOM,
  PLATE_TOP,
  ROW_LINE,
  ROW_TITLE,
  SIZE,
  STEP,
  TIP,
  TITLE_SPACING,
  bands,
  fitText,
  layout,
  monoWidth,
  textWidth,
} from '../hooks/layout'
import type { Box, Layout } from '../hooks/layout'
import { questLine } from '../hooks/lore'

const WIDTHS = Array.from({ length: 140 }, (_, i) => 240 + i * 7)
const CROWNS = ['1.87', '1234,56', null]

const all = (fn: (L: Layout, label: string) => void) => {
  for (const width of WIDTHS)
    for (const hasStamina of [true, false])
      for (const crowns of CROWNS) fn(layout({ width, hasStamina, crowns }), `${width}px stamina=${hasStamina} crowns=${crowns}`)
}

const centreY = (b: Box) => b.y + b.h / 2
const right = (b: Box) => b.x + b.w
const near = (a: number, b: number) => Math.abs(a - b) < 0.011
const isWhole = (n: number) => Number.isInteger(n)

const boxes = (L: Layout): [string, Box][] => {
  const list: [string, Box][] = [
    ['medallion', L.medallion.box],
    ['vit', L.vit],
    ['numbers', L.numbers.box],
    ['pips', L.pips.box],
    ['badge', L.badge.box],
  ]
  if (L.sta) list.push(['sta', L.sta])
  if (L.divider) list.push(['divider', L.divider.box])
  if (L.quest) list.push(['glyph', L.quest.glyph], ['quest', { x: L.quest.x, y: ROW_TITLE - 5, w: L.quest.right - L.quest.x, h: ROW_LINE - ROW_TITLE + 10 }])
  if (L.crowns) list.push(['crowns', L.crowns.box])
  return list
}

const overlaps = (a: Box, b: Box) => a.x < right(b) && b.x < right(a) && a.y < b.y + b.h && b.y < a.y + a.h

test('every group is centred on the midline', () => {
  all((L, at) => {
    const bars = L.sta ? { y: L.vit.y, h: L.sta.y + L.sta.h - L.vit.y } : L.vit
    const groups: [string, number][] = [
      ['medallion', centreY(L.medallion.box)],
      ['bars', bars.y + bars.h / 2],
      ['pips', centreY(L.pips.box)],
      ['badge', centreY(L.badge.box)],
    ]
    if (L.divider) groups.push(['divider', centreY(L.divider.box)], ['divider line', (L.divider.top + L.divider.bottom) / 2])
    if (L.crowns) groups.push(['crowns', centreY(L.crowns.box)])
    for (const [name, y] of groups) expect(`${at} ${name} ${y}`).toBe(`${at} ${name} ${MID}`)
    // The pips are spaced evenly about the middle one.
    expect(L.pips.cys[0] - L.pips.cys[1]).toBe(L.pips.cys[1] - L.pips.cys[2])
    expect(L.pips.cys[1]).toBe(MID)
  })
  // The quest's two rows mirror each other, and the glyph sits on the lower one.
  expect(MID - ROW_TITLE).toBe(ROW_LINE - MID)
  const L = layout({ width: 800, hasStamina: true, crowns: '1.87' })
  expect(centreY(L.quest!.glyph)).toBe(ROW_LINE)
})

test('each figure is centred on its own bar', () => {
  all(L => {
    expect(L.numbers.vitCentre).toBe(centreY(L.vit))
    if (L.sta) expect(L.numbers.staCentre).toBe(centreY(L.sta))
  })
})

test('groups along the row keep one gap', () => {
  all((L, at) => {
    const gaps: [string, number][] = [
      ['medallion→bars', L.vit.x - right(L.medallion.box)],
      ['figures→pips', L.pips.box.x - right(L.numbers.box)],
      ['pips→badge', L.badge.box.x - right(L.pips.box)],
    ]
    if (L.divider && L.quest) {
      gaps.push(['badge→divider', L.divider.box.x - right(L.badge.box)], ['divider→quest', L.quest.x - right(L.divider.box)])
      const end = L.plateEnd - TIP
      if (L.crowns) gaps.push(['quest→crowns', L.crowns.box.x - L.quest.right], ['crowns→tip', end - right(L.crowns.box)])
      else gaps.push(['quest→tip', end - L.quest.right])
    } else {
      expect(L.plateEnd - TIP - right(L.badge.box) >= GAP).toBe(true)
    }
    for (const [name, gap] of gaps) expect(`${at} ${name} ${gap}`).toBe(`${at} ${name} ${GAP}`)
    // The figures are tied to their bars by a closer gap.
    expect(L.numbers.x - right(L.vit)).toBe(6)
  })
})

test('fills, tracks and the seam sit on whole pixels; the divider on a half', () => {
  all((L, at) => {
    const whole = [L.width, L.split, L.plateEnd, L.vit.x, L.vit.y, L.vit.w, L.vit.h, L.numbers.x, L.pips.box.x, L.badge.box.x]
    if (L.sta) whole.push(L.sta.x, L.sta.y, L.sta.w, L.sta.h)
    if (L.quest) whole.push(L.quest.x, L.quest.right, L.quest.textX)
    if (L.crowns) whole.push(L.crowns.box.x, L.crowns.box.w, L.crowns.textX)
    for (const n of whole) expect(`${at} ${n} ${isWhole(n)}`).toBe(`${at} ${n} true`)
    if (L.divider) expect(L.divider.x % 1).toBe(0.5)
    // Stamina runs exactly under vitality.
    if (L.sta) expect([L.sta.x, L.sta.w]).toEqual([L.vit.x, L.vit.w])
  })
})

test('nothing overlaps, and everything stays on the plate', () => {
  all((L, at) => {
    const list = boxes(L)
    for (const [name, b] of list) {
      expect(`${at} ${name} in width ${b.x >= 0 && right(b) <= L.width}`).toBe(`${at} ${name} in width true`)
      expect(`${at} ${name} in height ${b.y >= 0 && b.y + b.h <= H}`).toBe(`${at} ${name} in height true`)
      if (name !== 'medallion') {
        const onPlate = b.y >= PLATE_TOP && b.y + b.h <= PLATE_BOTTOM && right(b) <= L.plateEnd - TIP
        expect(`${at} ${name} on plate ${onPlate}`).toBe(`${at} ${name} on plate true`)
      }
    }
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [a, A] = list[i]!
        const [b, B] = list[j]!
        if (a === 'quest' && b === 'glyph') continue
        if (a === 'glyph' && b === 'quest') continue
        expect(`${at} ${a}×${b} ${overlaps(A, B)}`).toBe(`${at} ${a}×${b} false`)
      }
    // The character drawing ends between the divider and the quest: the seam crosses empty plate.
    if (L.divider && L.quest) expect(right(L.divider.box) <= L.split && L.split <= L.quest.x).toBe(true)
    else expect(L.split).toBe(L.width)
  })
})

test('a narrow band drops the crowns, then the quest', () => {
  const wide = layout({ width: 900, hasStamina: true, crowns: '1.87' })
  expect(wide.crowns !== null && wide.quest !== null).toBe(true)
  const mid = layout({ width: 520, hasStamina: true, crowns: '1.87' })
  expect(mid.crowns === null && mid.quest !== null).toBe(true)
  const narrow = layout({ width: 300, hasStamina: true, crowns: '1.87' })
  expect(narrow.quest === null && narrow.divider === null && narrow.width === narrow.plateEnd + 1).toBe(true)
})

test('text is cut to the room it has', () => {
  const titles = [
    'Migrate the database schema to the new billing model and back again',
    'Перенеси схему базы данных на новую модель оплаты и обратно',
    'Kirish sahifasidagi yo‘naltirishni tuzat va testlarni qayta yurgiz',
    'short',
  ]
  for (const room of [40, 90, 160, 300, 520])
    for (const t of titles) {
      const cut = fitText(t, room, s => textWidth(s, SIZE.title))
      expect(textWidth(cut, SIZE.title) <= room).toBe(true)
      if (textWidth(t, SIZE.title) <= room) expect(cut).toBe(t)
      else expect(cut.endsWith('…') || cut === '').toBe(true)
      const mono = fitText(t, room, s => monoWidth(s, SIZE.mono))
      expect(monoWidth(mono, SIZE.mono) <= room).toBe(true)
    }
})

const tierOf = (L: Layout) => `${L.isCompact} ${L.quest !== null} ${L.crowns !== null}`

test('the bands cover every width, and a tier changes only where a band starts', () => {
  for (const hasStamina of [true, false])
    for (const crowns of CROWNS) {
      const B = bands({ hasStamina, crowns })
      expect(B[0]!.lo).toBe(0)
      expect(B[B.length - 1]!.hi).toBe(Infinity)
      for (let i = 0; i < B.length; i++) {
        const { lo, hi, L } = B[i]!
        if (i + 1 < B.length) expect(hi).toBe(B[i + 1]!.lo)
        // No band is wider than a STEP of the widths it is laid out for.
        const from = Math.max(lo, MIN_W)
        if (hi !== Infinity) expect(hi - from <= STEP).toBe(true)
        // Every width in the band has the band's tier: nothing appears or drops inside one.
        for (let w = from; w < Math.min(hi, MAX_W + 1); w++) {
          const at = `${hasStamina} ${crowns} ${w}px`
          expect(`${at} ${tierOf(layout({ width: w, hasStamina, crowns }))}`).toBe(`${at} ${tierOf(L)}`)
        }
      }
    }
})

// The plate's tip and the crowns keep their distance from the right edge; the rest keeps its place
// from the left. Across a band the right-hand things only move away, so nothing meets.
test('across each band the right-hand things keep their gap', () => {
  for (const hasStamina of [true, false])
    for (const crowns of CROWNS)
      for (const { lo, hi, L } of bands({ hasStamina, crowns })) {
        if (L.quest === null) continue
        // The fluid plate ends on the frame's last pixel.
        expect(L.plateEnd - L.width).toBe(-1)
        for (const w of [Math.max(lo, MIN_W), Math.min(hi === Infinity ? MAX_W + 1 : hi, MAX_W + 1) - 1]) {
          const shift = w - L.width
          const at = `${hasStamina} ${crowns} ${w}px`
          const tip = L.plateEnd + shift
          expect(`${at} tip ${tip}`).toBe(`${at} tip ${w - 1}`)
          if (L.crowns) {
            const left = L.crowns.box.x + shift
            const right = L.crowns.box.x + L.crowns.box.w + shift
            expect(`${at} quest→crowns ${left - L.quest.right >= GAP}`).toBe(`${at} quest→crowns true`)
            expect(`${at} crowns→tip ${tip - TIP - right}`).toBe(`${at} crowns→tip ${GAP}`)
          } else {
            expect(`${at} quest→tip ${tip - TIP - L.quest.right >= GAP}`).toBe(`${at} quest→tip true`)
          }
        }
      }
})

const LONG = {
  title: 'Перенеси схему базы данных на новую модель оплаты и обратно, проверь миграции и все отчёты по счетам',
  detail: 'src/billing/migrations/2026_11_09_add_invoice_lines_and_backfill_the_ledger_for_every_customer.sql',
  stats: 'Опыт 18 200 / 40 000 · ↑45 100 ↓12 300 · кэш 1 200 000 · заказов: 31 · и ещё многое другое для проверки',
}

const art = (over: Partial<HudArt> = {}): HudArt => ({
  theme: 'auto',
  sign: 'senses',
  isWorking: true,
  isCasting: true,
  vitality: 14,
  ghostFrom: 30,
  stamina: 72,
  adrenaline: 2,
  level: 5,
  xpFraction: 0.4,
  isLevelUp: true,
  tips: { vitality: 'v', stamina: 's', adrenaline: 'a', level: 'l' },
  line: questLine('active', LONG.title, 0, { key: 'senses', detail: LONG.detail }, 'ru'),
  cast: { key: 'senses', name: 'Ведьмачье чутьё', detail: LONG.detail },
  crowns: '1234,56',
  sheet: { title: 'Ученик Каэр Морхена · Уровень 5', stats: LONG.stats },
  ...over,
})

test('the drawing fills its frame and stays within the Svg limit', () => {
  const B = bands({ hasStamina: true, crowns: '1234,56' })
  const svg = hudSvg(B, art())
  // No viewBox: one unit is one pixel at any frame width, and the drawing takes the frame's width.
  expect(svg).toContain(`class="hud" width="${MAX_W}" height="${H}">`)
  expect(svg).not.toContain('viewBox="0 0')
  expect(svg).toContain(`.hud{display:block;width:100%;max-width:${MAX_W}px;height:${H}px;overflow:hidden}`)
  // The plate's tip and the crowns are drawn from the right edge.
  expect(svg).toContain('<svg class="anchor" x="100%" y="0" overflow="visible">')
  // Long texts cut at every band still fit the limit an Svg's source has.
  expect(svg.length < 131072).toBe(true)
  // Each band's vitality track is drawn on its box, its 1px edge on half pixels.
  for (const { L } of B) expect(svg).toContain(`<rect x="${L.vit.x + 0.5}" y="${L.vit.y + 0.5}" width="${L.vit.w - 1}" height="${L.vit.h - 1}"`)
  // A title is cut to its band's room, the drawn letter spacing counted.
  const L = B.find(b => b.L.quest !== null)!.L
  const cut = fitText(LONG.title, L.quest!.right - L.quest!.x, t => textWidth(t, SIZE.title, TITLE_SPACING))
  expect(textWidth(cut, SIZE.title, TITLE_SPACING) <= L.quest!.right - L.quest!.x).toBe(true)
  expect(svg).toContain(`>${cut}</text>`)
})
