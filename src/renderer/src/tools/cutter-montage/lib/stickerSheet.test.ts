import assert from 'node:assert/strict'
import { PDFDocument, PDFName, degrees, rgb } from 'pdf-lib'
import {
  DEFAULT_STICKER_SHEET_SETTINGS as defaults,
  findStickerSheetBounds,
  stickerSheetForeground,
  stickerExportName,
  cropStickerVectorPdf,
  resizeStickerVectorPdf
} from './stickerSheet'

const width = 200,
  height = 160
const pixels = new Uint8ClampedArray(width * height * 4).fill(255)
const rect = (x: number, y: number, w: number, h: number, color = [0, 0, 0, 255]) => {
  for (let py = y; py < y + h; py++)
    for (let px = x; px < x + w; px++) pixels.set(color, (py * width + px) * 4)
}
rect(10, 10, 25, 20)
rect(80, 10, 30, 20)
rect(10, 90, 25, 30)
let foreground = stickerSheetForeground(pixels, width, height)
assert.equal(
  findStickerSheetBounds(foreground, width, height, { ...defaults, paddingPercent: 0 }).length,
  3
)
const original = pixels.slice()
findStickerSheetBounds(foreground, width, height, defaults)
assert.deepEqual(pixels, original, 'Detection never changes original pixels')
assert.equal(
  findStickerSheetBounds(foreground, width, height, {
    ...defaults,
    mode: 'grid',
    rows: 2,
    columns: 2
  }).length,
  3,
  'Skip blank final grid slot'
)
assert.throws(
  () =>
    findStickerSheetBounds(foreground, width, height, {
      ...defaults,
      mode: 'grid',
      rows: 50,
      columns: 50
    }),
  /500/
)
assert.throws(
  () => findStickerSheetBounds(foreground, width, height, { ...defaults, joinPercent: NaN }),
  /Invalid/
)
pixels.fill(0)
rect(10, 10, 25, 20, [255, 255, 255, 255])
foreground = stickerSheetForeground(pixels, width, height)
assert.equal(
  findStickerSheetBounds(foreground, width, height, defaults).length,
  1,
  'White artwork on transparency is retained'
)
for (let i = 0; i < pixels.length; i += 4) pixels.set([120, 120, 120, 255], i)
rect(10, 10, 25, 20, [255, 255, 255, 255])
rect(80, 10, 30, 20)
foreground = stickerSheetForeground(pixels, width, height)
assert.equal(
  findStickerSheetBounds(foreground, width, height, defaults).length,
  2,
  'Plain gray sheet background is detected'
)
rect(0, 0, width, 2, [255, 255, 255, 255])
rect(0, height - 2, width, 2, [255, 255, 255, 255])
rect(0, 0, 2, height, [255, 255, 255, 255])
rect(width - 2, 0, 2, height, [255, 255, 255, 255])
assert.equal(
  findStickerSheetBounds(stickerSheetForeground(pixels, width, height), width, height, defaults)
    .length,
  2,
  'Ignore a thin outer screenshot frame while retaining its stickers'
)
const parts = new Uint8Array(100 * 100)
for (let y = 20; y < 40; y++) for (let x = 10; x < 30; x++) parts[y * 100 + x] = 1
for (let y = 20; y < 40; y++) for (let x = 32; x < 50; x++) parts[y * 100 + x] = 1
assert.equal(findStickerSheetBounds(parts, 100, 100, { ...defaults, joinPercent: 0 }).length, 2)
assert.equal(
  findStickerSheetBounds(parts, 100, 100, { ...defaults, joinPercent: 4 }).length,
  1,
  'Join nearby lettering without changing pixels'
)
assert.equal(stickerExportName('CON.ai', 0, 'svg'), '001-CON.svg')
assert.doesNotMatch(stickerExportName('../my:design?.png', 1, 'png'), /[\\/:?]/)

for (const rotation of [0, 90, 180, 270]) {
  const document = await PDFDocument.create()
  const page = document.addPage([400, 600])
  page.setCropBox(20, 30, 300, 500)
  page.setRotation(degrees(rotation))
  page.drawRectangle({ x: 20, y: 30, width: 300, height: 500, color: rgb(1, 0, 0) })
  const crop = await cropStickerVectorPdf(await document.save(), 1, {
    x: 0.1,
    y: 0.2,
    width: 0.4,
    height: 0.3
  })
  const cropped = await PDFDocument.load(crop),
    output = cropped.getPage(0)
  assert.ok(Math.abs(output.getWidth() - (rotation % 180 ? 500 : 300) * 0.4) < 0.01)
  assert.ok(Math.abs(output.getHeight() - (rotation % 180 ? 300 : 500) * 0.3) < 0.01)
  const resources = output.node.Resources()?.lookup(PDFName.of('XObject'))
  assert.ok(resources, 'Vector crops embed PDF form content')
  const resized = await PDFDocument.load(await resizeStickerVectorPdf(crop, 90))
  assert.ok(Math.abs((resized.getPage(0).getWidth() * 25.4) / 72 - 90) < 0.001)
}
console.log(
  'Sticker sheet detection, blank cells, grouping, plain backgrounds, safe names and rotated vector PDF crops passed.'
)
