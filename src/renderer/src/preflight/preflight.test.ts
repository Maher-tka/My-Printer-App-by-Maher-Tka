import assert from 'node:assert/strict'
import { runBookletPreflight } from './bookletPreflight'
import { runSharedCutterPreflight } from './cutterPreflight'
import { runHardcoverPreflight } from './hardcoverPreflight'

assert.equal(
  runBookletPreflight({
    pageCount: 8,
    blankPageCount: 0,
    paperWidthMm: 210,
    paperHeightMm: 297,
    readingDirection: 'ltr'
  }).status,
  'passed'
)
assert.equal(
  runBookletPreflight({
    pageCount: 7,
    blankPageCount: 0,
    paperWidthMm: 210,
    paperHeightMm: 297,
    readingDirection: 'ltr'
  }).canExport,
  false
)
assert.equal(
  runSharedCutterPreflight({
    sheetWidth: 100,
    sheetHeight: 70,
    placedCount: 100,
    outOfBoundsCount: 0,
    overlapCount: 0,
    missingArtworkCount: 0,
    missingCutlineCount: 0,
    hiddenCutlineCount: 0,
    missingSourceCount: 0,
    exportMode: 'print-cut'
  }).status,
  'passed'
)
assert.equal(
  runHardcoverPreflight({
    bookWidthMm: 210,
    bookHeightMm: 297,
    spineWidthMm: 18,
    wrapMarginsMm: [15, 15, 15, 15],
    fullWidthMm: 468,
    fullHeightMm: 327,
    title: 'Mémoire',
    studentName: 'Test Student',
    studentNameRequired: true,
    spineTextFits: true,
    textInsideSafeZones: true,
    exportMode: 'print-final'
  }).status,
  'passed'
)

const detailedBooklet = runBookletPreflight({
  pageCount: 8,
  blankPageCount: 0,
  paperWidthMm: 420,
  paperHeightMm: 297,
  readingDirection: 'ltr',
  pageSizesMm: [
    { widthMm: 210, heightMm: 297, label: 'Page 1' },
    { widthMm: 148, heightMm: 210, label: 'Page 2' }
  ],
  outerMarginMm: 1,
  pageGapMm: 1,
  cropMarks: false,
  scaleMode: 'stretch'
})
assert.equal(detailedBooklet.status, 'warnings')
assert.equal(
  detailedBooklet.issues.some((issue) => issue.id === 'mixed-page-sizes'),
  true
)
assert.equal(
  detailedBooklet.issues.some((issue) => Boolean(issue.recommendation)),
  true
)

const oversizedCover = runHardcoverPreflight({
  bookWidthMm: 210,
  bookHeightMm: 297,
  spineWidthMm: 18,
  wrapMarginsMm: [15, 15, 15, 15],
  fullWidthMm: 468,
  fullHeightMm: 327,
  paperWidthMm: 420,
  paperHeightMm: 297,
  title: 'Mémoire',
  studentName: 'Test Student',
  studentNameRequired: true,
  spineTextFits: true,
  textInsideSafeZones: true,
  exportMode: 'print-final'
})
assert.equal(oversizedCover.canExport, false)
assert.equal(
  oversizedCover.issues.some((issue) => issue.id === 'cover-outside-sheet'),
  true
)

console.log('Shared export preflight tests passed.')
