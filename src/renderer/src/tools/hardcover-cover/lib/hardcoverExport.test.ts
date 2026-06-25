import assert from 'node:assert/strict'
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import { createDefaultHardcoverProject } from '../hooks/useHardcoverProject'
import { exportHardcoverBatchPdf, exportHardcoverPdf } from './hardcoverExportPdf'
import { buildHardcoverSvg } from './hardcoverExportSvg'
import { preparePdfDisplayText } from './pdfText'
import { mmToPoints } from './units'

const state = createDefaultHardcoverProject()
state.exportSettings.mode = 'production-guide'
state.exportSettings.includeFoldLines = true
state.exportSettings.includeSafeZones = true

const exported = await exportHardcoverPdf(state)
const document = await PDFDocument.load(exported.bytes)
assert.equal(document.getPageCount(), 1, 'single cover export has one page')
const page = document.getPage(0)
assert.ok(Math.abs(page.getWidth() - mmToPoints(480)) < 0.01, 'PDF width is exactly 480 mm')
assert.ok(Math.abs(page.getHeight() - mmToPoints(337)) < 0.01, 'PDF height is exactly 337 mm')
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
arabicState.content.spine.year = '2026'

const arabicExported = await exportHardcoverPdf(arabicState)
const arabicDocument = await PDFDocument.load(arabicExported.bytes)
assert.equal(arabicDocument.getPageCount(), 1, 'Arabic sample export has one page')
assertPdfUsesLocalAmiriFonts(arabicDocument)

const students = Array.from({ length: 3 }, (_, index) => ({
  id: `student-${index}`,
  studentName: `Student ${index + 1}`,
  title: `Project ${index + 1}`,
  year: '2026',
  department: 'Printing',
  supervisor: 'Supervisor',
  spineTitle: `Project ${index + 1}`
}))
const batch = await PDFDocument.load(await exportHardcoverBatchPdf(state, students))
assert.equal(batch.getPageCount(), 3, 'combined batch export has one page per student')

const svg = buildHardcoverSvg(state)
assert.match(svg, /width="480mm" height="337mm" viewBox="0 0 480 337"/)
assert.match(svg, /id="Artwork"/)
assert.match(svg, /id="ProductionGuides"/)
assert.match(svg, /id="SafeZones"/)

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
