import assert from 'node:assert/strict'
import {
  addSolidBackground,
  assertBackgroundDimensions,
  parseBackgroundColor,
  removeEdgeBackground
} from './artworkBackground'

// Black ring encloses white artwork: only the exterior white background is removed.
const input = new Uint8ClampedArray(5 * 5 * 4).fill(255)
for (let y = 1; y <= 3; y++)
  for (let x = 1; x <= 3; x++) {
    if (x === 2 && y === 2) continue
    const offset = (y * 5 + x) * 4
    input.set([0, 0, 0, 255], offset)
  }
const removed = await removeEdgeBackground(input, 5, 5, '#ffffff', 0)
for (let y = 0; y < 5; y++)
  for (let x = 0; x < 5; x++) {
    assert.equal(removed[(y * 5 + x) * 4 + 3], x === 0 || y === 0 || x === 4 || y === 4 ? 0 : 255)
  }
assert.equal(input[3], 255, 'Original pixels must remain available for undo')
assert.equal(removed.length, input.length, 'Pixel geometry must stay unchanged')

const nearWhite = new Uint8ClampedArray([250, 250, 250, 255, 0, 0, 0, 255])
assert.equal((await removeEdgeBackground(nearWhite, 2, 1, '#ffffff', 0))[3], 255)
assert.equal((await removeEdgeBackground(nearWhite, 2, 1, '#ffffff', 2))[3], 0)
assert.equal((await removeEdgeBackground(nearWhite, 2, 1, '#ffffff', 2))[7], 255)

const transparent = new Uint8ClampedArray([0, 0, 0, 0, 255, 0, 0, 128, 10, 20, 30, 255])
assert.deepEqual(
  [...addSolidBackground(transparent, '#ffffff')],
  [255, 255, 255, 255, 255, 127, 127, 255, 10, 20, 30, 255]
)
assert.equal(transparent[3], 0)
assert.deepEqual(parseBackgroundColor('#ABcdEF'), [171, 205, 239])
assert.throws(() => parseBackgroundColor('invalid'))
assert.throws(() => assertBackgroundDimensions(10000, 10000))
assert.throws(() => assertBackgroundDimensions(0, 2))
await assert.rejects(removeEdgeBackground(new Uint8ClampedArray(2), 1, 1, '#ffffff', 0))
await assert.rejects(removeEdgeBackground(input, 5, 5, '#ffffff', Number.NaN))
const canceled = new AbortController()
canceled.abort()
await assert.rejects(removeEdgeBackground(input, 5, 5, '#ffffff', 0, canceled.signal))
console.log('Artwork background tests passed')
