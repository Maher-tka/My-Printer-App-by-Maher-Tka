import assert from 'node:assert/strict'
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import {
  createDefaultHardcoverProject,
  getCurrentAcademicYear,
  writeProductionPreset
} from '../hooks/useHardcoverProject'
import { DEFAULT_HARDCOVER_PRODUCTION_PRESET } from './coverCalculations'
import { exportHardcoverBatchPdf, exportHardcoverPdf } from './hardcoverExportPdf'
import { buildHardcoverSvg, exportHardcoverSvg } from './hardcoverExportSvg'
import { preparePdfDisplayText } from './pdfText'
import { dragPdfPagePosition, nudgePdfPagePosition, normalizePdfPagePosition } from './pdfPosition'
import { resolveSpineBackgroundColor } from './spineBackground'
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
const multilineState = createDefaultHardcoverProject()
const multilineTitle = [
  'LA RECONQUÊTE PORTUAIRE :',
  'Un nouveau souffle pour le centre-ville de Sousse'
]
multilineState.content.spine.shortTitle = multilineTitle.join('\n')
const multilineSvg = buildHardcoverSvg(multilineState)
const titleGroup = multilineSvg.match(/<g id="SpineText-title"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? ''
assert.equal(
  (titleGroup.match(/<text\b/g) ?? []).length,
  2,
  'preview/SVG export prints two separate title lines'
)
assert.ok(
  titleGroup.indexOf(multilineTitle[0]) < titleGroup.indexOf(multilineTitle[1]),
  'title and subtitle retain their source order'
)
const multilinePdf = await exportHardcoverPdf(multilineState)
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
const multilineProxy = await getDocument({ data: multilinePdf.bytes.slice(), useSystemFonts: true })
  .promise
try {
  const text = await (await multilineProxy.getPage(1)).getTextContent()
  const items = text.items.filter((item) => 'str' in item)
  const titleItem = items.find((item) => item.str === multilineTitle[0])
  const subtitleItem = items.find((item) => item.str === multilineTitle[1])
  assert.ok(titleItem && subtitleItem, 'PDF export retains both complete original lines')
  assert.notEqual(
    titleItem.transform[4],
    subtitleItem.transform[4],
    'rotated PDF lines occupy separate positions across the spine'
  )
} finally {
  await multilineProxy.destroy()
}
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
const previewSvg = buildHardcoverSvg(state, { idPrefix: 'preview-a' })
assert.match(previewSvg, /id="preview-a-coverBackground"/)
assert.match(previewSvg, /fill="url\(#preview-a-coverBackground\)"/)
assert.match(previewSvg, /id="preview-a-SpineText-year"/)
assert.doesNotMatch(previewSvg, /\bid="SpineText-year"/)

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
  frontPosition: { xPercent: 10, yPercent: -5 },
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
assert.match(
  sourceSvg,
  /data-source-position="front" data-position-x="10" data-position-y="-5"/,
  'source page position is applied to the SVG preview and image export source'
)
assert.match(sourceSvg, /id="SpineText-year"/)
assert.equal(
  resolveSpineBackgroundColor(sourceState),
  '#ffffff',
  'source PDF spine background automatically matches the white sheet by default'
)
assert.doesNotMatch(
  sourceSvg,
  /#f6f7f9/,
  'source PDF spine no longer receives the old forced gray strip'
)
assert.doesNotMatch(
  sourceSvg,
  /#eef2f7/,
  'source PDF side binding bands no longer receive a separate colored fill'
)
assert.match(
  sourceSvg,
  /id="SpineText-year"[\s\S]*fill="#0f172a"/,
  'source PDF spine text uses dark ink on the light spine preview'
)
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

const independentState = structuredClone(sourceState)
const independentFrontThumbnail = 'data:image/png;base64,independent-front-cover'
const independentBackThumbnail = 'data:image/png;base64,independent-back-cover'
independentState.sourcePdf = {
  fileName: 'PAGE DE GARDE.pdf',
  pageCount: 1,
  frontPageNumber: 1,
  backPageNumber: 1,
  backCoverEnabled: true,
  fitMode: 'fit',
  sourceMode: 'separate',
  thumbnailDataUrl: independentFrontThumbnail,
  backThumbnailDataUrl: independentBackThumbnail,
  frontSource: {
    sourceId: 'fixture-front-export',
    fileName: 'PAGE DE GARDE.pdf',
    pageCount: 1,
    pageNumber: 1,
    fitMode: 'fit',
    position: { xPercent: -10, yPercent: 5 },
    thumbnailDataUrl: independentFrontThumbnail
  },
  backSource: {
    sourceId: 'fixture-back-export',
    fileName: 'arriere.pdf',
    pageCount: 1,
    pageNumber: 1,
    fitMode: 'fill',
    position: { xPercent: 5, yPercent: -10 },
    thumbnailDataUrl: independentBackThumbnail
  }
}
const independentSvg = buildHardcoverSvg(independentState)
assert.match(
  independentSvg,
  /data-source-position="front" data-position-x="-10" data-position-y="5"/,
  'independent front position is preserved'
)
assert.match(
  independentSvg,
  /data-source-position="back" data-position-x="5" data-position-y="-10"/,
  'independent back position is preserved'
)
assert.match(
  independentSvg,
  /independent-front-cover[\s\S]*preserveAspectRatio="xMidYMid meet"/,
  'independent front source keeps Fit placement in SVG'
)
assert.match(
  independentSvg,
  /independent-back-cover[\s\S]*preserveAspectRatio="xMidYMid slice"/,
  'independent back source keeps Fill placement in SVG'
)
assert.throws(
  () => exportHardcoverSvg(independentState),
  /Re-upload the independent front and back cover PDFs/,
  'SVG export asks for independent source re-upload when runtime bytes are unavailable'
)
await assert.rejects(
  () => exportHardcoverPdf(independentState),
  /Re-upload the independent front-cover PDF \(PAGE DE GARDE\.pdf\)/,
  'PDF export never silently falls back when the independent front source is unavailable'
)

assert.deepEqual(
  nudgePdfPagePosition({ xPercent: 0, yPercent: 0 }, 5, -5),
  { xPercent: 5, yPercent: -5 },
  'page position nudges use predictable five-percent steps'
)
assert.deepEqual(
  normalizePdfPagePosition({ xPercent: 100, yPercent: -100 }),
  { xPercent: 40, yPercent: -40 },
  'page position is clamped to a safe adjustment range'
)
assert.deepEqual(
  dragPdfPagePosition({ xPercent: 0, yPercent: 0 }, 50, 30, 200, 300),
  { xPercent: 25, yPercent: -10 },
  'dragging right and down converts mouse movement into saved page offsets'
)

const customSpineState = structuredClone(sourceState)
customSpineState.content.spine.spineColorMode = 'custom'
customSpineState.content.spine.spineBackgroundColor = '#f4d9bd'
const customSpineSvg = buildHardcoverSvg(customSpineState)
assert.equal(resolveSpineBackgroundColor(customSpineState), '#f4d9bd')
assert.match(
  customSpineSvg,
  /fill="#f4d9bd" opacity="1"/,
  'custom spine color is rendered into the SVG preview/export'
)

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
