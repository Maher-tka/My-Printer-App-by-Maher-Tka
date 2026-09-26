import assert from 'node:assert/strict'
import { inflateSync } from 'node:zlib'
import { PDFDocument, PDFRawStream, StandardFonts, degrees, rgb } from 'pdf-lib'
import type { NumberArtwork } from '../types'
import { createDefaultSequentialProject } from './layout'
import { exportSequentialPdf } from './exportPdf'
const source = await PDFDocument.create()
const sourcePage = source.addPage([300, 200])
sourcePage.drawRectangle({ x: 20, y: 20, width: 100, height: 100, color: rgb(1, 0, 0) })
sourcePage.setCropBox(20, 20, 200, 150)
sourcePage.setRotation(degrees(90))
const art: NumberArtwork = {
  name: 'Test.pdf',
  kind: 'pdf',
  bytesBase64: Buffer.from(await source.save()).toString('base64'),
  pageNumber: 1,
  pageCount: 1,
  widthMm: 50,
  heightMm: 70,
  previewDataUrl: ''
}
const project = createDefaultSequentialProject()
project.front = art
project.back = art
project.settings = {
  ...project.settings,
  ticketHeightMm: 130,
  quantity: 10,
  cropMarks: false,
  backMode: 'artwork',
  numberBack: true
}
project.positions.push({ ...project.positions[0], id: 'stub', yMm: 30 })
const progress: number[] = []
const bytes = await exportSequentialPdf(project, { onProgress: (done) => progress.push(done) })
const doc = await PDFDocument.load(bytes)
assert.equal(doc.getPageCount(), 6)
assert.ok(Math.abs(doc.getPage(0).getWidth() - (210 * 72) / 25.4) < 0.001)
assert.deepEqual(progress, [0, 1, 2, 3, 4, 5, 6])
function contents(document: PDFDocument, pageIndex: number): string {
  const streams = document.getPage(pageIndex).node.Contents()
  if (!streams) return ''
  const refs = 'asArray' in streams ? streams.asArray() : [streams]
  return refs
    .map((ref) => {
      const stream = document.context.lookup(ref)
      return stream instanceof PDFRawStream ? inflateSync(stream.contents).toString() : ''
    })
    .join('\n')
}
const font = await doc.embedFont(StandardFonts.Helvetica)
const encoded = (text: string) => font.encodeText(text).toString()
for (const page of [0, 1])
  for (const label of ['0001', '0004', '0007', '0010'])
    assert.equal(contents(doc, page).split(encoded(label)).length - 1, 2)
for (const page of [2, 3])
  for (const label of ['0002', '0005', '0008'])
    assert.equal(contents(doc, page).split(encoded(label)).length - 1, 2)
assert.ok(!contents(doc, 2).includes(encoded('0011')))
assert.match(contents(doc, 0), / Do/)
const blank = await PDFDocument.load(
  await exportSequentialPdf({ ...project, settings: { ...project.settings, backMode: 'blank' } })
)
assert.equal(blank.getPageCount(), 6)
assert.equal(contents(blank, 1), '')
const simplex = await PDFDocument.load(
  await exportSequentialPdf({ ...project, settings: { ...project.settings, backMode: 'none' } })
)
assert.equal(simplex.getPageCount(), 3)
await assert.rejects(exportSequentialPdf({ ...project, front: null }), /front design/)
await assert.rejects(
  exportSequentialPdf({ ...project, positions: [{ ...project.positions[0], xMm: -1 }] }),
  /outside/
)
const controller = new AbortController()
await assert.rejects(
  exportSequentialPdf(project, {
    signal: controller.signal,
    onProgress: (done) => {
      if (done === 1) controller.abort()
    }
  }),
  { name: 'AbortError' }
)

// Vector art retains its crop box and is rotated clockwise to match the import preview.
const vectorForms = doc.context
  .enumerateIndirectObjects()
  .map(([, value]) => value)
  .filter(
    (value): value is PDFRawStream =>
      value instanceof PDFRawStream && value.dict.toString().includes('/Subtype /Form')
  )
assert.equal(vectorForms.length, 2, 'one embedded vector form for each side, reused across sheets')
assert.ok(vectorForms.every((form) => form.dict.toString().includes('/BBox [ 20 20 220 170 ]')))
assert.match(contents(doc, 0), /-1 1 /, '90-degree clockwise transform is applied')
const png: NumberArtwork = {
  ...art,
  kind: 'png',
  name: 'pixel.png',
  bytesBase64:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII='
}
const raster = await PDFDocument.load(
  await exportSequentialPdf({
    ...project,
    front: png,
    settings: { ...project.settings, backMode: 'none' }
  })
)
const images = raster.context
  .enumerateIndirectObjects()
  .map(([, value]) => value)
  .filter(
    (value) => value instanceof PDFRawStream && value.dict.toString().includes('/Subtype /Image')
  )
assert.ok(images.length <= 2, 'one image plus optional alpha mask is reused across all tickets')

console.log('Sequential PDF export regression tests passed')

// Out-of-page crop boxes must match the visible region used by PDF.js previews.
for (const [x, y, width, height, expected] of [
  [-20, -10, 350, 250, '/BBox [ 0 0 300 200 ]'],
  [500, 500, 10, 10, '/BBox [ 0 0 300 200 ]']
] as const) {
  sourcePage.setCropBox(x, y, width, height)
  const cropped = await PDFDocument.load(
    await exportSequentialPdf({
      ...project,
      front: { ...art, bytesBase64: Buffer.from(await source.save()).toString('base64') },
      settings: { ...project.settings, quantity: 1, backMode: 'none' }
    })
  )
  const forms = cropped.context
    .enumerateIndirectObjects()
    .map(([, value]) => value)
    .filter(
      (value): value is PDFRawStream =>
        value instanceof PDFRawStream && value.dict.toString().includes('/Subtype /Form')
    )
  assert.ok(forms.some((form) => form.dict.toString().includes(expected)))
}

const withFixedText = await PDFDocument.load(
  await exportSequentialPdf({
    ...project,
    settings: { ...project.settings, startNumber: 133, digits: 7 },
    positions: [
      ...project.positions,
      { ...project.positions[0], id: 'fixed-label', kind: 'text', text: 'Ticket No.', yMm: 45 }
    ]
  })
)
assert.equal(
  contents(withFixedText, 0).split(encoded('Ticket No.')).length - 1,
  4,
  'fixed label repeats unchanged on every occupied ticket'
)
assert.equal(
  contents(withFixedText, 0).split(encoded('0000133')).length - 1,
  2,
  'padded number appears on ticket and stub'
)
await assert.rejects(
  () =>
    exportSequentialPdf({
      ...project,
      positions: [{ ...project.positions[0], kind: 'text', text: 'LABEL', xMm: 89 }]
    }),
  /outside/
)

const gutterPdf = await PDFDocument.load(
  await exportSequentialPdf({
    ...project,
    settings: {
      ...project.settings,
      gutterCutLines: true,
      cuttingLineColor: '#00ff00',
      cropMarks: false
    }
  })
)
assert.match(contents(gutterPdf, 0), /0 1 0 RG/, 'PDF uses selected cutting line color')
assert.match(contents(gutterPdf, 0), /0.25 w/, 'PDF uses 0.25 point cutting lines')
const gutterBlank = await PDFDocument.load(
  await exportSequentialPdf({
    ...project,
    settings: { ...project.settings, gutterCutLines: true, backMode: 'blank' }
  })
)
assert.equal(contents(gutterBlank, 1), '', 'blank backs remain blank')
await assert.rejects(
  () =>
    exportSequentialPdf({
      ...project,
      settings: { ...project.settings, gutterCutLines: true, gapMm: 0 }
    }),
  /0.1 mm/
)

for (let page = 1; page < gutterPdf.getPageCount(); page++) {
  assert.doesNotMatch(
    contents(gutterPdf, page),
    /0 1 0 RG/,
    'later duplex pages contain no gutter cutting lines'
  )
}
const singleSidedGutters = await PDFDocument.load(
  await exportSequentialPdf({
    ...project,
    settings: {
      ...project.settings,
      gutterCutLines: true,
      cuttingLineColor: '#00ff00',
      cropMarks: false,
      backMode: 'none'
    }
  })
)
assert.match(contents(singleSidedGutters, 0), /0 1 0 RG/)
for (let page = 1; page < singleSidedGutters.getPageCount(); page++) {
  assert.doesNotMatch(
    contents(singleSidedGutters, page),
    /0 1 0 RG/,
    'later single-sided pages contain no gutter cutting lines'
  )
}
