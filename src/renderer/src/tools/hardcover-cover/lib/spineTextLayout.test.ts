import assert from 'node:assert/strict'
import { calculateSpineTextLayout, syncSpineAutoFitFontSize } from './spineTextLayout'
import type { SpineContent } from '../types'

const base: SpineContent = {
  studentName: 'Maher Tka',
  shortTitle: 'Smart Printing Workflow',
  year: '2025/2026',
  universityInitials: 'ISAMM',
  direction: 'bottom-to-top',
  autoFit: true,
  fontSizePt: 14,
  spineColorMode: 'auto',
  spineBackgroundColor: '#ffffff'
}

const normal = calculateSpineTextLayout(base, 20, 280)
assert.equal(normal.fits, true, 'normal title fits a 20 mm spine')
assert.deepEqual(
  normal.items.map((item) => item.role),
  ['year', 'title', 'studentName'],
  'spine layout keeps academic year, title, and student name as separate items'
)
assert.ok(
  normal.items[0].centerFromTopMm < normal.items[1].centerFromTopMm &&
    normal.items[1].centerFromTopMm < normal.items[2].centerFromTopMm,
  'spine items are ordered top, middle, bottom'
)
assert.ok(
  normal.fontSizePt >= 6 && normal.fontSizePt <= 18,
  'auto-fit stays within safe font range'
)

const narrowResponsive = calculateSpineTextLayout(base, 10, 280)
const wideResponsive = calculateSpineTextLayout(base, 30, 280)
assert.ok(
  narrowResponsive.fontSizePt < wideResponsive.fontSizePt,
  'auto-fit increases and decreases the font size when the spine width changes'
)

const syncedNarrowSpine = syncSpineAutoFitFontSize(base, narrowResponsive)
assert.equal(
  syncedNarrowSpine.fontSizePt,
  narrowResponsive.fontSizePt,
  'the calculated auto-fit size is stored in the spine settings'
)
const syncedWideSpine = syncSpineAutoFitFontSize(syncedNarrowSpine, wideResponsive)
assert.equal(
  syncedWideSpine.fontSizePt,
  wideResponsive.fontSizePt,
  'returning to measurements and widening the spine stores the new larger size'
)

const manualSpine = { ...base, autoFit: false, fontSizePt: 12 }
assert.equal(
  syncSpineAutoFitFontSize(manualSpine, wideResponsive),
  manualSpine,
  'manual font size is never overwritten when Auto Fit is off'
)

const narrow = calculateSpineTextLayout(base, 3, 280)
assert.equal(narrow.fits, false, 'very narrow spine warns')
assert.match(narrow.warning ?? '', /too narrow/i)

const long = calculateSpineTextLayout(
  {
    ...base,
    shortTitle:
      'An extremely long graduation mémoire title that cannot reasonably fit on the physical spine even after automatic fitting '.repeat(
        8
      )
  },
  8,
  70
)
assert.equal(long.fits, false, 'impossible title warns instead of silently overflowing')

console.log('Hardcover spine layout tests passed.')
