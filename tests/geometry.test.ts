// The desktop HUD's geometry: symmetry about the midline, even gaps, whole pixels, no overlaps,
// text that fits its room. Checked over the widths a band can have, so a defect is found by
// a rule rather than by eye.
import { expect, test } from 'claude-code/testing'

import { characterSvg, questSvg } from '../hooks/art'
import { GAP, H, MID, PLATE_BOTTOM, PLATE_TOP, ROW_LINE, ROW_TITLE, SIZE, TIP, fitText, layout, monoWidth, textWidth } from '../hooks/layout'
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

test('the drawings take the widths the layout gives them', () => {
  const tips = { vitality: 'v', stamina: 's', adrenaline: 'a', level: 'l' }
  for (const width of [300, 520, 800]) {
    const L = layout({ width, hasStamina: true, crowns: '1.87' })
    const character = characterSvg(L, {
      theme: 'auto',
      sign: null,
      isWorking: false,
      isCasting: false,
      vitality: 66,
      ghostFrom: null,
      stamina: 72,
      adrenaline: 2,
      level: 5,
      xpFraction: 0.4,
      isLevelUp: false,
      tips,
    })
    expect(character).toContain(`width="${L.split}" height="${H}" viewBox="0 0 ${L.split} ${H}"`)
    // The vitality track is drawn on its box, its 1px edge on half pixels.
    expect(character).toContain(`<rect x="${L.vit.x + 0.5}" y="${L.vit.y + 0.5}" width="${L.vit.w - 1}" height="${L.vit.h - 1}"`)
    const quest = questSvg(L, { theme: 'auto', line: questLine('idle', '', 0, null), cast: null, crowns: '1.87' })
    if (L.quest) expect(quest).toContain(`width="${L.width - L.split}" height="${H}"`)
    else expect(quest).toBe('')
  }
})
