import assert from 'node:assert/strict'
import {
  FAST_PRINT_COUNTS,
  FAST_PRINT_LAYOUTS,
  fastPrintLayout,
  fastPrintCell,
  fastPrintSourceLayout,
  fastPrintContentTurns,
  fastPrintPageTurns,
  validateFastPrintPreset
} from './fast-print.js'
import { polaroidLayout, polaroidCoverCrop } from './fast-print-polaroid.js'
import {
  fastPrintMontageCells,
  fastPrintSeparatorSegments,
  FAST_PRINT_SEPARATOR_PX
} from './fast-print-montage.js'

const rotations = {
  printer: 'P',
  paper: 'A4' as const,
  color: true,
  pagesPerSheet: 4 as const,
  sourceRotations: [2, 3],
  pageRotations: [
    { file: 0, page: 1, turns: 1 },
    { file: 1, page: 0, turns: 0 }
  ]
}
const validatedRotations = validateFastPrintPreset(rotations)
assert.equal(fastPrintPageTurns(validatedRotations, 0, 0), 2)
assert.equal(fastPrintPageTurns(validatedRotations, 0, 1), 1)
assert.equal(fastPrintPageTurns(validatedRotations, 1, 0), 0)
assert.equal(fastPrintPageTurns(validatedRotations, 1, 1), 3)
assert.equal(fastPrintPageTurns(validatedRotations, 2, 0), 0)
rotations.pageRotations[0].turns = 3
assert.equal(
  fastPrintPageTurns(validatedRotations, 0, 1),
  1,
  'Validated page rotations must be independent copies'
)

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
      assert.ok(layout.columns * layout.rows >= pagesPerSheet)
      assert.ok(layout.columns * layout.rows - pagesPerSheet < layout.columns)
      assert.equal(
        layout.width > layout.height,
        FAST_PRINT_LAYOUTS.find((item) => item.count === pagesPerSheet)!.landscape
      )
      assert.ok(layout.cellWidth > 0 && layout.cellHeight > 0)
      assert.ok(
        Math.abs(
          layout.columns * layout.cellWidth +
            (layout.columns - 1) * layout.gap +
            2 * layout.margin -
            layout.width
        ) < 0.001
      )
      assert.ok(
        Math.abs(
          layout.rows * layout.cellHeight +
            (layout.rows - 1) * layout.gap +
            2 * layout.margin -
            layout.height
        ) < 0.001
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
for (const count of FAST_PRINT_COUNTS.filter((count) => count > 1)) {
  for (const landscape of [true, false]) {
    const preset = {
      printer: 'Test',
      paper: 'A4' as const,
      color: true,
      pagesPerSheet: count,
      landscape,
      matchLayoutOrientation: true
    }
    const layout = fastPrintLayout(preset)
    assert.equal(
      layout.width > layout.height,
      landscape,
      'Every preset must accept sheet orientation overrides'
    )
    for (const [width, height] of [
      [900, 500],
      [500, 900]
    ]) {
      const turns = fastPrintContentTurns(preset, layout, width, height, 0)
      assert.equal(
        turns % 2 ? height > width : width > height,
        layout.cellWidth > layout.cellHeight,
        'Default n-up photos must follow one slot direction'
      )
      assert.equal(
        fastPrintContentTurns(preset, layout, width, height, 1),
        (turns + 1) % 4,
        'A manual click must rotate the displayed photo by 90 degrees'
      )
      assert.equal(
        fastPrintContentTurns(
          { ...preset, matchLayoutOrientation: false },
          layout,
          width,
          height,
          1
        ),
        1
      )
    }
  }
}
for (const paper of ['A4', 'A3'] as const) {
  const original = {
    printer: 'Test',
    paper,
    color: true,
    pagesPerSheet: 1 as const,
    autoOrientation: true,
    landscape: false
  }
  assert.ok(
    fastPrintSourceLayout(original, 900, 500).width >
      fastPrintSourceLayout(original, 900, 500).height
  )
  assert.ok(
    fastPrintSourceLayout(original, 500, 900).width <
      fastPrintSourceLayout(original, 500, 900).height
  )
  assert.ok(
    fastPrintSourceLayout({ ...original, autoOrientation: false }, 900, 500).width <
      fastPrintSourceLayout({ ...original, autoOrientation: false }, 900, 500).height
  )
  assert.equal(validateFastPrintPreset(original).autoOrientation, true)
  assert.throws(
    () => validateFastPrintPreset({ ...original, autoOrientation: 'yes' }),
    /Invalid Fast Print/
  )
}

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

for (const paper of ['A4', 'A3'] as const)
  for (const pagesPerSheet of FAST_PRINT_COUNTS)
    for (const marginMm of [5, 7, 10, 20])
      for (const gapMm of [3, 5, 10]) {
        const preset = {
          printer: 'Proof',
          paper,
          color: true,
          pagesPerSheet,
          marginMm,
          gapMm,
          sourceRotations: [0, 1, 2, 3]
        }
        assert.deepEqual(validateFastPrintPreset(preset), preset)
        const layout = fastPrintLayout(preset, 254)
        for (let occupied = 1; occupied <= pagesPerSheet; occupied++) {
          const cells = Array.from({ length: occupied }, (_, slot) =>
            fastPrintCell(layout, slot, occupied)
          )
          for (const cell of cells) {
            assert.ok(cell.x >= layout.margin - 1e-8 && cell.y >= layout.margin - 1e-8)
            assert.ok(
              cell.x + cell.width <= layout.width - layout.margin + 1e-8 &&
                cell.y + cell.height <= layout.height - layout.margin + 1e-8
            )
          }
          const left = Math.min(...cells.map((c) => c.x)),
            right = Math.max(...cells.map((c) => c.x + c.width)),
            top = Math.min(...cells.map((c) => c.y)),
            bottom = Math.max(...cells.map((c) => c.y + c.height))
          assert.ok(
            Math.abs((left + right) / 2 - layout.width / 2) < 1e-8 &&
              Math.abs((top + bottom) / 2 - layout.height / 2) < 1e-8
          )
          for (let i = 0; i < cells.length; i++)
            for (const b of cells.slice(i + 1)) {
              const a = cells[i]
              assert.ok(
                a.x + a.width + layout.gap <= b.x + 1e-8 ||
                  b.x + b.width + layout.gap <= a.x + 1e-8 ||
                  a.y + a.height + layout.gap <= b.y + 1e-8 ||
                  b.y + b.height + layout.gap <= a.y + 1e-8
              )
            }
        }
      }
for (const extra of [
  { marginMm: 0 },
  { marginMm: NaN },
  { gapMm: -1 },
  { sourceRotations: [4] },
  { sourceRotations: [0.5] },
  { sourceRotations: '90' }
])
  assert.throws(
    () =>
      validateFastPrintPreset({
        printer: 'Test',
        paper: 'A4',
        color: true,
        pagesPerSheet: 4,
        ...extra
      }),
    /Invalid/
  )
console.log(
  'General Fast Print equal-cell margins, gaps, rotation validation and centered final sheets passed.'
)

assert.equal(
  validateFastPrintPreset({
    printer: 'Test',
    paper: 'A4',
    color: true,
    pagesPerSheet: 4,
    combineFiles: true
  }).combineFiles,
  true
)
assert.equal(
  validateFastPrintPreset({
    printer: 'Test',
    paper: 'A4',
    color: true,
    pagesPerSheet: 4,
    combineFiles: false
  }).combineFiles,
  false
)
assert.throws(
  () =>
    validateFastPrintPreset({
      printer: 'Test',
      paper: 'A4',
      color: true,
      pagesPerSheet: 4,
      combineFiles: 'yes'
    }),
  /Invalid/
)

const montagePreset = {
  printer: 'Test',
  paper: 'A4' as const,
  color: true,
  pagesPerSheet: 9 as const,
  compact: true,
  preserveActualSize: true,
  separatorLines: true,
  separatorColor: '#e02080',
  gapMm: 0
}
assert.deepEqual(validateFastPrintPreset(montagePreset), montagePreset)
for (const extra of [
  { compact: 1 },
  { preserveActualSize: 'yes' },
  { separatorLines: 'yes' },
  { separatorColor: 'red' },
  { separatorColor: '#fff' },
  { imageSizesMm: [{ widthMm: 0, heightMm: 55 }] },
  { imageSizesMm: [{ widthMm: 85, heightMm: Infinity }] },
  { gapMm: 11 }
])
  assert.throws(() => validateFastPrintPreset({ ...montagePreset, ...extra }), /Invalid/)
for (const paper of ['A4', 'A3'] as const)
  for (const landscape of [false, true]) {
    const preset = { ...montagePreset, paper, landscape }
    const layout = fastPrintLayout(preset)
    const widthMm = paper === 'A4' ? (landscape ? 297 : 210) : landscape ? 420 : 297
    const heightMm = paper === 'A4' ? (landscape ? 210 : 297) : landscape ? 297 : 420
    const size = { width: (55 * layout.width) / widthMm, height: (85 * layout.height) / heightMm }
    for (const count of [1, 2, 5, 7, 9]) {
      // Nine portrait badges require more vertical room on an A4 landscape sheet.
      if (paper === 'A4' && landscape && count > 6) continue
      const cells = fastPrintMontageCells(
        layout,
        Array.from({ length: count }, () => size),
        preset
      )
      for (const cell of cells) {
        assert.ok(Math.abs((cell.width * widthMm) / layout.width - 55) < 1e-8)
        assert.ok(Math.abs((cell.height * heightMm) / layout.height - 85) < 1e-8)
        assert.ok(cell.x >= layout.margin && cell.y >= layout.margin)
        assert.ok(cell.x + cell.width <= layout.width - layout.margin)
        assert.ok(cell.y + cell.height <= layout.height - layout.margin)
      }
      const left = Math.min(...cells.map((cell) => cell.x)),
        right = Math.max(...cells.map((cell) => cell.x + cell.width))
      const top = Math.min(...cells.map((cell) => cell.y)),
        bottom = Math.max(...cells.map((cell) => cell.y + cell.height))
      assert.ok(Math.abs(left + right - layout.width) < 1e-8)
      assert.ok(Math.abs(top + bottom - layout.height) < 1e-8)
      for (let i = 0; i < cells.length; i++)
        for (const b of cells.slice(i + 1)) {
          const a = cells[i],
            epsilon = 1e-8
          assert.ok(
            a.x + a.width <= b.x + epsilon ||
              b.x + b.width <= a.x + epsilon ||
              a.y + a.height <= b.y + epsilon ||
              b.y + b.height <= a.y + epsilon
          )
        }
    }
  }
const montageLayout = fastPrintLayout(montagePreset)
assert.throws(
  () => fastPrintMontageCells(montageLayout, [{ width: 5000, height: 400 }], montagePreset),
  /do not fit/
)
assert.throws(
  () =>
    fastPrintMontageCells(montageLayout, [{ width: 800, height: 400 }], {
      preserveActualSize: true
    }),
  /do not fit/
)
const pair = [
  { x: 0, y: 0, width: 55, height: 85 },
  { x: 55, y: 0, width: 55, height: 85 }
]
const cuts = fastPrintSeparatorSegments(pair)
assert.equal(cuts.length, 5, 'Touching badges share a single cut and merged top/bottom edges')
assert.equal(cuts.filter((line) => line.x1 === 55 && line.x2 === 55).length, 1)
assert.equal(FAST_PRINT_SEPARATOR_PX, 0.25)
assert.equal(fastPrintSeparatorSegments([]).length, 0)
const fitted = fastPrintMontageCells(
  montageLayout,
  [
    { width: 1000, height: 100 },
    { width: 100, height: 1000 }
  ],
  { compact: true }
)
assert.ok(fitted[1].x >= fitted[0].x + fitted[0].width - 1e-8)
assert.ok(fitted[0].height < montageLayout.cellHeight)
console.log(
  'Compact montage, physical sizing, fit rejection, zero gaps and shared separator checks passed.'
)
