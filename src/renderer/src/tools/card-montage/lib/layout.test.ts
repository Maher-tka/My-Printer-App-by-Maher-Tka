import assert from 'node:assert/strict'
import { DEFAULT_CARD_SETTINGS } from '../types'
import { getCardLayout } from './layout'
import { suggestCardSize } from './cardSize'
import { assignCardFile, shareCardPagePreviews } from './cardSides'
import type { CardArtwork, CardMontageDraft } from '../types'

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`)
const auto = getCardLayout({
  ...DEFAULT_CARD_SETTINGS,
  widthMm: 120,
  heightMm: 80,
  horizontalGapMm: 20,
  verticalGapMm: 20
})
assert.deepEqual(auto.errors, [])
assert.equal(auto.capacity, 10)
assert.equal(auto.columns, 2)
assert.equal(auto.rows, 5)
assert.equal(auto.widthMm, 88)
assert.equal(auto.heightMm, 56)
close(auto.slots[0].xMm, 12)
close(auto.slots[0].yMm, 6.5)
close(auto.slots[1].xMm - auto.slots[0].xMm - auto.widthMm, 10)
close(auto.slots[2].yMm - auto.slots[0].yMm - auto.heightMm, 1)
for (const gap of [0, 5, 10, 20]) {
  const adjustable = getCardLayout({ ...DEFAULT_CARD_SETTINGS, autoHorizontalGapMm: gap })
  assert.equal(adjustable.capacity, 10)
  assert.equal(adjustable.widthMm, 88)
  assert.equal(adjustable.heightMm, 56)
  close(adjustable.slots[1].xMm - adjustable.slots[0].xMm - 88, gap)
  close(adjustable.slots[2].yMm - adjustable.slots[0].yMm - 56, 1)
}
assert.equal(getCardLayout({ ...DEFAULT_CARD_SETTINGS, autoHorizontalGapMm: 30 }).columns, 1)
assert.ok(getCardLayout({ ...DEFAULT_CARD_SETTINGS, autoHorizontalGapMm: -1 }).errors.length)
assert.ok(getCardLayout({ ...DEFAULT_CARD_SETTINGS, autoHorizontalGapMm: NaN }).errors.length)
assert.equal(
  getCardLayout({ ...DEFAULT_CARD_SETTINGS, artworkFit: 'contain' }).artworkFit,
  'stretch'
)

for (const [width, height] of [
  [85, 55],
  [80, 50],
  [88, 56],
  [55, 85]
]) {
  assert.deepEqual(suggestCardSize(width, height), {
    widthMm: width,
    heightMm: height,
    adjusted: false
  })
}
for (const [width, height, expectedWidth, expectedHeight] of [
  [170, 110, 85, 55],
  [160, 100, 80, 50],
  [210, 297, 85, 55],
  [340, 220, 85, 55],
  [320, 200, 80, 50]
]) {
  assert.deepEqual(suggestCardSize(width, height), {
    widthMm: expectedWidth,
    heightMm: expectedHeight,
    adjusted: true
  })
}

const zero = getCardLayout({
  ...DEFAULT_CARD_SETTINGS,
  mode: 'zero',
  horizontalGapMm: 10,
  verticalGapMm: 10
})
assert.equal(zero.capacity, 10)
close(zero.slots[2].yMm - zero.slots[0].yMm, 55)
const spaced = getCardLayout({
  ...DEFAULT_CARD_SETTINGS,
  mode: 'spaced',
  horizontalGapMm: 3,
  verticalGapMm: 4
})
assert.equal(spaced.capacity, 8)
close(spaced.slots[1].xMm - spaced.slots[0].xMm - 85, 3)
close(spaced.slots[2].yMm - spaced.slots[0].yMm - 55, 4)
for (const mode of ['zero', 'spaced'] as const) {
  for (const [widthMm, heightMm] of [
    [85, 55],
    [80, 50],
    [90, 60]
  ]) {
    const custom = getCardLayout({ ...DEFAULT_CARD_SETTINGS, mode, widthMm, heightMm })
    assert.equal(custom.widthMm, widthMm)
    assert.equal(custom.heightMm, heightMm)
  }
}
const landscape = getCardLayout({ ...DEFAULT_CARD_SETTINGS, orientation: 'landscape' })
assert.equal(landscape.sheetWidthMm, 297)
assert.equal(landscape.sheetHeightMm, 210)
assert.equal(landscape.capacity, 9)
const edgeFit = getCardLayout({
  ...DEFAULT_CARD_SETTINGS,
  mode: 'zero',
  widthMm: 100,
  heightMm: 143.5
})
assert.equal(edgeFit.capacity, 4)

for (const settings of [
  { widthMm: NaN, mode: 'zero' as const },
  { heightMm: 0, mode: 'zero' as const },
  { verticalGapMm: -1, mode: 'spaced' as const },
  { horizontalGapMm: Infinity, mode: 'spaced' as const },
  { marginMm: -1 },
  { marginMm: NaN },
  { marginMm: 100 },
  { widthMm: 400, mode: 'zero' as const }
]) {
  const invalid = getCardLayout({ ...DEFAULT_CARD_SETTINGS, ...settings })
  assert.ok(invalid.errors.length)
  assert.deepEqual(invalid.slots, [])
  assert.deepEqual(invalid.marks, [])
}
for (const layout of [auto, zero, spaced, landscape, edgeFit]) {
  for (const slot of layout.slots) {
    assert.ok(slot.xMm >= 5 - 1e-6 && slot.yMm >= 5 - 1e-6)
    assert.ok(slot.xMm + layout.widthMm <= layout.sheetWidthMm - 5 + 1e-6)
    assert.ok(slot.yMm + layout.heightMm <= layout.sheetHeightMm - 5 + 1e-6)
  }
  for (const mark of layout.marks) {
    assert.ok(mark.x1 >= 0 && mark.x2 <= layout.sheetWidthMm)
    assert.ok(mark.y1 >= 0 && mark.y2 <= layout.sheetHeightMm)
    for (const slot of layout.slots) {
      const inCard = (x: number, y: number) =>
        x > slot.xMm &&
        x < slot.xMm + layout.widthMm &&
        y > slot.yMm &&
        y < slot.yMm + layout.heightMm
      assert.ok(!inCard(mark.x1, mark.y1) && !inCard(mark.x2, mark.y2))
    }
  }
}
assert.deepEqual(getCardLayout({ ...DEFAULT_CARD_SETTINGS, cutMarks: false }).marks, [])
assert.equal(zero.marks.length, (zero.columns + 1) * (zero.rows + 1) * 2)
assert.equal(spaced.marks.length, spaced.capacity * 8)
for (const layout of [zero, spaced]) {
  for (const slot of layout.slots)
    for (const x of [slot.xMm, slot.xMm + layout.widthMm])
      for (const y of [slot.yMm, slot.yMm + layout.heightMm]) {
        assert.ok(
          layout.marks.some((line) => line.y1 === y && line.y2 === y && line.x1 < x && line.x2 > x),
          'Horizontal cross must pass through the card corner.'
        )
        assert.ok(
          layout.marks.some((line) => line.x1 === x && line.x2 === x && line.y1 < y && line.y2 > y),
          'Vertical cross must pass through the card corner.'
        )
      }
}
assert.deepEqual(auto.marks, [])
assert.deepEqual(auto.outlines, [])
const outlined = getCardLayout({
  ...DEFAULT_CARD_SETTINGS,
  cardOutline: true,
  cardOutlineColor: '#123abc'
})
assert.equal(outlined.outlines.length, 10)
assert.deepEqual(outlined.marks, [])
assert.equal(outlined.lineColor, '#123abc')
assert.equal(
  getCardLayout({ ...DEFAULT_CARD_SETTINGS, cardOutline: true, cardOutlineColor: '#FFFFFF' })
    .lineColor,
  '#000000'
)
assert.deepEqual(
  outlined.outlines,
  outlined.slots.map((slot) => ({ ...slot, widthMm: 88, heightMm: 56 }))
)
assert.deepEqual(
  getCardLayout({ ...DEFAULT_CARD_SETTINGS, mode: 'zero', cardOutline: true }).outlines,
  []
)
assert.deepEqual(
  getCardLayout({ ...DEFAULT_CARD_SETTINGS, mode: 'spaced', cutMarks: false }).marks,
  []
)
assert.ok(
  getCardLayout({ ...DEFAULT_CARD_SETTINGS, mode: 'zero', cropMarkColor: 'bad' }).errors.length
)
assert.ok(
  getCardLayout({ ...DEFAULT_CARD_SETTINGS, cardOutline: true, cardOutlineColor: 'bad' }).errors
    .length
)
assert.deepEqual(getCardLayout({ ...DEFAULT_CARD_SETTINGS, cropMarkColor: 'bad' }).errors, [])
const frontArt: CardArtwork = {
  name: 'two-sides.ai',
  kind: 'pdf',
  bytesBase64: 'front',
  pageNumber: 1,
  pageCount: 2,
  widthMm: 160,
  heightMm: 100,
  previewDataUrl: ''
}
const backArt = { ...frontArt, pageNumber: 2 }
const draft: CardMontageDraft = {
  artwork: null,
  back: null,
  settings: { ...DEFAULT_CARD_SETTINGS }
}
const paired = assignCardFile(draft, 'front', frontArt, backArt)
assert.equal(paired.artwork?.pageNumber, 1)
assert.equal(paired.back?.pageNumber, 2)
assert.equal(paired.settings.includeBack, true)
assert.equal(paired.settings.widthMm, 80)
assert.equal(paired.settings.exportAllPdfPages, false)
const custom = assignCardFile(paired, 'back', {
  ...backArt,
  name: 'separate.png',
  kind: 'png',
  bytesBase64: 'custom'
})
assert.equal(custom.back?.name, 'separate.png')
assert.equal(custom.settings.widthMm, 80, 'Back import must preserve the shared print dimensions.')
const replacedFront = assignCardFile(custom, 'front', { ...frontArt, name: 'new.ai' })
assert.equal(
  replacedFront.back,
  custom.back,
  'Front import must preserve an independent back file.'
)
const cachedDraft = {
  ...paired,
  artwork: {
    ...frontArt,
    pageNumber: 3,
    pageCount: 4,
    pagePreviews: [
      { pageNumber: 1, thumbnailDataUrl: 'one' },
      { pageNumber: 3, thumbnailDataUrl: 'three' }
    ]
  },
  back: {
    ...backArt,
    pageNumber: 4,
    pageCount: 4,
    pagePreviews: [{ pageNumber: 4, thumbnailDataUrl: 'four' }]
  }
}
const merged = shareCardPagePreviews(cachedDraft, 'front', cachedDraft.artwork)
assert.equal(merged.artwork?.pageNumber, 3)
assert.equal(merged.back?.pageNumber, 4)
assert.deepEqual(
  merged.artwork?.pagePreviews?.map((page) => page.pageNumber),
  [1, 3, 4]
)
assert.equal(merged.artwork?.pagePreviews, merged.back?.pagePreviews)
assert.equal(merged.settings.widthMm, cachedDraft.settings.widthMm)
const differentFile = { ...cachedDraft, back: { ...cachedDraft.back, bytesBase64: 'different' } }
assert.equal(
  shareCardPagePreviews(differentFile, 'front', cachedDraft.artwork).back,
  differentFile.back
)
console.log('Card montage layout tests passed.')
