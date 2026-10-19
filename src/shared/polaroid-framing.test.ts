import assert from 'node:assert/strict'
import {
  choosePhotoOrientation,
  choosePhotoPrintLayout,
  framePhoto,
  type PhotoFace
} from './polaroid-framing.js'

const face = (x: number, y = 0.2, confidence = 0.95): PhotoFace => ({
  x,
  y,
  width: 0.12,
  height: 0.15,
  confidence
})
const portrait = framePhoto(1000, 1600, 800, 1000, [face(0.45, 0.01)])
assert.equal(portrait.fit, 'cover')
assert.equal(portrait.crop.y, 0, 'Top-edge faces shift the crop up rather than losing foreheads')
const side = face(0.82)
const shifted = framePhoto(1600, 1000, 800, 1000, [side])
assert.equal(shifted.fit, 'cover')
assert.ok(shifted.crop.x > 0.4, 'Off-center faces move the crop toward the subject')
assert.ok(shifted.crop.x + shifted.crop.width >= side.x + side.width)
const group = framePhoto(1600, 1000, 800, 1000, [face(0.01), face(0.85)])
assert.equal(
  group.fit,
  'contain',
  'Widely separated faces cannot fit a portrait crop: preserve the full group'
)
assert.deepEqual(group.crop, { x: 0, y: 0, width: 1, height: 1 })
assert.equal(
  framePhoto(1600, 1000, 800, 1000, []).fit,
  'contain',
  'No-face artwork must not lose unknown important content'
)
assert.equal(framePhoto(1600, 1000, 800, 1000, [{ ...face(0.1), x: Number.NaN }]).fit, 'contain')
assert.equal(
  choosePhotoOrientation([
    { turns: 0, faces: [] },
    { turns: 1, faces: [face(0.2), face(0.5)] }
  ]).turns,
  1
)
assert.equal(
  choosePhotoOrientation([
    { turns: 0, faces: [face(0.2)] },
    { turns: 3, faces: [face(0.2, 0.2, 0.98)] }
  ]).turns,
  0,
  'Small confidence differences must not rotate an upright image'
)
assert.equal(
  choosePhotoOrientation([
    { turns: 0, faces: [] },
    { turns: 1, faces: [face(0.2, 0.2, 0.7)] }
  ]).turns,
  0,
  'Weak detections do not justify rotation'
)
assert.equal(
  choosePhotoOrientation([
    { turns: 0, faces: [] },
    { turns: 2, faces: [] }
  ]).turns,
  0
)
for (const width of [800, 1000, 1600])
  for (const height of [800, 1000, 1600]) {
    const faces = [face(0.1, 0.02), face(0.7, 0.6)]
    const framed = framePhoto(width, height, 800, 1000, faces)
    for (const f of faces) {
      const crop = framed.crop
      assert.ok(f.x >= crop.x - 1e-9 && f.y >= crop.y - 1e-9)
      assert.ok(
        f.x + f.width <= crop.x + crop.width + 1e-9 && f.y + f.height <= crop.y + crop.height + 1e-9
      )
    }
  }
console.log(
  'Polaroid face protection, group fit, safe fallback and rotation confidence tests passed.'
)

const wideGroup = [face(0.01), face(0.85)]
const sideways = choosePhotoPrintLayout(1600, 1000, 800, 1000, wideGroup)
assert.equal(sideways.turns, 1, 'Wide groups turn 90 degrees when that fills more of the frame')
assert.equal(
  sideways.fit,
  'contain',
  'Use the complete photo if even the rotated group cannot be cropped safely'
)
assert.equal(
  choosePhotoPrintLayout(1600, 1000, 800, 1000, [face(0.2), face(0.65)]).fit,
  'cover',
  'A rotated group can fill the frame when all protected faces fit'
)
assert.equal(
  choosePhotoPrintLayout(1000, 1600, 800, 1000, [face(0.3), face(0.5)]).turns,
  0,
  'A well-filled portrait stays in its existing print orientation'
)
assert.equal(
  choosePhotoPrintLayout(1600, 1000, 800, 1000, []).turns,
  0,
  'Analysis failures and no-face sources do not receive speculative layout rotation'
)
assert.equal(
  choosePhotoPrintLayout(1600, 1000, 800, 1000, [face(0.4)]).turns,
  0,
  'Single-subject portraits retain the upright orientation'
)
const fittedGroup = choosePhotoPrintLayout(1600, 1000, 800, 1000, [face(0.2), face(0.65)])
assert.equal(fittedGroup.turns, 1)
for (const f of fittedGroup.faces) {
  const crop = fittedGroup.crop
  assert.ok(f.x >= crop.x && f.y >= crop.y)
  assert.ok(f.x + f.width <= crop.x + crop.width && f.y + f.height <= crop.y + crop.height)
}
const nearTop = [face(0.2, 0.01), face(0.65, 0.01)]
const rotatedHeadroom = choosePhotoPrintLayout(1600, 1000, 800, 1000, nearTop)
assert.equal(rotatedHeadroom.turns, 1)
assert.ok(
  rotatedHeadroom.crop.x + rotatedHeadroom.crop.width >= 1,
  'Forehead padding moves to the right edge after clockwise rotation'
)
console.log('Polaroid print-area rotation and rotated face/headroom protection tests passed.')
