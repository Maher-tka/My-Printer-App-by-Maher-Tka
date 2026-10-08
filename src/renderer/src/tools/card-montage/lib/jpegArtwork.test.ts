import assert from 'node:assert/strict'
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  decodePDFRawStream
} from 'pdf-lib'
import { createCardJpegPdf, getCardJpegPlacement, readCardJpegInfo } from './jpegArtwork'
import { exportCardMontagePdf } from './exportPdf'
import { createCardPrintPdf } from './printSetup'
import { DEFAULT_CARD_SETTINGS, type CardArtwork } from '../types'

// Anonymous 16x8 JPEG with a CMYK dark-blue patch, generated using Pillow.
const jpeg = Uint8Array.from(
  Buffer.from(
    '/9j/7gAOQWRvYmUAZAAAAAAA/9sAQwACAQEBAQECAQEBAgICAgIEAwICAgIFBAQDBAYFBgYGBQYGBgcJCAYHCQcGBggLCAkKCgoKCgYICwwLCgwJCgoK/8AAFAgACAAQBEMRAE0RAFkRAEsRAP/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAA4EQwBNAFkASwAAPwD8J6/KOrlfO9FFFFf/2Q==',
    'base64'
  )
)
const segment = (marker: number, payload: Uint8Array) =>
  Uint8Array.from([0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload])
const insert = (...segments: Uint8Array[]) =>
  Uint8Array.from([0xff, 0xd8, ...segments.flatMap((part) => [...part]), ...jpeg.subarray(2)])
// A synthetic ICC header tests transport only; no third-party profile is committed.
const profile = new Uint8Array(128)
new DataView(profile.buffer).setUint32(0, profile.length)
profile.set(new TextEncoder().encode('CMYK'), 16)
profile.set(new TextEncoder().encode('acsp'), 36)
const icc = (sequence: number, count: number, data: Uint8Array) =>
  segment(
    0xe2,
    Uint8Array.from([...new TextEncoder().encode('ICC_PROFILE\0'), sequence, count, ...data])
  )
const tagged = insert(icc(2, 2, profile.subarray(60)), icc(1, 2, profile.subarray(0, 60)))
assert.deepEqual(readCardJpegInfo(jpeg), {
  width: 16,
  height: 8,
  channels: 4,
  orientation: 1,
  adobe: true,
  profile: undefined
})
assert.deepEqual(
  readCardJpegInfo(tagged).profile,
  profile,
  'ICC chunks are restored in sequence order'
)
const offsetBuffer = Uint8Array.from([0, 0, ...tagged, 0])
assert.deepEqual(readCardJpegInfo(offsetBuffer.subarray(2, -1)).profile, profile)
assert.throws(() => readCardJpegInfo(insert(icc(1, 2, profile))), /incomplete/)
assert.throws(() => readCardJpegInfo(insert(icc(1, 1, profile), icc(1, 1, profile))), /corrupted/)
assert.throws(() => readCardJpegInfo(insert(icc(1, 2, profile), icc(2, 3, profile))), /corrupted/)
const wrongProfile = profile.slice()
wrongProfile.set(new TextEncoder().encode('RGB '), 16)
assert.throws(() => readCardJpegInfo(insert(icc(1, 1, wrongProfile))), /does not match/)
assert.throws(() => readCardJpegInfo(jpeg.subarray(0, 20)), /incomplete/)

function exif(value: number, little: boolean) {
  const tiff = new Uint8Array(26),
    view = new DataView(tiff.buffer)
  view.setUint16(0, little ? 0x4949 : 0x4d4d)
  view.setUint16(2, 42, little)
  view.setUint32(4, 8, little)
  view.setUint16(8, 1, little)
  view.setUint16(10, 274, little)
  view.setUint16(12, 3, little)
  view.setUint32(14, 1, little)
  view.setUint16(18, value, little)
  return segment(0xe1, Uint8Array.from([...new TextEncoder().encode('Exif\0\0'), ...tiff]))
}
for (const little of [true, false])
  for (let orientation = 1; orientation <= 8; orientation++) {
    const info = readCardJpegInfo(
      insert(
        exif(orientation, little),
        segment(0xe1, new TextEncoder().encode('unrelated XMP metadata'))
      )
    )
    assert.equal(info.orientation, orientation)
    const placement = getCardJpegPlacement(info)
    assert.deepEqual([placement.width, placement.height], orientation >= 5 ? [8, 16] : [16, 8])
    const [a, b, c, d, e, f] = placement.matrix
    const corners = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1]
    ].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f])
    assert.deepEqual(
      [...new Set(corners.map((p) => p[0]))].sort((a, b) => a - b),
      [0, placement.width]
    )
    assert.deepEqual(
      [...new Set(corners.map((p) => p[1]))].sort((a, b) => a - b),
      [0, placement.height]
    )
    const output = await PDFDocument.load(
      await createCardJpegPdf(insert(exif(orientation, little)))
    )
    assert.deepEqual(output.getPage(0).getSize(), {
      width: placement.width,
      height: placement.height
    })
  }

const artwork: CardArtwork = {
  name: 'cmyk.jpg',
  kind: 'jpeg',
  bytesBase64: Buffer.from(tagged).toString('base64'),
  pageNumber: 1,
  pageCount: 1,
  widthMm: 85,
  heightMm: 55,
  previewDataUrl: ''
}
for (const route of ['export', 'front', 'back', 'both'] as const) {
  const bytes =
    route === 'export'
      ? await exportCardMontagePdf(artwork, DEFAULT_CARD_SETTINGS)
      : await createCardPrintPdf({ artwork, back: artwork, settings: DEFAULT_CARD_SETTINGS }, route)
  const output = await PDFDocument.load(bytes)
  assert.equal(output.getPageCount(), route === 'both' ? 2 : 1)
  const images = output.context
    .enumerateIndirectObjects()
    .filter(
      ([, obj]) =>
        obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype'))?.toString() === '/Image'
    )
  assert.equal(
    images.length,
    route === 'both' ? 2 : 1,
    'Each side reuses its original JPEG across all card slots'
  )
  for (const [, object] of images) {
    const image = object as PDFRawStream
    assert.deepEqual(image.contents, tagged, 'The JPEG compressed bytes remain unchanged')
    const space = image.dict.lookup(PDFName.of('ColorSpace'), PDFArray)
    assert.equal(space.lookup(0, PDFName).toString(), '/ICCBased')
    const iccStream = space.lookup(1, PDFRawStream)
    assert.equal(iccStream.dict.lookup(PDFName.of('N'), PDFNumber).asNumber(), 4)
    assert.deepEqual(decodePDFRawStream(iccStream).decode(), profile)
    assert.equal(
      image.dict.lookup(PDFName.of('Decode'), PDFArray).toString(),
      '[ 1 0 1 0 1 0 1 0 ]'
    )
    assert.equal(image.dict.has(PDFName.of('SMask')), false)
  }
}
console.log('Card JPEG profile preservation, orientation and front/back printing tests passed.')
