import assert from 'node:assert/strict'
import { PDFDocument, PDFName, degrees, rgb } from 'pdf-lib'
import {
  DEFAULT_STICKER_SHEET_SETTINGS as defaults,
  findStickerSheetBounds,
  stickerSheetForeground,
  stickerExportName,
  cropStickerVectorPdf,
  resizeStickerVectorPdf,
  clampStickerBounds,
  mergeStickerBounds,
  validateStickerSheetSize,
  isRasterStickerPage,
  findStickerSheetSelections,
  selectStickerArtwork,
  fillStickerInteriors,
  splitStickerBounds
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
assert.deepEqual(clampStickerBounds({ x: -0.2, y: 0.9, width: 1.2, height: 0.5 }), {
  x: 0,
  y: 0.9,
  width: 1,
  height: 1 - 0.9
})
assert.deepEqual(
  clampStickerBounds({
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.4,
    removeBackground: false
  } as import('./stickerSheet').ReviewedStickerBounds),
  { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
)
assert.deepEqual(
  mergeStickerBounds([
    { x: 0.1, y: 0.2, width: 0.2, height: 0.2 },
    { x: 0.5, y: 0.1, width: 0.1, height: 0.5 }
  ]),
  { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }
)
assert.throws(() => clampStickerBounds({ x: NaN, y: 0, width: 1, height: 1 }), /Invalid/)
assert.throws(() => mergeStickerBounds([]), /Select/)

validateStickerSheetSize(94_570_309, true)
validateStickerSheetSize(90_338_019, true)
assert.throws(() => validateStickerSheetSize(94_570_309, false), /65 MB/)
assert.throws(() => validateStickerSheetSize(257 * 1024 * 1024, true), /256 MB/)
assert.throws(() => validateStickerSheetSize(0, true), /256 MB/)
const ops = { save: 1, paintImageXObject: 2, constructPath: 3, showText: 4, shadingFill: 5 }
assert.equal(isRasterStickerPage([1, 2], ops), true)
for (const op of [3, 4, 5]) assert.equal(isRasterStickerPage([1, 2, op], ops), false)
assert.equal(isRasterStickerPage([1], ops), false)

// A flattened checkerboard must not mistake the stickers' white outlines for paper.
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const color = (Math.floor(x / 20) + Math.floor(y / 20)) % 2 ? 40 : 0
    pixels.set([color, color, color, 255], (y * width + x) * 4)
  }
rect(15, 15, 50, 50, [255, 255, 255, 255])
rect(25, 25, 30, 30, [0, 0, 0, 255])
rect(35, 35, 10, 10, [255, 0, 0, 255])
rect(100, 20, 50, 50, [255, 255, 255, 255])
foreground = stickerSheetForeground(pixels, width, height)
assert.equal(foreground[0], 0)
assert.equal(foreground[15 * width + 15], 1, 'White outline remains foreground')
assert.equal(
  findStickerSheetBounds(foreground, width, height, defaults).length,
  2,
  'An outlined sticker includes its disconnected enclosed details without duplicate tabs'
)

const selections = findStickerSheetSelections(foreground, width, height, defaults)
assert.equal(selections.length, 2)
assert.equal(
  fillStickerInteriors(foreground, width, height)[30 * width + 30],
  1,
  'Enclosed black artwork belongs to its white outline'
)
const selected = selectStickerArtwork(foreground, width, height, selections[0].seeds!)
assert.equal(selected[30 * width + 30], 1, 'Isolation retains dark enclosed details')
assert.equal(selected[30 * width + 120], 0, 'Isolation excludes a neighboring outlined sticker')
const mergedSelection = selectStickerArtwork(
  foreground,
  width,
  height,
  selections.flatMap((s) => s.seeds!)
)
assert.equal(mergedSelection[30 * width + 30], 1)
assert.equal(mergedSelection[30 * width + 120], 1, 'All explicitly merged parts survive isolation')
assert.throws(() => selectStickerArtwork(foreground, width, height, [{ x: NaN, y: 0 }]), /Invalid/)
assert.throws(() => selectStickerArtwork(foreground, width, height, [{ x: 0, y: 0 }]), /no longer/)
assert.throws(
  () => selectStickerArtwork(foreground, width, height, [...selections[0].seeds!, { x: 0, y: 0 }]),
  /no longer/,
  'A stale merged part must produce an error rather than silently disappearing'
)
assert.throws(() => fillStickerInteriors(new Uint8Array(3), 1.5, 2), /Invalid/)
assert.deepEqual(splitStickerBounds({ x: 0.1, y: 0.2, width: 0.6, height: 0.4 }, 'x'), [
  { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
  { x: 0.4, y: 0.2, width: 0.3, height: 0.4 }
])
const close = new Uint8Array(100 * 100)
for (let y = 10; y < 40; y++) for (let x = 10; x < 30; x++) close[y * 100 + x] = 1
for (let y = 10; y < 40; y++) for (let x = 31; x < 55; x++) close[y * 100 + x] = 1
assert.equal(
  findStickerSheetBounds(close, 100, 100, defaults).length,
  2,
  'Default detection preserves a one-pixel gap between neighboring stickers'
)

const openOutline = new Uint8Array(100 * 100)
for (let y = 10; y < 80; y++)
  for (let x = 10; x < 80; x++) if (x < 13 || y < 13 || y >= 77) openOutline[y * 100 + x] = 1
for (let y = 40; y < 42; y++) for (let x = 40; x < 42; x++) openOutline[y * 100 + x] = 1
const withDetail = findStickerSheetSelections(openOutline, 100, 100, defaults)
assert.equal(
  withDetail.length,
  1,
  'A tiny enclosed-in-bounds detail belongs to its surrounding artwork'
)
assert.equal(
  withDetail[0].seeds?.length,
  2,
  'Attaching a tiny detail retains its independent source point'
)
assert.equal(selectStickerArtwork(openOutline, 100, 100, withDetail[0].seeds!)[40 * 100 + 40], 1)

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
