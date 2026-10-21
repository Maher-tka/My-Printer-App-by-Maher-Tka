import assert from 'node:assert/strict'
import { idCardProjection, rectifyIdPixels } from './id-card-perspective.js'
import { idHeaderOrientation, scoreIdText, chooseIdTextOrientation } from './id-orientation.js'
import {
  detectIdCrop,
  fullIdCrop,
  idCardPlacement,
  idCardAngle,
  validIdCrop,
  initialIdSide,
  rotateIdSide,
  horizontalIdSide,
  validateIdSheetSettings,
  DEFAULT_ID_SHEET_SETTINGS,
  idPrintedSize,
  idCopiesLayout,
  idCopyCenters,
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
assert.ok(Math.abs(idCardPlacement(100, 2000, fullIdCrop(), 'A4').heightMm - 4.5) < 1e-8)
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
for (const angle of [-89, 89]) {
  const crop = rotatedCrop(300, 400, 180, 112, angle, 600, 800)
  const side = initialIdSide('front', 600, 800, crop)
  assert.equal(side.turns, 3, 'Sideways phone photographs rotate into the editor before cropping')
  assert.ok(Math.abs(idCardAngle(800, 600, side.crop)) < 2)
  assert.ok(Math.abs(idCardPlacement(800, 600, side.crop, 'A4').heightMm - 56) < 0.01)
}
assert.equal(initialIdSide('front', 720, 1280, fullIdCrop()).turns, 3)
assert.equal(initialIdSide('front', 1200, 900, diagonal).turns, 0)

for (const paper of ['A4', 'A3'] as const)
  for (const landscape of [false, true]) {
    const capacity = idCopiesLayout(paper, landscape, [50, 59], 1).capacity
    for (let count = 1; count <= capacity; count++) {
      const layout = idCopiesLayout(paper, landscape, [50, 59], count)
      assert.equal(layout.centers.length, count)
      const back = idCopyCenters(layout, true)
      layout.centers.forEach((center, index) => {
        assert.ok(center.x - 45 >= 5 - 1e-9 && center.x + 45 <= layout.paperWidth - 5 + 1e-9)
        assert.ok(
          center.y - 59 / 2 >= 5 - 1e-9 && center.y + 59 / 2 <= layout.paperHeight - 5 + 1e-9
        )
        assert.ok(
          Math.abs((landscape ? back[index].x : layout.paperWidth - back[index].x) - center.x) <
            1e-9
        )
        assert.ok(
          Math.abs((landscape ? layout.paperHeight - back[index].y : back[index].y) - center.y) <
            1e-9
        )
        for (const other of layout.centers.slice(index + 1))
          assert.ok(
            Math.abs(center.x - other.x) >= 95 - 1e-9 || Math.abs(center.y - other.y) >= 64 - 1e-9,
            'Copies must keep a 5 mm cutting gap'
          )
      })
    }
    assert.throws(() => idCopiesLayout(paper, landscape, [50, 59], capacity + 1), /fit|between/)
  }
assert.equal(idCopiesLayout('A4', false, [50, 59], 8).centers.length, 8)
assert.throws(() => idCopiesLayout('A4', false, [50, 59], 9), /do not fit/)
assert.equal(idCopiesLayout('A4', true, [50, 59], 9).centers.length, 9)
assert.equal(idCopiesLayout('A3', false, [50, 59], 18).centers.length, 18)
for (const count of [0, -1, 1.5, 25, NaN])
  assert.throws(() => idCopiesLayout('A4', false, [59], count), /between/)
assert.deepEqual(idCopiesLayout('A4', false, [50, 59], 1).centers, [{ x: 105, y: 148.5 }])

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

for (const scene of ['patterned', 'pale'])
  for (const angle of [-45, 0, 45, 90]) {
    const photo = cardPhoto(120, 90, 90, 55, angle)
    for (let y = 0; y < photo.height; y++)
      for (let x = 0; x < photo.width; x++) {
        const offset = (y * photo.width + x) * 4,
          isCard = photo.data[offset] === 245
        if (scene === 'pale')
          photo.data.set(isCard ? [226, 210, 204, 255] : [234, 227, 222, 255], offset)
        else if (!isCard)
          photo.data.set(
            (x + y * 0.35) % 20 < 2 || y % 23 < 2 ? [180, 200, 215, 255] : [45, 65, 90, 255],
            offset
          )
      }
    const crop = detectIdCrop(photo.data, photo.width, photo.height)
    assert.notDeepEqual(crop, fullIdCrop(), `${scene}: find card at ${angle}°`)
    const placement = idCardPlacement(photo.width, photo.height, crop, 'A4')
    assert.ok(
      Math.abs(placement.heightMm - 55) < 5,
      `${scene}: preserve the whole card, not a text block or table pattern`
    )
    assert.ok(Math.abs(crop.reduce((sum, p) => sum + p.x, 0) / 4 - 0.5) < 0.025)
    assert.ok(Math.abs(crop.reduce((sum, p) => sum + p.y, 0) / 4 - 0.5) < 0.025)
  }

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

// Numbers read in both directions and must not determine which way is up.
const emblem = new Uint8ClampedArray(200 * 120 * 4).fill(255)
for (let y = 10; y < 35; y++)
  for (let x = 10; x < 50; x++) {
    const i = (y * 200 + x) * 4
    if (Math.hypot((x - 30) / 1.5, y - 22) < 6) continue
    emblem[i] = 190
    emblem[i + 1] = 25
    emblem[i + 2] = 40
  }
assert.equal(idHeaderOrientation(emblem, 200, 120), 0)
const inverted = new Uint8ClampedArray(emblem.length)
for (let i = 0; i < 200 * 120; i++)
  inverted.set(emblem.subarray(i * 4, i * 4 + 4), (200 * 120 - 1 - i) * 4)
assert.equal(idHeaderOrientation(inverted, 200, 120), 2)
assert.equal(idHeaderOrientation(new Uint8ClampedArray(200 * 120 * 4).fill(255), 200, 120), null)
assert.deepEqual(scoreIdText([{ text: '1234567890', confidence: 99 }]), { score: 0, letters: 0 })
assert.equal(chooseIdTextOrientation({ score: 10, letters: 30 }, { score: 3, letters: 18 }), 0)
assert.equal(chooseIdTextOrientation({ score: 2, letters: 8 }, { score: 12, letters: 40 }), 2)
assert.equal(chooseIdTextOrientation({ score: 8, letters: 24 }, { score: 7, letters: 23 }), null)
const originalSide = { sourceId: 'test', turns: 0, crop: photo }
const twice = rotateIdSide(originalSide, 2)
assert.equal(twice.turns, 2)
assert.ok(
  Math.abs(
    idCardPlacement(1200, 900, twice.crop, 'A4').heightMm -
      idCardPlacement(1200, 900, photo, 'A4').heightMm
  ) < 1e-8
)
const restored = rotateIdSide(twice, 2)
assert.equal(restored.turns, 0)
for (let i = 0; i < 4; i++)
  assert.ok(Math.hypot(restored.crop[i].x - photo[i].x, restored.crop[i].y - photo[i].y) < 1e-12)
console.log('ID header, text confidence, 180-degree and proportional-size checks passed.')

// Front/back output must remain landscape even for old portrait drafts or manual angles.
for (const paper of ['A4', 'A3'] as const)
  for (const landscape of [false, true])
    for (const angle of [undefined, 0, 90, -90, 180]) {
      const placement = idCardPlacement(900, 560, fullIdCrop(), paper, landscape, angle)
      assert.equal(placement.widthMm, 90)
      assert.ok(Math.abs(placement.heightMm - 56) < 1e-8)
    }
for (const turns of [1, 2, 3] as const) {
  const legacy = rotateIdSide({ sourceId: 'legacy', turns: 0, crop: fullIdCrop() }, turns)
  const normalized = horizontalIdSide(900, 560, legacy)
  const [width, height] = normalized.turns % 2 ? [560, 900] : [900, 560]
  assert.ok(Math.abs(idCardAngle(width, height, normalized.crop)) < 1e-8)
  assert.ok(width > height, 'Review artwork must remain horizontal')
  assert.ok(
    Math.abs(
      idCardPlacement(width, height, normalized.crop, 'A4', false, normalized.angleDegrees)
        .heightMm - 56
    ) < 1e-8
  )
}
console.log('Horizontal ID output, manual angles and legacy quarter-turn reviews passed.')

const reviewed = {
  sourceId: 'review',
  turns: 0,
  crop: photo,
  angleDegrees: 1.7,
  orientationVerified: true
}
assert.deepEqual(
  horizontalIdSide(1200, 900, reviewed),
  reviewed,
  'Horizontal reviews must preserve exact manual angles and corners'
)

assert.deepEqual(validateIdSheetSettings(DEFAULT_ID_SHEET_SETTINGS), DEFAULT_ID_SHEET_SETTINGS)
for (const value of [
  { ...DEFAULT_ID_SHEET_SETTINGS, marginMm: 0 },
  { ...DEFAULT_ID_SHEET_SETTINGS, heightMm: 500 },
  { ...DEFAULT_ID_SHEET_SETTINGS, gapMm: 0 },
  { ...DEFAULT_ID_SHEET_SETTINGS, spacing: 'random' }
])
  assert.throws(() => validateIdSheetSettings(value), /sheet settings/)
for (const paper of ['A4', 'A3'] as const)
  for (const landscape of [false, true])
    for (const height of [55, 56, 60])
      for (const front of [0, 1, 2, 3])
        for (const back of [0, 1, 2, 3])
          for (const spacing of ['even', 'compact'] as const) {
            const sizes = [idPrintedSize(height, front), idPrintedSize(height, back)],
              width = Math.max(...sizes.map((s) => s.widthMm)),
              cellHeight = Math.max(...sizes.map((s) => s.heightMm)),
              options = { cellWidthMm: width, marginMm: 7, gapMm: 5, spacing }
            const capacity = idCopiesLayout(paper, landscape, [cellHeight], 1, options).capacity
            for (const count of [1, Math.min(4, capacity), capacity]) {
              const layout = idCopiesLayout(paper, landscape, [cellHeight], count, options),
                backs = idCopyCenters(layout, true)
              layout.centers.forEach((p, i) => {
                assert.ok(
                  p.x - width / 2 >= 7 - 1e-8 && p.x + width / 2 <= layout.paperWidth - 7 + 1e-8
                )
                assert.ok(
                  p.y - cellHeight / 2 >= 7 - 1e-8 &&
                    p.y + cellHeight / 2 <= layout.paperHeight - 7 + 1e-8
                )
                assert.ok(
                  Math.abs((landscape ? backs[i].x : layout.paperWidth - backs[i].x) - p.x) < 1e-8
                )
                assert.ok(
                  Math.abs((landscape ? layout.paperHeight - backs[i].y : backs[i].y) - p.y) < 1e-8
                )
                for (const other of layout.centers.slice(i + 1))
                  assert.ok(
                    Math.abs(other.x - p.x) >= width + 5 - 1e-8 ||
                      Math.abs(other.y - p.y) >= cellHeight + 5 - 1e-8
                  )
              })
            }
          }
const spread = idCopiesLayout('A4', false, [56], 4, { spacing: 'even' })
assert.equal(spread.centers[0].x - 45, 5)
assert.equal(spread.centers[1].x + 45, 205)
assert.equal(spread.centers[0].y - 28, 5)
assert.equal(spread.centers[2].y + 28, 292)
const skewed: IdCrop = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.9, y: 0.8 },
  { x: 0.1, y: 0.8 }
]
const project = idCardProjection(skewed)
for (const [i, [u, v]] of [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1]
].entries()) {
  const den = project[6] * u + project[7] * v + 1
  assert.ok(Math.abs((project[0] * u + project[1] * v + project[2]) / den - skewed[i].x) < 1e-9)
  assert.ok(Math.abs((project[3] * u + project[4] * v + project[5]) / den - skewed[i].y) < 1e-9)
}
const gradient = new Uint8ClampedArray(100 * 100 * 4)
for (let y = 0; y < 100; y++)
  for (let x = 0; x < 100; x++) {
    const index = (y * 100 + x) * 4
    gradient[index] = ((x + 0.5) * 255) / 100
    gradient[index + 1] = ((y + 0.5) * 255) / 100
    gradient[index + 3] = 255
  }
const affine: IdCrop = [
    { x: 0.1, y: 0.2 },
    { x: 0.8, y: 0.1 },
    { x: 0.9, y: 0.8 },
    { x: 0.2, y: 0.9 }
  ],
  proof = rectifyIdPixels(gradient, 100, 100, affine, 40, 24)
for (let y = 0; y < 24; y++)
  for (let x = 0; x < 40; x++) {
    const u = (x + 0.5) / 40,
      v = (y + 0.5) / 24,
      index = (y * 40 + x) * 4
    assert.ok(Math.abs(proof[index] - (0.1 + 0.7 * u + 0.1 * v) * 255) < 1.1)
    assert.ok(Math.abs(proof[index + 1] - (0.2 - 0.1 * u + 0.7 * v) * 255) < 1.1)
    assert.equal(proof[index + 3], 255)
  }
console.log(
  'Matched ID presets, even margins, independent rotations, duplex centers and perspective resampling passed.'
)
