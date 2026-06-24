import assert from 'node:assert/strict'
import { calculateSpineTextLayout } from './spineTextLayout'
import type { SpineContent } from '../types'

const base: SpineContent = {
  studentName: 'Maher Tka',
  shortTitle: 'Smart Printing Workflow',
  year: '2026',
  universityInitials: 'ISAMM',
  direction: 'bottom-to-top',
  autoFit: true,
  fontSizePt: 14
}

const normal = calculateSpineTextLayout(base, 20, 280)
assert.equal(normal.fits, true, 'normal title fits a 20 mm spine')
assert.ok(
  normal.fontSizePt >= 6 && normal.fontSizePt <= 18,
  'auto-fit stays within safe font range'
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
