import assert from 'node:assert/strict'
import { polaroidDecodeOptions } from './polaroidImage'

function png(width: number, height: number) {
  const bytes = new Uint8Array(24)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  const header = new DataView(bytes.buffer)
  header.setUint32(16, width)
  header.setUint32(20, height)
  return bytes
}
function jpeg(width: number, height: number, orientation = 1) {
  const exif = new Uint8Array(32)
  exif.set([69, 120, 105, 102, 0, 0])
  const tiff = new DataView(exif.buffer, 6)
  tiff.setUint16(0, 0x4949)
  tiff.setUint16(2, 42, true)
  tiff.setUint32(4, 8, true)
  tiff.setUint16(8, 1, true)
  tiff.setUint16(10, 274, true)
  tiff.setUint16(12, 3, true)
  tiff.setUint32(14, 1, true)
  tiff.setUint16(18, orientation, true)
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe1,
    0,
    34,
    ...exif,
    0xff,
    0xc0,
    0,
    17,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    3,
    1,
    17,
    0,
    2,
    17,
    1,
    3,
    17,
    1,
    0xff,
    0xd9
  ])
}
for (const [bytes, extension] of [
  [png(6000, 4000), '.png'],
  [jpeg(6000, 4000), '.jpg']
] as const) {
  assert.deepEqual(polaroidDecodeOptions(bytes, extension, 795, 975), {
    resizeWidth: 1463,
    resizeHeight: 975,
    resizeQuality: 'high'
  })
}
assert.deepEqual(polaroidDecodeOptions(jpeg(6000, 4000, 6), '.jpeg', 795, 975), {
  resizeWidth: 795,
  resizeHeight: 1193,
  resizeQuality: 'high'
})
assert.deepEqual(polaroidDecodeOptions(png(100, 80), '.png', 795, 975), {
  resizeWidth: 100,
  resizeHeight: 80,
  resizeQuality: 'high'
})
const panorama = polaroidDecodeOptions(png(30000, 2000), '.png', 795, 975)
assert.equal(panorama.resizeWidth, 2200)
assert.ok(panorama.resizeHeight! < 2200)
assert.deepEqual(polaroidDecodeOptions(new Uint8Array([0, 1, 2]), '.jpg', 795, 975), {})
assert.deepEqual(polaroidDecodeOptions(new Uint8Array(24), '.png', 795, 975), {})
console.log('Polaroid bounded image decode, EXIF orientation and fallback tests passed.')
