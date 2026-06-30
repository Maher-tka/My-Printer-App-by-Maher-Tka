import assert from 'node:assert/strict'
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import {
  createDefaultHardcoverProject,
  getCurrentAcademicYear,
  writeProductionPreset
} from '../hooks/useHardcoverProject'
import { DEFAULT_HARDCOVER_PRODUCTION_PRESET } from './coverCalculations'
import { exportHardcoverBatchPdf, exportHardcoverPdf } from './hardcoverExportPdf'
import { buildHardcoverSvg } from './hardcoverExportSvg'
import { preparePdfDisplayText } from './pdfText'
import { mmToPoints } from './units'

const state = createDefaultHardcoverProject()
const currentAcademicYear = getCurrentAcademicYear()
state.exportSettings.mode = 'production-guide'
state.exportSettings.includeFoldLines = true
state.exportSettings.includeSafeZones = true

const exported = await exportHardcoverPdf(state)
const document = await PDFDocument.load(exported.bytes)
assert.equal(document.getPageCount(), 1, 'single cover export has one page')
const page = document.getPage(0)
assert.ok(Math.abs(page.getWidth() - mmToPoints(500)) < 0.01, 'PDF width is exactly 500 mm')
assert.ok(Math.abs(page.getHeight() - mmToPoints(325)) < 0.01, 'PDF height is exactly 325 mm')
assert.equal(
  createDefaultHardcoverProject().exportSettings.includeCropMarks,
  false,
  'crop marks are disabled by default'
)
assert.equal(
  preparePdfDisplayText('Mémoire français'),
  'Mémoire français',
  'French text stays in reading order for PDF export'
)
assert.match(
  preparePdfDisplayText('آمنة بن علي'),
  /[\ufe80-\ufefc]/,
  'Arabic text is reshaped into joined presentation forms for PDF export'
)

const arabicState = createDefaultHardcoverProject()
arabicState.content.front.studentName = 'آمنة بن علي'
arabicState.content.front.title = 'Mémoire de fin d’études: تحليل جودة الطباعة'
arabicState.content.front.degree = 'Licence professionnelle'
arabicState.content.front.university = 'École supérieure des arts et métiers'
arabicState.content.front.academicYear = '2025-2026'
arabicState.content.back.summary =
  'ملخص المشروع: إعداد غلاف عربي وفرنسي جاهز للطباعة مع مراجعة جودة النصوص.'
arabicState.content.back.contactInfo = 'Tunis - atelier client - +216 00 000 000'
arabicState.content.spine.studentName = 'آمنة بن علي'
arabicState.content.spine.shortTitle = 'تحليل جودة الطباعة'
arabicState.content.spine.year = '2025/2026'

const arabicExported = await exportHardcoverPdf(arabicState)
const arabicDocument = await PDFDocument.load(arabicExported.bytes)
assert.equal(arabicDocument.getPageCount(), 1, 'Arabic sample export has one page')
assertPdfUsesLocalAmiriFonts(arabicDocument)

const students = Array.from({ length: 3 }, (_, index) => ({
  id: `student-${index}`,
  studentName: `Student ${index + 1}`,
  title: `Project ${index + 1}`,
  year: '2025/2026',
  department: 'Printing',
  supervisor: 'Supervisor',
  spineTitle: `Project ${index + 1}`
}))
const batch = await PDFDocument.load(await exportHardcoverBatchPdf(state, students))
assert.equal(batch.getPageCount(), 3, 'combined batch export has one page per student')

const svg = buildHardcoverSvg(state)
assert.match(svg, /width="500mm" height="325mm" viewBox="0 0 500 325"/)
assert.match(svg, /id="Artwork"/)
assert.match(svg, /id="SpineText-year"/)
assert.match(svg, /id="SpineText-title"/)
assert.match(svg, /id="SpineText-studentName"/)
assert.match(svg, new RegExp(currentAcademicYear.replace('/', '\\/')))
assert.match(svg, /id="BindingEdgeMarks"/)
assert.match(svg, /M 235 0 V 15/)
assert.match(svg, /M 235 310 V 325/)
assert.doesNotMatch(svg, /M [\d.]+ 0 V 325/, 'no full-height binding lines are exported')
assert.match(svg, /id="SafeZones"/)
assert.doesNotMatch(buildHardcoverSvg(createDefaultHardcoverProject()), /id="CropMarks"/)

const sourcePdfDocument = await PDFDocument.create()
const sourcePage = sourcePdfDocument.addPage([mmToPoints(210), mmToPoints(297)])
sourcePage.drawText('Vector source cover', { x: 36, y: 760, size: 18 })
const sourceBackPage = sourcePdfDocument.addPage([mmToPoints(210), mmToPoints(297)])
sourceBackPage.drawText('Vector source back cover', { x: 36, y: 760, size: 18 })
const sourceBytes = await sourcePdfDocument.save()
const frontThumbnail = 'data:image/png;base64,front-cover-thumbnail'
const backThumbnail = 'data:image/png;base64,back-cover-thumbnail'
const sourceState = createDefaultHardcoverProject()
sourceState.sourcePdf = {
  fileName: 'memoire.pdf',
  pageCount: 2,
  frontPageNumber: 1,
  backCoverEnabled: false,
  fitMode: 'fit',
  bytes: sourceBytes,
  thumbnailDataUrl: frontThumbnail,
  pagePreviews: [
    { pageNumber: 1, rotation: 0, thumbnailDataUrl: frontThumbnail },
    { pageNumber: 2, rotation: 0, thumbnailDataUrl: backThumbnail }
  ]
}
const sourceExported = await exportHardcoverPdf(sourceState)
const sourceDocument = await PDFDocument.load(sourceExported.bytes)
assert.equal(sourceDocument.getPageCount(), 1, 'source PDF workflow exports one sheet')
assert.ok(
  Math.abs(sourceDocument.getPage(0).getWidth() - mmToPoints(500)) < 0.01,
  'source PDF export keeps the fixed printer sheet width'
)
const sourceSvg = buildHardcoverSvg(sourceState)
assert.match(sourceSvg, /front-cover-thumbnail/)
assert.doesNotMatch(sourceSvg, /back-cover-thumbnail/, 'back cover stays blank while toggle is off')
assert.doesNotMatch(
  sourceSvg,
  /stroke=/,
  'source PDF preview has no default board border or binding strokes in final mode'
)

const sourceWithBackState = structuredClone(sourceState)
sourceWithBackState.sourcePdf = {
  ...sourceWithBackState.sourcePdf!,
  backCoverEnabled: true,
  backPageNumber: 2,
  backThumbnailDataUrl: backThumbnail
}
const sourceWithBackExported = await exportHardcoverPdf(sourceWithBackState)
const sourceWithBackDocument = await PDFDocument.load(sourceWithBackExported.bytes)
assert.equal(sourceWithBackDocument.getPageCount(), 1, 'back cover PDF export has one sheet')
const sourceWithBackSvg = buildHardcoverSvg(sourceWithBackState)
assert.match(sourceWithBackSvg, /front-cover-thumbnail/)
assert.match(sourceWithBackSvg, /back-cover-thumbnail/)

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    }
  }
})
writeProductionPreset({
  ...DEFAULT_HARDCOVER_PRODUCTION_PRESET,
  paperWidthMm: 510,
  paperHeightMm: 330,
  defaultDirection: 'rtl'
})
const savedPresetProject = createDefaultHardcoverProject()
assert.equal(savedPresetProject.setup.paperWidthMm, 510, 'saved preset loads for new projects')
assert.equal(savedPresetProject.setup.paperHeightMm, 330, 'saved preset sheet height loads')
assert.equal(savedPresetProject.setup.bookDirection, 'rtl', 'saved preset direction loads')
if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
else Reflect.deleteProperty(globalThis, 'window')

console.log('Hardcover PDF, SVG, and batch export tests passed.')

function assertPdfUsesLocalAmiriFonts(document: PDFDocument): void {
  const baseFonts: string[] = []

  for (const page of document.getPages()) {
    const resources = page.node.Resources()
    const fonts = resources?.lookup(PDFName.of('Font'), PDFDict)
    assert.ok(fonts, 'PDF page has font resources')

    for (const key of fonts.keys()) {
      const font: PDFDict = fonts.lookup(key, PDFDict)
      const baseFont: string = font.lookup(PDFName.of('BaseFont'))?.toString() ?? ''
      const encoding: string = font.lookup(PDFName.of('Encoding'))?.toString() ?? ''
      const toUnicode = font.lookup(PDFName.of('ToUnicode'))

      baseFonts.push(baseFont)
      assert.match(baseFont, /Amiri/, 'PDF text uses the local Amiri font')
      assert.equal(encoding, '/Identity-H', 'PDF text uses Unicode Identity-H font encoding')
      assert.ok(toUnicode, 'PDF text includes a Unicode map for extraction and copy/paste')
    }
  }

  assert.ok(baseFonts.length > 0, 'PDF contains embedded font resources')
  assert.ok(
    baseFonts.every((name) => !/Helvetica|Times|Courier/.test(name)),
    'PDF does not use built-in PDF fonts'
  )
}
