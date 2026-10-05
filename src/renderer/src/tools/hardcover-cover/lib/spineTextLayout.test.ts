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

const reference = calculateSpineTextLayout(base, 20, 287)
const widerBook = calculateSpineTextLayout(base, 30, 287)
const shorterBook = calculateSpineTextLayout(base, 20, 190)
const tallerBook = calculateSpineTextLayout(base, 20, 390)
assert.ok(
  widerBook.items.find((item) => item.role === 'year')!.fontSizePt >
    reference.items.find((item) => item.role === 'year')!.fontSizePt,
  'widening an already fitting spine grows its text beyond the old fixed 16 pt ceiling'
)
assert.ok(
  shorterBook.fontSizePt < reference.fontSizePt && tallerBook.fontSizePt > reference.fontSizePt,
  'shortening and lengthening the book rescale already fitting text'
)
assert.ok(
  tallerBook.items.find((item) => item.role === 'title')!.centerFromTopMm >
    reference.items.find((item) => item.role === 'title')!.centerFromTopMm,
  'text is recentered on the new spine height'
)
assert.ok(
  calculateSpineTextLayout(base, 150, 1200).items.every((item) => item.fontSizePt <= 36),
  'large measurements retain a bounded readable automatic size'
)

const manualSpine = { ...base, autoFit: false, fontSizePt: 12 }
assert.equal(
  syncSpineAutoFitFontSize(manualSpine, wideResponsive),
  manualSpine,
  'manual font size is never overwritten when Auto Fit is off'
)

const printedTitle = [
  'LA RECONQUÊTE PORTUAIRE :',
  'Un nouveau souffle pour le centre-ville de Sousse'
]
const twoLineSpine = { ...base, shortTitle: printedTitle.join('\n') }
const twoLineLayout = calculateSpineTextLayout(twoLineSpine, 20, 280)
assert.deepEqual(
  twoLineLayout.items.find((item) => item.role === 'title')?.lines,
  printedTitle,
  'auto-fit shrinks the font while retaining the original two lines'
)
assert.equal(twoLineLayout.fits, true)
const shortMultiline = calculateSpineTextLayout(twoLineSpine, 20, 190)
const tallMultiline = calculateSpineTextLayout(twoLineSpine, 20, 390)
assert.ok(
  shortMultiline.items.find((item) => item.role === 'title')!.fontSizePt <
    twoLineLayout.items.find((item) => item.role === 'title')!.fontSizePt
)
assert.ok(
  tallMultiline.items.find((item) => item.role === 'title')!.fontSizePt >
    twoLineLayout.items.find((item) => item.role === 'title')!.fontSizePt
)
assert.deepEqual(shortMultiline.items.find((item) => item.role === 'title')!.lines, printedTitle)
assert.deepEqual(tallMultiline.items.find((item) => item.role === 'title')!.lines, printedTitle)
assert.equal(
  calculateSpineTextLayout(twoLineSpine, 20, 287).fits,
  true,
  'font rounding never makes a fitted two-line title overflow by a fraction of a point'
)
assert.ok(
  twoLineLayout.items.find((item) => item.role === 'title')!.fontSizePt < 16,
  'long subtitle is fitted instead of merged or rewrapped'
)
const architectureSpine = { ...twoLineSpine, studentName: 'AMINE NABI', year: '2025-2026' }
const architectureNormal = calculateSpineTextLayout(architectureSpine, 20, 287)
const architectureWide = calculateSpineTextLayout(architectureSpine, 30, 287)
const architectureThin = calculateSpineTextLayout(architectureSpine, 10, 287)
assert.ok(
  architectureWide.items.find((item) => item.role === 'title')!.fontSizePt >
    architectureNormal.items.find((item) => item.role === 'title')!.fontSizePt,
  'the exact architecture subtitle grows when the spine widens, alongside the year/name'
)
assert.ok(
  architectureThin.items.find((item) => item.role === 'title')!.fontSizePt <
    architectureNormal.items.find((item) => item.role === 'title')!.fontSizePt
)
for (const layout of [architectureNormal, architectureWide, architectureThin]) {
  assert.deepEqual(layout.items.find((item) => item.role === 'title')!.lines, printedTitle)
  assert.equal(layout.fits, true)
  const bounds = layout.items.map((item) => {
    const halfLength =
      (Math.max(...item.lines.map((line) => line.length)) * item.fontSizePt * 0.2) / 2
    return { start: item.centerFromTopMm - halfLength, end: item.centerFromTopMm + halfLength }
  })
  assert.ok(
    bounds[0].start >= 2 - 1e-6 && bounds[2].end <= 285 + 1e-6,
    'all estimated text remains within the usable spine'
  )
  assert.ok(
    bounds[1].start - bounds[0].end >= 4 - 1e-6 && bounds[2].start - bounds[1].end >= 4 - 1e-6,
    'growing the title never collides with the year or student name'
  )
}
assert.deepEqual(
  calculateSpineTextLayout({ ...twoLineSpine, autoFit: false, fontSizePt: 12 }, 20, 280).items.find(
    (item) => item.role === 'title'
  )?.lines,
  printedTitle
)
const narrowTwoLine = calculateSpineTextLayout(twoLineSpine, 8, 280)
assert.deepEqual(
  narrowTwoLine.items.find((item) => item.role === 'title')?.lines,
  printedTitle,
  'a narrow spine never silently merges explicit lines'
)
assert.equal(narrowTwoLine.fits, false, 'unfit explicit lines show the existing fit warning')
const arabicTitleLines = ['إدارة الموارد المائية:', 'دراسة تطبيقية في تونس']
assert.deepEqual(
  calculateSpineTextLayout(
    { ...base, shortTitle: arabicTitleLines.join('\n') },
    20,
    280
  ).items.find((item) => item.role === 'title')?.lines,
  arabicTitleLines,
  'Arabic title and subtitle retain their original order and punctuation'
)
const fourLines = [
  'Titre principal :',
  'Premier sous-titre',
  'Deuxième sous-titre',
  'Dernière partie'
]
assert.deepEqual(
  calculateSpineTextLayout({ ...base, shortTitle: fourLines.join('\r\n') }, 25, 280).items.find(
    (item) => item.role === 'title'
  )?.lines,
  fourLines,
  'preserve more than three source/manual lines and Windows line endings'
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
