import { getGutterCutLines, GUTTER_LINE_WIDTH_MM } from './layout'
import { isSequentialProject } from '../../../../../shared/sequential-validation'
import { moveNumberPosition } from './positioning'
import assert from 'node:assert/strict'
import {
  createDefaultSequentialProject,
  formatSequenceNumber,
  getNumberSlots,
  getSequentialLayout
} from './layout'
const settings = createDefaultSequentialProject().settings
const s = {
  ...settings,
  sheetWidthMm: 210,
  sheetHeightMm: 297,
  ticketWidthMm: 90,
  ticketHeightMm: 130,
  quantity: 10
}
assert.equal(getSequentialLayout(s).capacity, 4)
assert.deepEqual(
  [0, 1, 2].map((i) => getNumberSlots(s, i).map((slot) => slot.number)),
  [
    [1, 4, 7, 10],
    [2, 5, 8, null],
    [3, 6, 9, null]
  ]
)
assert.deepEqual(
  getNumberSlots({ ...s, order: 'sheet' }, 2).map((slot) => slot.number),
  [9, 10, null, null]
)
assert.equal(
  formatSequenceNumber(
    { ...s, startNumber: 8, increment: 3, prefix: 'INV-', suffix: '/26', digits: 5 },
    2
  ),
  'INV-00014/26'
)
assert.equal(getSequentialLayout({ ...s, backMode: 'blank' }).pdfPageCount, 6)
for (const portrait of [true, false])
  for (const duplexFlip of ['long-edge', 'short-edge'] as const) {
    const config = {
      ...s,
      duplexFlip,
      sheetWidthMm: portrait ? 210 : 297,
      sheetHeightMm: portrait ? 297 : 210,
      ticketWidthMm: 80,
      ticketHeightMm: 80
    }
    const front = getNumberSlots(config, 0)
    const back = getNumberSlots(config, 0, 'back')
    front.forEach((slot, i) => {
      assert.equal(back[i].label, slot.label)
      const horizontal = portrait === (duplexFlip === 'long-edge')
      assert.ok(
        Math.abs(
          back[i].xMm -
            (horizontal ? config.sheetWidthMm - slot.xMm - config.ticketWidthMm : slot.xMm)
        ) < 1e-8
      )
      assert.ok(
        Math.abs(
          back[i].yMm -
            (horizontal ? slot.yMm : config.sheetHeightMm - slot.yMm - config.ticketHeightMm)
        ) < 1e-8
      )
    })
  }
assert.equal(
  getSequentialLayout({ ...settings, sheetPreset: 'a3', sheetWidthMm: 297, sheetHeightMm: 420 })
    .capacity,
  14
)
assert.equal(
  getSequentialLayout({
    ...settings,
    sheetPreset: 'custom',
    sheetWidthMm: 100,
    sheetHeightMm: 70,
    marginMm: 5
  }).capacity,
  1
)
for (const patch of [
  { quantity: 0 },
  { quantity: 1.5 },
  { sheetWidthMm: NaN },
  { ticketWidthMm: 0 },
  { increment: 0 },
  { prefix: 'مرحبا' },
  { startNumber: Number.MAX_SAFE_INTEGER },
  { marginMm: 1000 },
  { digits: 13 }
])
  assert.ok(getSequentialLayout({ ...s, ...patch }).errors.length)
assert.deepEqual(getNumberSlots(s, -1), [])
console.log('Sequential layout regression tests passed')

assert.equal(formatSequenceNumber({ ...settings, startNumber: 133, digits: 7 }, 0), '0000133')
assert.equal(formatSequenceNumber({ ...settings, startNumber: 133, digits: 7 }, 1), '0000134')
assert.equal(formatSequenceNumber({ ...settings, startNumber: 9999999, digits: 7 }, 1), '10000000')

const origin = createDefaultSequentialProject().positions[0]
assert.deepEqual(moveNumberPosition(origin, 2.75, 1.125, 90, 50, false, false), {
  ...origin,
  xMm: 12.75,
  yMm: 11.125
})
assert.deepEqual(moveNumberPosition(origin, 2.75, 1.125, 90, 50, true, false), {
  ...origin,
  xMm: 12.75,
  yMm: 10
})
assert.deepEqual(moveNumberPosition(origin, 2.75, 1.125, 90, 50, false, true), {
  ...origin,
  xMm: 13,
  yMm: 11
})
assert.equal(moveNumberPosition(origin, -100, 100, 90, 50, false, false).xMm, 0)
assert.equal(moveNumberPosition(origin, -100, 100, 90, 50, false, false).yMm, 50)

const fixedProject = createDefaultSequentialProject()
fixedProject.positions.push({
  ...fixedProject.positions[0],
  id: 'fixed',
  kind: 'text',
  text: 'Ticket No.'
})
assert.equal(
  isSequentialProject(JSON.parse(JSON.stringify(fixedProject))),
  true,
  'fixed labels survive project serialization'
)
assert.equal(
  isSequentialProject({
    ...fixedProject,
    positions: [{ ...fixedProject.positions[0], kind: 'text', text: 123 }]
  }),
  false,
  'reject invalid fixed text'
)
assert.equal(
  isSequentialProject(createDefaultSequentialProject()),
  true,
  'old number-only projects still load'
)

const gutterSettings = { ...settings, gutterCutLines: true, cuttingLineColor: '#00ff00', gapMm: 4 }
for (const side of ['front', 'back'] as const) {
  for (const duplexFlip of ['long-edge', 'short-edge'] as const) {
    const options = { ...gutterSettings, duplexFlip }
    const slots = getNumberSlots(options, 0, side)
    const lines = getGutterCutLines(options, slots)
    assert.ok(lines.length > 0)
    for (const line of lines)
      for (const slot of slots) {
        if (slot.sequenceIndex === null) continue
        const half = GUTTER_LINE_WIDTH_MM / 2
        const overlapsX =
          line.x1 === line.x2
            ? line.x1 + half > slot.xMm && line.x1 - half < slot.xMm + options.ticketWidthMm
            : line.x2 > slot.xMm && line.x1 < slot.xMm + options.ticketWidthMm
        const overlapsY =
          line.y1 === line.y2
            ? line.y1 + half > slot.yMm && line.y1 - half < slot.yMm + options.ticketHeightMm
            : line.y2 > slot.yMm && line.y1 < slot.yMm + options.ticketHeightMm
        assert.equal(
          overlapsX && overlapsY,
          false,
          'cutting-line stroke never enters ticket artwork'
        )
      }
  }
}
assert.ok(
  getSequentialLayout({ ...gutterSettings, gapMm: 0 }).errors.some((error) =>
    error.includes('0.1 mm')
  )
)
assert.equal(
  getGutterCutLines({ ...gutterSettings, gutterCutLines: false }, getNumberSlots(gutterSettings, 0))
    .length,
  0
)
assert.equal(
  getGutterCutLines(
    { ...gutterSettings, quantity: 1 },
    getNumberSlots({ ...gutterSettings, quantity: 1 }, 0)
  ).length,
  0
)
assert.equal(
  isSequentialProject({
    ...createDefaultSequentialProject(),
    settings: { ...settings, gutterCutLines: true, cuttingLineColor: '#123456' }
  }),
  true
)
assert.equal(
  isSequentialProject({
    ...createDefaultSequentialProject(),
    settings: { ...settings, cuttingLineColor: 'invalid' }
  }),
  false
)
