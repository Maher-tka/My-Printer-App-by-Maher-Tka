import { strict as assert } from 'node:assert'
import { preparePngContourHandoff } from './pngContourHandoff'

const source = new File([new Uint8Array([1, 2, 3])], 'sticker.png', { type: 'image/png' })
const cropped = new File([new Uint8Array([4, 5, 6])], 'cropped.png', { type: 'image/png' })
const edited = new Uint8Array([7, 8, 9])
const entries = [
  { id: 'original', file: source, widthMm: 45, quantity: 3 },
  { id: 'crop', file: source, preparedFile: cropped, widthMm: 65, quantity: 2 },
  {
    id: 'edit',
    file: source,
    preparedFile: cropped,
    result: { png: edited },
    widthMm: 52,
    quantity: 7
  }
]
const inputs = await preparePngContourHandoff(entries)
assert.deepEqual(
  inputs.map((input) => [input.sourceId, input.widthMm, input.quantity]),
  [
    ['original', 45, 3],
    ['crop', 65, 2],
    ['edit', 52, 7]
  ]
)
assert.deepEqual(new Uint8Array(await inputs[0].file.arrayBuffer()), new Uint8Array([1, 2, 3]))
assert.deepEqual(new Uint8Array(await inputs[1].file.arrayBuffer()), new Uint8Array([4, 5, 6]))
assert.deepEqual(
  new Uint8Array(await inputs[2].file.arrayBuffer()),
  edited,
  'current edited pixels take priority over the original and prepared crop'
)
assert.equal(inputs[0].artworkVersion, source)
assert.equal(
  inputs[2].artworkVersion,
  edited,
  'stable revision identity allows repeat opening without duplicate entries'
)
assert.deepEqual(await preparePngContourHandoff([]), [])
await assert.rejects(
  preparePngContourHandoff([{ ...entries[0], isSheet: true }]),
  /Separate sticker sheets/
)
await assert.rejects(
  preparePngContourHandoff(Array.from({ length: 101 }, () => entries[0])),
  /100 PNG/
)
assert.deepEqual(
  new Uint8Array(await source.arrayBuffer()),
  new Uint8Array([1, 2, 3]),
  'original files remain unchanged'
)
console.log(
  'PNG contour handoff preserves original/prepared/edited pixels, widths, copies and revision identity'
)
