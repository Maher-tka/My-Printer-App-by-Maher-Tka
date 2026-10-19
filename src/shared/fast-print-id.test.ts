import assert from 'node:assert/strict'
import {
  detectIdCrop,
  fullIdCrop,
  idCardPlacement,
  idCardAngle,
  validIdCrop,
  type IdCrop
} from './fast-print-id.js'
import { validateFastPrintPreset } from './fast-print.js'
import { createFastPrintChoices, type FastPrintChoice } from './fast-print-menu.js'

const photo: IdCrop = [
  { x: 0.1, y: 0.2 },
  { x: 0.9, y: 0.23 },
  { x: 0.85, y: 0.85 },
  { x: 0.12, y: 0.8 }
]
for (const paper of ['A4', 'A3'] as const)
  for (const landscape of [false, true]) {
    const result = idCardPlacement(1200, 900, photo, paper, landscape)
    assert.equal(result.widthMm, 90)
    const unstraightened = idCardPlacement(1200, 900, photo, paper, landscape, 0)
    assert.ok(Math.abs(unstraightened.heightMm - (90 * (0.65 * 900)) / (0.8 * 1200)) < 1e-8)
    assert.ok(result.heightMm > 0)
    assert.equal(result.xMm + 45, result.paperWidth / 2)
    assert.equal(result.yMm + result.heightMm / 2, result.paperHeight / 2)
    const back = idCardPlacement(900, 600, fullIdCrop(), paper, landscape)
    assert.equal(
      back.xMm + 45,
      result.xMm + 45,
      'Different side proportions share the physical sheet center'
    )
    assert.equal(back.yMm + back.heightMm / 2, result.yMm + result.heightMm / 2)
  }
assert.ok(validIdCrop(fullIdCrop()))
assert.ok(validIdCrop(photo))
assert.equal(validIdCrop([photo[0], photo[2], photo[1], photo[3]]), false, 'Reject crossing masks')
assert.equal(validIdCrop([{ x: NaN, y: 0 }, ...photo.slice(1)] as IdCrop), false)
assert.throws(() => idCardPlacement(100, 2000, fullIdCrop(), 'A4'), /too tall/)
assert.throws(() => idCardPlacement(0, 900, fullIdCrop(), 'A4'), /corners/)
assert.throws(() => idCardPlacement(900, 600, fullIdCrop(), 'A4', false, NaN), /angle/)
assert.throws(() => idCardPlacement(900, 600, fullIdCrop(), 'A4', false, 181), /angle/)

function rotatedCrop(
  centerX: number,
  centerY: number,
  cardWidth: number,
  cardHeight: number,
  angle: number,
  photoWidth: number,
  photoHeight: number
): IdCrop {
  const cos = Math.cos((angle * Math.PI) / 180),
    sin = Math.sin((angle * Math.PI) / 180)
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ].map(([x, y]) => ({
    x: (centerX + ((x * cardWidth) / 2) * cos - ((y * cardHeight) / 2) * sin) / photoWidth,
    y: (centerY + ((x * cardWidth) / 2) * sin + ((y * cardHeight) / 2) * cos) / photoHeight
  })) as IdCrop
}
for (const angle of [-70, -45, -20, 0, 25, 45, 70, 89]) {
  for (const [cx, cy] of [
    [130, 120],
    [850, 650],
    [350, 450]
  ]) {
    const crop = rotatedCrop(cx, cy, 180, 112, angle, 1024, 768)
    assert.ok(validIdCrop(crop))
    assert.ok(Math.abs(idCardAngle(1024, 768, crop) - angle) < 1e-8)
    for (const paper of ['A4', 'A3'] as const) {
      const p = idCardPlacement(1024, 768, crop, paper)
      assert.ok(
        Math.abs(p.width - 180) < 1e-8,
        'Measure the straightened card, not its diagonal photo bounds'
      )
      assert.ok(Math.abs(p.height - 112) < 1e-8)
      assert.equal(p.widthMm, 90)
      assert.ok(Math.abs(p.heightMm - 56) < 1e-8)
      assert.equal(p.xMm + 45, p.paperWidth / 2)
      assert.equal(p.yMm + p.heightMm / 2, p.paperHeight / 2)
    }
  }
}
const diagonal = rotatedCrop(300, 240, 180, 112, 45, 1024, 768)
const manualAngle = idCardPlacement(1024, 768, diagonal, 'A4', false, 45)
assert.ok(Math.abs(manualAngle.heightMm - 56) < 1e-8)

function cardPhoto(cx: number, cy: number, cardWidth: number, cardHeight: number, angle: number) {
  const width = 240,
    height = 180
  const data = new Uint8ClampedArray(width * height * 4)
  const cos = Math.cos((angle * Math.PI) / 180),
    sin = Math.sin((angle * Math.PI) / 180)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const localX = (x + 0.5 - cx) * cos + (y + 0.5 - cy) * sin
      const localY = -(x + 0.5 - cx) * sin + (y + 0.5 - cy) * cos
      data.set(
        Math.abs(localX) <= cardWidth / 2 && Math.abs(localY) <= cardHeight / 2
          ? [245, 230, 200, 255]
          : [35, 35, 35, 255],
        (y * width + x) * 4
      )
    }
  return { data, width, height }
}
for (const angle of [-65, -45, -12, 0, 22, 45, 65]) {
  for (const [cx, cy] of [
    [60, 75],
    [180, 110]
  ]) {
    const { data, width, height } = cardPhoto(cx, cy, 90, 55, angle)
    const crop = detectIdCrop(data, width, height)
    assert.notDeepEqual(crop, fullIdCrop(), `Find off-center card at ${angle}°`)
    assert.ok(
      Math.abs(idCardAngle(width, height, crop) - angle) < 2,
      `Detect actual card angle ${angle}°`
    )
    assert.ok(Math.abs((crop.reduce((sum, p) => sum + p.x, 0) / 4) * width - cx) < 3)
    assert.ok(Math.abs((crop.reduce((sum, p) => sum + p.y, 0) / 4) * height - cy) < 3)
    const p = idCardPlacement(width, height, crop, 'A4')
    assert.ok(Math.abs(p.heightMm / p.widthMm - 55 / 90) < 0.05)
  }
}
const clipped = cardPhoto(25, 60, 90, 55, -45)
const clippedCrop = detectIdCrop(clipped.data, clipped.width, clipped.height)
assert.notDeepEqual(clippedCrop, fullIdCrop(), 'A slightly clipped card may touch the photo border')
assert.ok(validIdCrop(clippedCrop))
assert.ok(clippedCrop.some((p) => p.x === 0))
assert.equal(idCardPlacement(clipped.width, clipped.height, clippedCrop, 'A4').widthMm, 90)

const pixels = new Uint8ClampedArray(100 * 80 * 4)
for (let y = 0; y < 80; y++)
  for (let x = 0; x < 100; x++) {
    const i = (y * 100 + x) * 4
    pixels.set(
      x >= 15 && x <= 85 && y >= 20 && y <= 60 ? [245, 230, 200, 255] : [35, 35, 35, 255],
      i
    )
  }
const detected = detectIdCrop(pixels, 100, 80)
assert.ok(detected[0].x <= 0.15 && detected[0].y <= 0.25)
assert.ok(detected[2].x >= 0.85 && detected[2].y >= 0.75)
assert.ok(detected[0].x > 0 && detected[2].x < 1, 'Rough crop removes uniform table padding')
pixels.fill(120)
assert.deepEqual(
  detectIdCrop(pixels, 100, 80),
  fullIdCrop(),
  'No confident card: retain all source pixels'
)

const preset = {
  printer: 'Printer',
  paper: 'A4',
  color: false,
  pagesPerSheet: 1,
  duplex: true,
  mode: 'id-card'
} as const
assert.deepEqual(validateFastPrintPreset(preset), preset)
for (const invalid of [
  { ...preset, mode: 'unknown' },
  { ...preset, duplex: 'true' },
  { ...preset, pagesPerSheet: 2 }
]) {
  assert.throws(() => validateFastPrintPreset(invalid), /Invalid Fast Print/)
}
function leaves(items: FastPrintChoice[]): FastPrintChoice[] {
  return items.flatMap((item) => (item.children ? leaves(item.children) : item))
}
const choices = leaves(
  createFastPrintChoices(
    [
      { name: 'Duplex printer', papers: ['A4', 'A3'], color: true, duplex: true },
      { name: 'Mono simplex', papers: ['A4'], color: false }
    ],
    [
      {
        id: '1234567890abcdef1234567890abcdef',
        name: 'Tray',
        printer: 'Duplex printer',
        paper: 'A4'
      }
    ]
  )
)
const idPresets = choices
  .filter((choice) => choice.preset?.mode === 'id-card')
  .map((choice) => choice.preset!)
assert.equal(idPresets.length, 7)
assert.equal(idPresets.filter((item) => item.profileId).length, 2)
assert.ok(idPresets.every((item) => item.pagesPerSheet === 1))
assert.ok(
  idPresets.filter((item) => item.printer === 'Duplex printer').every((item) => item.duplex)
)
assert.ok(
  idPresets
    .filter((item) => item.printer === 'Mono simplex')
    .every((item) => !item.color && !item.duplex)
)
console.log('Fast Print ID geometry, rough crop, duplex and menu tests passed.')
