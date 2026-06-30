import assert from 'node:assert/strict'
import { batchCoverFileName, safeFileName, versionedFileName } from '@/lib/fileNaming'
import {
  calculateCoverDimensions,
  DEFAULT_A4_COVER_SETUP,
  isValidHardcoverPageNumber
} from './coverCalculations'
import { mmToPoints, pointsToMm } from './units'

const a4 = calculateCoverDimensions(DEFAULT_A4_COVER_SETUP)
assert.equal(a4.fullWidthMm, 500, 'default export sheet width is exactly 500 mm')
assert.equal(a4.fullHeightMm, 325, 'default export sheet height is exactly 325 mm')
assert.equal(a4.structureWidthMm, 450, 'bands and spine are included in structure width')
assert.equal(a4.structureHeightMm, 297, 'structure height matches board height')
assert.equal(a4.horizontalMarginMm, 25, 'default structure is horizontally centered')
assert.equal(a4.verticalMarginMm, 14, 'default structure is vertically centered')
assert.equal(a4.spine.widthMm, 20, 'spine thickness is preserved')
assert.equal(a4.leftBand.widthMm, 5, 'left binding band is physical width')
assert.equal(a4.rightBand.widthMm, 5, 'right binding band is physical width')
assert.equal(a4.front.xMm, 265, 'LTR front cover zone is on the right')
assert.equal(a4.back.xMm, 25, 'LTR back cover zone is on the left')
assert.deepEqual(
  a4.guideMarkPositionsMm,
  [235, 240, 260, 265],
  'guide marks sit only at board/band/spine transitions'
)
assert.equal(a4.guideMarks.length, 8, 'each transition has top and bottom edge marks')
assert.ok(
  a4.guideMarks.every(
    (mark) =>
      (mark.edge === 'top' && mark.yStartMm === 0 && mark.yEndMm === 15) ||
      (mark.edge === 'bottom' && mark.yStartMm === 310 && mark.yEndMm === 325)
  ),
  'binding marks are only short top and bottom marks'
)

const rtl = calculateCoverDimensions({ ...DEFAULT_A4_COVER_SETUP, bookDirection: 'rtl' })
assert.equal(rtl.front.xMm, 25, 'RTL front cover zone is on the left')
assert.equal(rtl.back.xMm, 265, 'RTL back cover zone is on the right')

const widerSpine = calculateCoverDimensions({
  ...DEFAULT_A4_COVER_SETUP,
  spineWidthMm: 30
})
assert.equal(widerSpine.structureWidthMm, 460, 'spine width changes total layout width')
assert.equal(widerSpine.horizontalMarginMm, 20, 'spine width changes centering margin')
assert.equal(widerSpine.front.xMm, 270, 'spine width pushes the LTR front board right')

const custom = calculateCoverDimensions({
  ...DEFAULT_A4_COVER_SETUP,
  boardWidthMm: 180,
  bookWidthMm: 180,
  boardHeightMm: 240,
  bookHeightMm: 240,
  spineWidthMm: 35,
  leftBandWidthMm: 7,
  rightBandWidthMm: 9,
  paperWidthMm: 500,
  paperHeightMm: 300
})
assert.equal(custom.structureWidthMm, 411, 'custom width includes asymmetric bands')
assert.equal(custom.structureHeightMm, 240, 'custom height uses board height')
assert.equal(custom.warnings.length, 0, 'valid custom cover has no warnings')

assert.equal(isValidHardcoverPageNumber(1, 20), true, 'page 1 is valid')
assert.equal(isValidHardcoverPageNumber(0, 20), false, 'page numbers below 1 are rejected')
assert.equal(
  isValidHardcoverPageNumber(21, 20),
  false,
  'page numbers above page count are rejected'
)
assert.equal(isValidHardcoverPageNumber(1.5, 20), false, 'fractional page numbers are rejected')

assert.equal(batchCoverFileName(0, 'Mahér / Student'), '001_Maher_-_Student_Cover.pdf')
assert.equal(safeFileName('Mémoire: 2026'), 'Memoire-_2026')
assert.equal(versionedFileName('cover', 2, 'pdf'), 'cover_v02.pdf')
assert.ok(
  Math.abs(pointsToMm(mmToPoints(500)) - 500) < 0.0001,
  'mm to points round-trip is accurate'
)

console.log('Hardcover calculation tests passed.')
