import { strict as assert } from 'node:assert'
import {
  geometryOrReviewWarning,
  makeOffsetPath,
  paintStickerMaskStroke,
  traceMask
} from './stickerMaker'

const mask = new Uint8Array(100)
for (let y = 3; y < 7; y += 1) {
  for (let x = 3; x < 7; x += 1) mask[y * 10 + x] = 255
}

const traced = traceMask(mask, 10, 10, 128)
assert.equal(traced.length, 1)
assert.ok(traced[0].length >= 4)

const atZero = makeOffsetPath(mask, 10, 10, {
  offsetMm: 0,
  threshold: 128,
  smoothing: 1,
  widthMm: 10
})
const expanded = makeOffsetPath(mask, 10, 10, {
  offsetMm: 2,
  threshold: 128,
  smoothing: 1,
  widthMm: 10
})
assert.match(atZero.pathData, /Z$/)
assert.match(expanded.pathData, /Z$/)
assert.notEqual(atZero.pathData, expanded.pathData)
assert.ok(!/NaN|Infinity/.test(expanded.pathData))
const expandedX = [...expanded.pathData.matchAll(/[ML] ([0-9.]+) ([0-9.]+)/g)].map((match) =>
  Number(match[1])
)
assert.ok(Math.abs(Math.min(...expandedX) - 3 / 14) < 0.01, '2 mm offset grows left by 2 mm')

const withHole = mask.slice()
for (let y = 4; y < 6; y += 1) {
  for (let x = 4; x < 6; x += 1) withHole[y * 10 + x] = 0
}
const holeContour = makeOffsetPath(withHole, 10, 10, {
  offsetMm: 0,
  threshold: 128,
  smoothing: 1,
  widthMm: 10
})
assert.equal((holeContour.pathData.match(/ Z/g) ?? []).length, 1, 'internal holes do not cut')
assert.deepEqual(holeContour.warnings, [], 'internal holes are not separate stickers')

const twoObjects = new Uint8Array(100)
for (let y = 1; y < 5; y += 1) {
  for (let x = 1; x < 5; x += 1) twoObjects[y * 10 + x] = 255
  for (let x = 6; x < 10; x += 1) twoObjects[y * 10 + x] = 255
}
const separate = makeOffsetPath(twoObjects, 10, 10, {
  offsetMm: 0,
  threshold: 128,
  smoothing: 1,
  widthMm: 10
})
assert.equal((separate.pathData.match(/ Z/g) ?? []).length, 2)
assert.equal(separate.warnings.length, 1)

const circle = new Uint8Array(100 * 100)
for (let y = 0; y < 100; y += 1) {
  for (let x = 0; x < 100; x += 1) {
    if ((x - 50) ** 2 + (y - 50) ** 2 <= 35 ** 2) circle[y * 100 + x] = 255
  }
}
const smoothCircle = makeOffsetPath(circle, 100, 100, {
  offsetMm: 2,
  threshold: 128,
  smoothing: 1,
  widthMm: 80
})
assert.ok((smoothCircle.pathData.match(/ L/g) ?? []).length < 200, 'cutter path stays compact')

const editable = new Uint8Array(100).fill(255)
paintStickerMaskStroke(editable, 10, 10, { x: 5, y: 5 }, { x: 5, y: 5 }, 4, 1, 'erase')
assert.equal(editable[5 * 10 + 5], 0)
assert.equal(editable[0], 255, 'brush leaves distant pixels unchanged')
paintStickerMaskStroke(editable, 10, 10, { x: 5, y: 5 }, { x: 5, y: 5 }, 4, 1, 'restore')
assert.equal(editable[5 * 10 + 5], 255)

const empty = geometryOrReviewWarning(new Uint8Array(100), 10, 10, {
  offsetMm: 2,
  threshold: 128,
  smoothing: 1,
  widthMm: 80
})
assert.equal(empty.pathData, '')
assert.match(empty.warnings[0], /Restore brush/)
