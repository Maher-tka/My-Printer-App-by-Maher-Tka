import assert from 'node:assert/strict'
import { fastPrintLayout, validateFastPrintPreset } from './fast-print.js'

for (const paper of ['A4', 'A3'] as const) {
  for (const pagesPerSheet of [1, 2, 4] as const) {
    for (const color of [false, true]) {
      const preset = validateFastPrintPreset({
        printer: 'Office \\ printer & العربية',
        paper,
        color,
        pagesPerSheet
      })
      const layout = fastPrintLayout(preset)
      assert.equal(layout.columns * layout.rows, pagesPerSheet)
      assert.equal(layout.width > layout.height, pagesPerSheet === 2)
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
