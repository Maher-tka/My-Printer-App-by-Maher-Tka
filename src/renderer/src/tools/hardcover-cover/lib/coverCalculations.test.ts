import assert from 'node:assert/strict'
import { batchCoverFileName, safeFileName, versionedFileName } from '@/lib/fileNaming'
import { calculateCoverDimensions, DEFAULT_A4_COVER_SETUP } from './coverCalculations'
import { mmToPoints, pointsToMm } from './units'

const a4 = calculateCoverDimensions(DEFAULT_A4_COVER_SETUP)
assert.equal(a4.fullWidthMm, 480, 'A4 cover width includes two boards, spine, and wraps')
assert.equal(a4.fullHeightMm, 337, 'A4 cover height includes top and bottom wraps')
assert.equal(a4.spine.widthMm, 20, 'spine thickness is preserved')
assert.equal(a4.front.widthMm, 210, 'front cover matches book width')
assert.equal(a4.back.heightMm, 297, 'back cover matches book height')

const custom = calculateCoverDimensions({
  ...DEFAULT_A4_COVER_SETUP,
  bookWidthMm: 180,
  bookHeightMm: 240,
  spineWidthMm: 35,
  wrap: { topMm: 18, rightMm: 22, bottomMm: 24, leftMm: 20 },
  bleedMm: 3,
  paperWidthMm: 500,
  paperHeightMm: 300
})
assert.equal(custom.fullWidthMm, 443, 'custom width includes asymmetric wraps and bleed')
assert.equal(custom.fullHeightMm, 288, 'custom height includes asymmetric wraps and bleed')
assert.equal(custom.warnings.length, 0, 'valid custom cover has no warnings')

assert.equal(batchCoverFileName(0, 'Mahér / Student'), '001_Maher_-_Student_Cover.pdf')
assert.equal(safeFileName('Mémoire: 2026'), 'Memoire-_2026')
assert.equal(versionedFileName('cover', 2, 'pdf'), 'cover_v02.pdf')
assert.ok(
  Math.abs(pointsToMm(mmToPoints(480)) - 480) < 0.0001,
  'mm to points round-trip is accurate'
)

console.log('Hardcover calculation tests passed.')
