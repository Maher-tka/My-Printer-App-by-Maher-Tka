import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import fontkit from '@pdf-lib/fontkit'
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
  degrees,
  rgb,
  StandardFonts
} from 'pdf-lib'
import { DEFAULT_CARD_SETTINGS, type CardArtwork } from '../types'
import { exportCardMontagePdf } from './exportPdf'
import { getCardLayout } from './layout'
import { inspectCardPageFonts } from './pdfFonts'
import { assertCardFileSupported } from './artwork'
import { createCardPrintPdf, getCardPrintSetupError } from './printSetup'

const pt = (mm: number) => (mm * 72) / 25.4
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`)
const settings = { ...DEFAULT_CARD_SETTINGS, cutMarks: false }
function fontProgramHashes(doc: PDFDocument): string[] {
  const hashes = new Set<string>()
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue
    for (const key of ['FontFile', 'FontFile2', 'FontFile3']) {
      const stream = doc.context.lookup(object.get(PDFName.of(key)))
      if (stream instanceof PDFRawStream)
        hashes.add(createHash('sha256').update(decodePDFRawStream(stream).decode()).digest('hex'))
    }
  }
  return [...hashes].sort()
}
const fontBytes = await readFile(
  new URL('../../hardcover-cover/assets/fonts/Amiri-Regular.ttf', import.meta.url)
)
function content(doc: PDFDocument, pageIndex = 0): string {
  const streams = doc.getPage(pageIndex).node.Contents()!
  const refs = 'asArray' in streams ? streams.asArray() : [streams]
  return refs
    .map((ref) =>
      Buffer.from(decodePDFRawStream(doc.context.lookup(ref) as PDFRawStream).decode()).toString()
    )
    .join('\n')
}
type Matrix = number[]
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ]
}
function placements(stream: string, width: number, height: number) {
  let matrix = [1, 0, 0, 1, 0, 0]
  const stack: Matrix[] = []
  const bounds: { left: number; bottom: number; width: number; height: number }[] = []
  for (const line of stream.split('\n')) {
    if (line === 'q') stack.push([...matrix])
    else if (line === 'Q') matrix = stack.pop()!
    else if (line.endsWith(' cm'))
      matrix = multiply(matrix, line.split(' ').slice(0, 6).map(Number))
    else if (line.endsWith(' Do')) {
      const points = [
        [0, 0],
        [width, 0],
        [0, height],
        [width, height]
      ].map(([x, y]) => [
        matrix[0] * x + matrix[2] * y + matrix[4],
        matrix[1] * x + matrix[3] * y + matrix[5]
      ])
      const xs = points.map((p) => p[0]),
        ys = points.map((p) => p[1])
      bounds.push({
        left: Math.min(...xs),
        bottom: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
      })
    }
  }
  return bounds
}
for (const rotation of [0, 90, 180, 270]) {
  const source = await PDFDocument.create()
  source.registerFontkit(fontkit)
  const font = await source.embedFont(fontBytes, { subset: true })
  const page = source.addPage([300, 200])
  page.setCropBox(20, 30, 180, 120)
  page.setRotation(degrees(rotation))
  page.drawRectangle({ x: 20, y: 30, width: 180, height: 120, color: rgb(0.1, 0.2, 0.6) })
  page.drawText('FRONT', {
    x: 30,
    y: 60,
    font,
    size: 18
  })
  source.addPage([200, 100]).drawText('BACK', { font })
  const frontEncoded = font.encodeText('FRONT').toString().slice(1, -1)
  const backEncoded = font.encodeText('BACK').toString().slice(1, -1)
  const art: CardArtwork = {
    name: 'card.pdf',
    kind: 'pdf',
    bytesBase64: Buffer.from(await source.save()).toString('base64'),
    pageNumber: 1,
    pageCount: 2,
    widthMm: 60,
    heightMm: 40,
    previewDataUrl: ''
  }
  // Auto must stretch even if the other montage modes were using "contain".
  const doc = await PDFDocument.load(
    await exportCardMontagePdf(art, { ...settings, artworkFit: 'contain' })
  )
  assert.equal(doc.getPageCount(), 1)
  close(doc.getPage(0).getWidth(), pt(210))
  close(doc.getPage(0).getHeight(), pt(297))
  const stream = content(doc)
  const boxes = placements(stream, 180, 120)
  const layout = getCardLayout(settings)
  assert.equal(boxes.length, 10)
  for (let index = 0; index < boxes.length; index++) {
    close(boxes[index].left, pt(layout.slots[index].xMm))
    close(boxes[index].bottom, pt(297 - layout.slots[index].yMm - 56))
    close(boxes[index].width, pt(88))
    close(boxes[index].height, pt(56))
  }
  // Source artwork remains vector and the selected page, rather than its preview, is embedded.
  const forms = doc.context
    .enumerateIndirectObjects()
    .filter(
      ([, obj]) =>
        obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype'))?.toString() === '/Form'
    )
  assert.ok(forms.length)
  assert.ok(
    forms.some(([, obj]) =>
      Buffer.from(decodePDFRawStream(obj as PDFRawStream).decode())
        .toString()
        .includes(frontEncoded)
    )
  )
  assert.ok(
    !forms.some(([, obj]) =>
      Buffer.from(decodePDFRawStream(obj as PDFRawStream).decode())
        .toString()
        .includes(backEncoded)
    )
  )
  const contained = await PDFDocument.load(
    await exportCardMontagePdf(art, { ...settings, mode: 'zero', artworkFit: 'contain' })
  )
  const containedBoxes = placements(content(contained), 180, 120)
  close(
    containedBoxes[0].width / containedBoxes[0].height,
    rotation === 90 || rotation === 270 ? 120 / 180 : 180 / 120
  )
  assert.ok(
    containedBoxes.every((box) => box.width <= pt(85) + 1e-5 && box.height <= pt(55) + 1e-5)
  )
  const back = await PDFDocument.load(
    await exportCardMontagePdf({ ...art, pageNumber: 2 }, settings)
  )
  assert.equal(placements(content(back), 200, 100).length, 10)
  const explicitPair = await PDFDocument.load(
    await exportCardMontagePdf(art, { ...settings, includeBack: true }, { ...art, pageNumber: 2 })
  )
  assert.equal(explicitPair.getPageCount(), 2)
  assert.equal(placements(content(explicitPair), 180, 120).length, 10)
  assert.deepEqual(
    fontProgramHashes(explicitPair),
    fontProgramHashes(await PDFDocument.load(art.bytesBase64))
  )
  const both = await PDFDocument.load(
    await exportCardMontagePdf(art, { ...settings, exportAllPdfPages: true })
  )
  assert.equal(both.getPageCount(), 2)
  const printDraft = {
    artwork: art,
    back: { ...art, pageNumber: 2 },
    settings: { ...settings, includeBack: false, exportAllPdfPages: true }
  }
  assert.equal(getCardPrintSetupError(printDraft, 'both', 3), null)
  assert.equal(
    (await PDFDocument.load(await createCardPrintPdf(printDraft, 'front'))).getPageCount(),
    1
  )
  assert.equal(
    (await PDFDocument.load(await createCardPrintPdf(printDraft, 'back'))).getPageCount(),
    1
  )
  assert.equal(
    (await PDFDocument.load(await createCardPrintPdf(printDraft, 'both'))).getPageCount(),
    2
  )
  assert.match(
    getCardPrintSetupError({ ...printDraft, back: null }, 'both', 1) ?? '',
    /back design/
  )
  for (const copies of [0, -1, 1.5, 1000, NaN])
    assert.match(getCardPrintSetupError(printDraft, 'front', copies) ?? '', /copies/)
  assert.deepEqual(
    fontProgramHashes(both),
    fontProgramHashes(await PDFDocument.load(art.bytesBase64))
  )
  for (const outputPage of both.getPages()) {
    const preserved = inspectCardPageFonts(outputPage)
    assert.ok(preserved.length)
    assert.ok(preserved.every((entry) => entry.embedded))
  }
  await assert.rejects(exportCardMontagePdf({ ...art, pageNumber: 3 }, settings), /valid PDF page/)
}

const missingFontSource = await PDFDocument.create()
const multiSource = await PDFDocument.create()
multiSource.registerFontkit(fontkit)
const multiFont = await multiSource.embedFont(fontBytes, { subset: true })
for (let number = 1; number <= 4; number++)
  multiSource
    .addPage([240, 150])
    .drawText(`Design ${number}`, { x: 20, y: 70, font: multiFont, size: 20 })
const multiBytes = Buffer.from(await multiSource.save()).toString('base64')
const multiArt: CardArtwork = {
  name: 'four-artboards.ai',
  kind: 'pdf',
  bytesBase64: multiBytes,
  pageNumber: 3,
  pageCount: 4,
  widthMm: 85,
  heightMm: 55,
  previewDataUrl: ''
}
const chosen = await PDFDocument.load(
  await exportCardMontagePdf(
    multiArt,
    { ...settings, includeBack: true },
    { ...multiArt, pageNumber: 4 }
  )
)
assert.equal(chosen.getPageCount(), 2)
const chosenForms = chosen.context
  .enumerateIndirectObjects()
  .filter(
    ([, obj]) =>
      obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype'))?.toString() === '/Form'
  )
  .map(([, obj]) => Buffer.from(decodePDFRawStream(obj as PDFRawStream).decode()).toString())
  .join('\n')
for (const number of [3, 4])
  assert.ok(chosenForms.includes(multiFont.encodeText(`Design ${number}`).toString().slice(1, -1)))
for (const number of [1, 2])
  assert.ok(!chosenForms.includes(multiFont.encodeText(`Design ${number}`).toString().slice(1, -1)))
assert.deepEqual(fontProgramHashes(chosen), fontProgramHashes(await PDFDocument.load(multiBytes)))
missingFontSource
  .addPage([250, 150])
  .drawText('Missing font', { font: await missingFontSource.embedFont(StandardFonts.Helvetica) })
await missingFontSource.flush()
assert.deepEqual(inspectCardPageFonts(missingFontSource.getPage(0)), [
  { name: 'Helvetica', embedded: false }
])
const missingArt: CardArtwork = {
  name: 'unembedded.ai',
  kind: 'pdf',
  bytesBase64: Buffer.from(await missingFontSource.save()).toString('base64'),
  pageNumber: 1,
  pageCount: 1,
  widthMm: 85,
  heightMm: 55,
  previewDataUrl: ''
}
await assert.rejects(
  exportCardMontagePdf(missingArt, settings),
  /font data is not embedded.*Helvetica/
)
const mixedSource = await PDFDocument.create()
mixedSource.registerFontkit(fontkit)
mixedSource
  .addPage([240, 150])
  .drawText('EMBEDDED FRONT', { font: await mixedSource.embedFont(fontBytes, { subset: true }) })
mixedSource
  .addPage([240, 150])
  .drawText('UNEMBEDDED BACK', { font: await mixedSource.embedFont(StandardFonts.Helvetica) })
const mixedArt = {
  ...missingArt,
  bytesBase64: Buffer.from(await mixedSource.save()).toString('base64'),
  pageCount: 2
}
await assert.doesNotReject(exportCardMontagePdf(mixedArt, settings))
await assert.rejects(
  exportCardMontagePdf(mixedArt, { ...settings, exportAllPdfPages: true }),
  /Page 2.*font data is not embedded/
)
assert.throws(
  () => assertCardFileSupported(new TextEncoder().encode('%!PS-Adobe'), 'native-only.ai'),
  /without PDF compatibility/
)
assert.doesNotThrow(() =>
  assertCardFileSupported(new TextEncoder().encode('%PDF-1.5'), 'compatible.ai')
)

const png: CardArtwork = {
  name: 'pixel.png',
  kind: 'png',
  bytesBase64:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
  pageNumber: 1,
  pageCount: 1,
  widthMm: 1,
  heightMm: 1,
  previewDataUrl: ''
}
for (const mode of ['zero', 'spaced', 'auto'] as const) {
  const modeSettings = { ...settings, mode }
  const imageDoc = await PDFDocument.load(await exportCardMontagePdf(png, modeSettings))
  const boxes = placements(content(imageDoc), 1, 1)
  assert.equal(boxes.length, getCardLayout(modeSettings).capacity)
  close(boxes[0].width, pt(getCardLayout(modeSettings).widthMm))
  close(boxes[0].height, pt(getCardLayout(modeSettings).heightMm))
}
const forcedImage = await PDFDocument.load(
  await exportCardMontagePdf(png, { ...settings, artworkFit: 'contain' })
)
const forcedBoxes = placements(content(forcedImage), 1, 1)
close(forcedBoxes[0].width, pt(88))
close(forcedBoxes[0].height, pt(56))
const redMarks = await PDFDocument.load(
  await exportCardMontagePdf(png, {
    ...settings,
    mode: 'zero',
    cutMarks: true,
    cropMarkColor: '#ff0000'
  })
)
assert.match(content(redMarks), /0\.1875 w/)
assert.match(content(redMarks), /1 0 0 RG/)
assert.equal(
  (content(redMarks).match(/0\.1875 w/g) ?? []).length,
  getCardLayout({ ...settings, mode: 'zero', cutMarks: true }).marks.length
)
const noMarks = await PDFDocument.load(
  await exportCardMontagePdf(png, { ...settings, cutMarks: false, cropMarkColor: '#ff0000' })
)
assert.ok(!content(noMarks).includes('0.1875 w'))
assert.ok(!content(noMarks).includes('1 0 0 RG'))
const blueOutlines = await PDFDocument.load(
  await exportCardMontagePdf(
    png,
    { ...settings, cardOutline: true, cardOutlineColor: '#0000ff', includeBack: true },
    png
  )
)
for (const pageIndex of [0, 1]) {
  assert.match(content(blueOutlines, pageIndex), /0 0 1 RG/)
  assert.equal((content(blueOutlines, pageIndex).match(/0\.1875 w/g) ?? []).length, 10)
}
const automaticWithoutOutlines = await PDFDocument.load(
  await exportCardMontagePdf(png, { ...settings, cutMarks: true, cardOutline: false })
)
assert.ok(!content(automaticWithoutOutlines).includes('0.1875 w'))
const whiteSource = await PDFDocument.create()
whiteSource
  .addPage([240, 150])
  .drawRectangle({ x: 0, y: 0, width: 240, height: 150, color: rgb(1, 1, 1) })
const whiteCard = {
  ...png,
  name: 'white-card.pdf',
  kind: 'pdf' as const,
  bytesBase64: Buffer.from(await whiteSource.save()).toString('base64')
}
const visibleWhiteCardBorder = await PDFDocument.load(
  await exportCardMontagePdf(whiteCard, {
    ...settings,
    cardOutline: true,
    cardOutlineColor: '#ffffff'
  })
)
assert.match(content(visibleWhiteCardBorder), /0 0 0 RG/)
assert.equal((content(visibleWhiteCardBorder).match(/0\.1875 w/g) ?? []).length, 10)
const spacedCrosses = await PDFDocument.load(
  await exportCardMontagePdf(png, {
    ...settings,
    mode: 'spaced',
    cutMarks: true,
    cropMarkColor: '#00ff00',
    cardOutline: true
  })
)
assert.match(content(spacedCrosses), /0 1 0 RG/)
assert.equal(
  (content(spacedCrosses).match(/0\.1875 w/g) ?? []).length,
  getCardLayout({ ...settings, mode: 'spaced', cutMarks: true }).marks.length
)
await assert.rejects(
  exportCardMontagePdf(png, { ...settings, includeBack: true }),
  /back-side design/
)
const imagePair = await PDFDocument.load(
  await exportCardMontagePdf(png, { ...settings, includeBack: true }, png)
)
assert.equal(imagePair.getPageCount(), 2)
const mixedPair = await PDFDocument.load(
  await exportCardMontagePdf(mixedArt, { ...settings, includeBack: true }, png)
)
assert.equal(mixedPair.getPageCount(), 2)
const validBackOnly = await createCardPrintPdf({ artwork: missingArt, back: png, settings }, 'back')
assert.equal((await PDFDocument.load(validBackOnly)).getPageCount(), 1)
await assert.rejects(
  createCardPrintPdf({ artwork: png, back: missingArt, settings }, 'back'),
  /font data/i
)
await assert.rejects(
  exportCardMontagePdf(png, { ...settings, includeBack: true }, missingArt),
  /font data is not embedded/
)
await assert.rejects(exportCardMontagePdf(png, { ...settings, marginMm: 100 }), /does not fit/)
console.log('Card montage PDF export tests passed.')
