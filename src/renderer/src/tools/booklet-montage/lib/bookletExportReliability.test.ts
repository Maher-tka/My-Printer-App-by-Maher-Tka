import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDict, PDFDocument, PDFName, PDFStream, StandardFonts, degrees, rgb } from 'pdf-lib'
import type { BookletPage, BookletSource, ExportProgress } from '../types'
import { createBlankPage, generateBookletSheets } from './bookletImposition'
import { exportBookletPdf } from './exportPdf'
import { assertArtworkSources, preparePdfRenderAssets } from './pdfExportAssets'
import { DEFAULT_SHEET_SETTINGS } from './printSizes'
import { isCanceledError } from './memoryCleanup'

async function fixture(count: number, rotated = false) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < count; i++) {
    const page = doc.addPage([200, 300])
    if (rotated) {
      page.setCropBox(15, 20, 150, 230)
      page.setRotation(degrees((i % 4) * 90))
    }
    // Include a valid imported PDF blank with no Contents entry.
    if (i === 10) continue
    page.drawRectangle({ x: 15, y: 20, width: 150, height: 230, color: rgb(0.93, 0.96, 1) })
    page.drawRectangle({ x: 15, y: 220, width: 30, height: 30, color: rgb(1, 0, 0) })
    page.drawRectangle({ x: 135, y: 20, width: 30, height: 30, color: rgb(0, 0, 1) })
    page.drawText(`Page ${i + 1}`, { x: 45, y: 155, size: 18, font })
    page.drawText(`Rotation ${(i % 4) * 90}`, { x: 45, y: 135, size: 12, font })
    if (rotated)
      page.node.set(
        PDFName.of('Group'),
        doc.context.obj({ S: 'Transparency', CS: 'DeviceRGB', I: true })
      )
  }
  const source: BookletSource = {
    id: 'source',
    name: 'long-booklet.pdf',
    kind: 'pdf',
    mimeType: 'application/pdf',
    bytes: await doc.save(),
    pageCount: count
  }
  const pages: BookletPage[] = doc.getPages().map((page, i) => {
    const crop = page.getCropBox()
    const swapped = page.getRotation().angle % 180 !== 0
    return {
      ...createBlankPage(i + 1),
      id: `page-${i}`,
      kind: 'pdf',
      sourceType: 'pdf',
      sourceId: source.id,
      sourcePageIndex: i,
      displayName: `Page ${i + 1}`,
      widthMm: ((swapped ? crop.height : crop.width) * 25.4) / 72,
      heightMm: ((swapped ? crop.width : crop.height) * 25.4) / 72
    }
  })
  return { source, pages, sheets: generateBookletSheets(pages) }
}

const long = await fixture(184)
const originalLoad = PDFDocument.load
let loads = 0,
  uiTicks = 0
PDFDocument.load = (...args) => {
  loads++
  return originalLoad(...args)
}
const timer = setInterval(() => uiTicks++, 1)
const progress: ExportProgress[] = []
const started = performance.now()
let blob: Blob
try {
  blob = await exportBookletPdf(long.sheets, [long.source], DEFAULT_SHEET_SETTINGS, (step) =>
    progress.push(step)
  )
} finally {
  clearInterval(timer)
  PDFDocument.load = originalLoad
}
assert.equal(loads, 1, 'a long source PDF is parsed once for the whole export')
assert.ok(uiTicks > 8, 'long exports yield so the interface and Cancel remain responsive')
const document = await PDFDocument.load(await blob.arrayBuffer())
assert.equal(document.getPageCount(), 92, '184 source pages produce 46 front/back sheet pairs')
assert.equal(progress.at(-1)?.phase, 'creating-pdf')
assert.ok(
  progress.some((step) => step.phase === 'preparing-pages' && /184 of 184/.test(step.message))
)
const fonts = document.context
  .enumerateIndirectObjects()
  .filter(
    ([, value]) => value instanceof PDFDict && value.get(PDFName.of('Type')) === PDFName.of('Font')
  )
assert.equal(fonts.length, 1, 'all booklet pages reuse the same embedded font resource')
console.log(
  `184-page booklet exported in ${Math.round(performance.now() - started)} ms (${blob.size} bytes, ${uiTicks} UI yields).`
)

const rotated = await fixture(4, true)
const assets = await preparePdfRenderAssets(await PDFDocument.create(), rotated.sheets, [
  rotated.source
])
for (let i = 0; i < 4; i++) {
  const asset = assets.pdfPages.get(`source:${i}`)!
  assert.equal(asset.rotation, i * 90)
  assert.equal(asset.page.width, 150, 'embedding honors the visible CropBox')
  assert.equal(asset.page.height, 230)
  const embedded = assets.pdf.context.lookup(asset.page.ref, PDFStream)
  assert.ok(embedded.dict.get(PDFName.of('Group')), 'transparency groups survive embedding')
}
const rotatedBlob = await exportBookletPdf(
  rotated.sheets,
  [rotated.source],
  DEFAULT_SHEET_SETTINGS,
  () => {}
)
assert.equal((await PDFDocument.load(await rotatedBlob.arrayBuffer())).getPageCount(), 2)
const repeated = generateBookletSheets(Array.from({ length: 4 }, () => rotated.pages[0]))
const repeatAssets = await preparePdfRenderAssets(await PDFDocument.create(), repeated, [
  rotated.source
])
assert.equal(repeatAssets.pdfPages.size, 1, 'duplicated artwork pages are embedded once')

await assert.rejects(
  exportBookletPdf(long.sheets, [], DEFAULT_SHEET_SETTINGS, () => {}),
  /Missing artwork/
)
assert.throws(
  () => assertArtworkSources(long.sheets, [{ ...long.source, bytes: new Uint8Array() }]),
  /Missing artwork/
)
const invalidPages = long.pages.map((page, i) =>
  i === 0 ? { ...page, sourcePageIndex: 999 } : page
)
await assert.rejects(
  exportBookletPdf(
    generateBookletSheets(invalidPages),
    [long.source],
    DEFAULT_SHEET_SETTINGS,
    () => {}
  ),
  /Page 1000 is missing/
)

for (const cancelPhase of ['preparing-pages', 'rendering-page', 'creating-pdf'] as const) {
  const controller = new AbortController()
  await assert.rejects(
    exportBookletPdf(
      long.sheets,
      [long.source],
      DEFAULT_SHEET_SETTINGS,
      (step) => {
        if (
          step.phase === cancelPhase &&
          (cancelPhase !== 'preparing-pages' || /8 of/.test(step.message))
        )
          controller.abort()
      },
      { signal: controller.signal }
    ),
    isCanceledError,
    `cancellation during ${cancelPhase} never returns a saveable PDF`
  )
}
const preCanceled = new AbortController()
preCanceled.abort()
await assert.rejects(
  exportBookletPdf(rotated.sheets, [rotated.source], DEFAULT_SHEET_SETTINGS, () => {}, {
    signal: preCanceled.signal
  }),
  isCanceledError
)

const blanks = await exportBookletPdf([], [], DEFAULT_SHEET_SETTINGS, () => {}, {
  emptySheets: [{ id: 'empty', label: 'Colored sheet', colorHex: '#00FF00' }]
})
assert.equal((await PDFDocument.load(await blanks.arrayBuffer())).getPageCount(), 1)
if (process.env.BOOKLET_EXPORT_ARTIFACT_DIR) {
  await mkdir(process.env.BOOKLET_EXPORT_ARTIFACT_DIR, { recursive: true })
  await writeFile(
    join(process.env.BOOKLET_EXPORT_ARTIFACT_DIR, 'long-booklet.pdf'),
    new Uint8Array(await blob.arrayBuffer())
  )
  await writeFile(
    join(process.env.BOOKLET_EXPORT_ARTIFACT_DIR, 'rotated-cropped-booklet.pdf'),
    new Uint8Array(await rotatedBlob.arrayBuffer())
  )
  await writeFile(
    join(process.env.BOOKLET_EXPORT_ARTIFACT_DIR, 'rotated-source.pdf'),
    rotated.source.bytes
  )
}
console.log('Booklet export reliability tests passed.')
