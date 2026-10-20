import assert from 'node:assert/strict'
import {
  FAST_PRINT_COUNTS,
  FAST_PRINT_LAYOUTS,
  fastPrintLayout,
  validateFastPrintPreset
} from './fast-print.js'
import { polaroidLayout, polaroidCoverCrop } from './fast-print-polaroid.js'

for (const paper of ['A4', 'A3'] as const) {
  for (const pagesPerSheet of FAST_PRINT_COUNTS) {
    for (const color of [false, true]) {
      const preset = validateFastPrintPreset({
        printer: 'Office \\ printer & العربية',
        paper,
        color,
        pagesPerSheet
      })
      const layout = fastPrintLayout(preset)
      assert.equal(layout.columns * layout.rows, pagesPerSheet)
      assert.equal(
        layout.width > layout.height,
        FAST_PRINT_LAYOUTS.find((item) => item.count === pagesPerSheet)!.landscape
      )
      assert.ok(layout.cellWidth > 0 && layout.cellHeight > 0)
      assert.ok(
        Math.abs(
          layout.columns * layout.cellWidth + (layout.columns - 1) * layout.gap - layout.width
        ) < 0.001
      )
      assert.ok(
        Math.abs(layout.rows * layout.cellHeight + (layout.rows - 1) * layout.gap - layout.height) <
          0.001
      )
      const token = Buffer.from(JSON.stringify(preset)).toString('base64')
      assert.deepEqual(
        validateFastPrintPreset(JSON.parse(Buffer.from(token, 'base64').toString('utf8'))),
        preset
      )
    }
  }
}
for (const invalid of [
  null,
  {},
  { printer: '', paper: 'A4', color: true, pagesPerSheet: 1 },
  { printer: 'P', paper: 'A5', color: false, pagesPerSheet: 1 },
  { printer: 'P', paper: 'A4', color: 'false', pagesPerSheet: 1 },
  { printer: 'P', paper: 'A4', color: false, pagesPerSheet: 3 }
]) {
  assert.throws(() => validateFastPrintPreset(invalid), /Invalid Fast Print/)
}
console.log('Fast Print preset and layout tests passed.')

for (const mode of ['polaroid-8', 'polaroid-9'] as const) {
  const layout = polaroidLayout(mode)
  const count = mode === 'polaroid-8' ? 8 : 9
  assert.equal(layout.photos.length, count)
  assert.equal(layout.width > layout.height, count === 8)
  assert.equal((layout.cutLineWidth / 300) * 96, 0.25)
  assert.equal(polaroidLayout(mode, 600).cutLineWidth, layout.cutLineWidth * 2)
  for (const photo of layout.photos) {
    assert.ok(photo.x > 0 && photo.y > 0)
    assert.ok(photo.x + photo.width < layout.width && photo.y + photo.height < layout.height)
    assert.ok(layout.cutXs.every((x) => x <= photo.x || x >= photo.x + photo.width))
    assert.ok(layout.cutYs.every((y) => y <= photo.y || y >= photo.y + photo.height))
  }
  const preset = { printer: 'Test', paper: 'A4', color: true, pagesPerSheet: 1, mode }
  assert.equal(validateFastPrintPreset(preset).mode, mode)
  assert.throws(() => validateFastPrintPreset({ ...preset, paper: 'A3' }), /Invalid/)
  assert.throws(() => validateFastPrintPreset({ ...preset, pagesPerSheet: 4 }), /Invalid/)
}
const photo8 = polaroidLayout('polaroid-8').photos[0]
assert.ok(Math.abs(photo8.x / polaroidLayout('polaroid-8').width - 40 / 3508) < 1e-9)
assert.ok(Math.abs(photo8.height / polaroidLayout('polaroid-8').height - 975 / 2480) < 1e-9)
const crop = polaroidCoverCrop(2000, 1000, 800, 1000)
assert.deepEqual(crop, { x: 600, y: 0, width: 800, height: 1000 })

const stockPreset = validateFastPrintPreset({
  printer: 'Work printer',
  paper: 'A3',
  color: false,
  pagesPerSheet: 4,
  profileId: '1234567890abcdef1234567890abcdef',
  landscape: true
})
assert.equal(
  fastPrintLayout(stockPreset).width > fastPrintLayout(stockPreset).height,
  true,
  'Saved stock orientation is used for four-up'
)
assert.equal(stockPreset.profileId, '1234567890abcdef1234567890abcdef')
assert.throws(
  () => validateFastPrintPreset({ ...stockPreset, profileId: '../other' }),
  /Invalid Fast Print/
)
assert.throws(
  () => validateFastPrintPreset({ ...stockPreset, landscape: 'false' }),
  /Invalid Fast Print/
)
