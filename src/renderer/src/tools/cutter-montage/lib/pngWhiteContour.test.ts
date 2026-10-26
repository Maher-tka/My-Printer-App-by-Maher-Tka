import { strict as assert } from 'node:assert'
import {
  DEFAULT_PNG_WHITE_CONTOUR,
  makePngWhiteContourGeometry,
  validatePngWhiteContourSettings
} from './pngWhiteContour'
import { getPathBounds } from './pathBounds'

const settings = { ...DEFAULT_PNG_WHITE_CONTOUR, widthMm: 100 }
const mask = new Uint8Array(100 * 80)
for (let y = 10; y < 70; y++) for (let x = 10; x < 90; x++) mask[y * 100 + x] = 255
const geometry = makePngWhiteContourGeometry(mask, 100, 80, 80, 4, settings)
const white = getPathBounds(geometry.whitePath)!
const cut = getPathBounds(geometry.cutPath)!
assert.ok(Math.abs((cut.x - white.x) * 108 - settings.insetMm) < 0.001)
assert.ok(Math.abs((cut.y - white.y) * 88 - settings.insetMm) < 0.001)
assert.ok(Math.abs((white.width - cut.width) * 108 - settings.insetMm * 2) < 0.001)
assert.ok(Math.abs((white.height - cut.height) * 88 - settings.insetMm * 2) < 0.001)
assert.ok(
  Math.abs(cut.width * 108 - 84) < 0.001,
  'cut stays 2 mm outside the original artwork on each side'
)
assert.equal(geometry.regions, 1)
const smallDetail = mask.slice()
smallDetail[0] = 255
assert.equal(
  makePngWhiteContourGeometry(smallDetail, 100, 80, 80, 4, settings).regions,
  2,
  'small disconnected visible details also receive a border and cut contour'
)

// Interior holes never become unwanted cutting paths.
const donut = mask.slice()
for (let y = 25; y < 55; y++) for (let x = 25; x < 75; x++) donut[y * 100 + x] = 0
assert.equal(
  (makePngWhiteContourGeometry(donut, 100, 80, 80, 4, settings).cutPath.match(/ Z/g) ?? []).length,
  1
)
const separate = new Uint8Array(100 * 80)
for (let y = 10; y < 30; y++)
  for (const start of [10, 70]) for (let x = start; x < start + 20; x++) separate[y * 100 + x] = 255
assert.equal(makePngWhiteContourGeometry(separate, 100, 80, 80, 4, settings).regions, 2)
assert.equal(
  (makePngWhiteContourGeometry(separate, 100, 80, 80, 4, settings).cutPath.match(/ Z/g) ?? [])
    .length,
  2
)
assert.throws(
  () => makePngWhiteContourGeometry(new Uint8Array(100), 10, 10, 80, 4, settings),
  /no usable/
)
for (const patch of [
  { insetMm: 0 },
  { insetMm: 3 },
  { borderMm: 0 },
  { insetMm: NaN },
  { widthMm: Infinity },
  { widthMm: 0 }
])
  assert.throws(() => validatePngWhiteContourSettings({ ...settings, ...patch }))
assert.throws(() => makePngWhiteContourGeometry(mask, 100, 80, 80, 1, settings), /dimensions/)
console.log('PNG white contour geometry and safety margins passed')
