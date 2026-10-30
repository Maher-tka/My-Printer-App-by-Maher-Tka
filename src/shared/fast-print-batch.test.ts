import assert from 'node:assert/strict'
import {
  normalizeFastPrintSelection,
  fastPrintGroupEnd,
  parseFastPrintSelectionManifest,
  countBatchSheets,
  needsBatchBlankBack
} from './fast-print-batch.js'

const paths = [
  'C:\\Jobs\\b & العربية.PDF',
  'C:\\Jobs\\a.png',
  'C:\\Jobs\\B & العربية.pdf',
  'C:/Jobs/a.png',
  'C:\\Jobs\\last.jpeg'
]
assert.deepEqual(
  normalizeFastPrintSelection(paths),
  [paths[0], paths[1], paths[4]],
  'Preserve selection order and print duplicate paths only once'
)
assert.deepEqual(parseFastPrintSelectionManifest(JSON.stringify({ version: 1, files: paths })), [
  paths[0],
  paths[1],
  paths[4]
])
assert.equal(countBatchSheets([5, 1, 3], 2), 6, 'Each document starts on a fresh sheet')
assert.deepEqual(
  normalizeFastPrintSelection(['C:\\Jobs\\id.GIF', 'C:/Jobs/id.gif']),
  ['C:\\Jobs\\id.GIF'],
  'Accept GIF ID pictures and deduplicate paths'
)
assert.equal(countBatchSheets([1, 1, 1], 4), 3, 'Separate images are separate documents')
const mixed = ['.png', '.jpg', '.gif', '.pdf', '.png']
assert.equal(fastPrintGroupEnd(mixed, 0, false, true), 2)
assert.equal(fastPrintGroupEnd(mixed, 3, false, true), 3)
assert.equal(fastPrintGroupEnd(mixed, 4, false, true), 4)
assert.equal(fastPrintGroupEnd(mixed, 0, true, true), 4)
assert.equal(fastPrintGroupEnd(mixed, 0, false, false), 0)
assert.throws(() => normalizeFastPrintSelection([]), /Select/)
assert.throws(
  () => normalizeFastPrintSelection(['C:\\Jobs\\good.pdf', 'C:\\Jobs\\script.bat']),
  /Unsupported document/
)
assert.throws(() => normalizeFastPrintSelection([null]), /invalid/)
assert.throws(() => normalizeFastPrintSelection(Array(1001).fill('C:\\Jobs\\file.pdf')), /1000/)
assert.throws(() => parseFastPrintSelectionManifest('{'), /could not be read/)
assert.throws(() => parseFastPrintSelectionManifest('{"version":2,"files":[]}'), /Unsupported/)
console.log('Fast Print batch selection and sheet-boundary tests passed.')
assert.equal(
  needsBatchBlankBack(3, 0, 2, true),
  true,
  'Odd duplex document needs a blank back before the next document'
)
assert.equal(
  needsBatchBlankBack(2, 0, 2, true),
  false,
  'Even duplex document ends at a physical sheet boundary'
)
assert.equal(
  needsBatchBlankBack(3, 1, 2, true),
  false,
  'Final document does not need explicit padding'
)
assert.equal(needsBatchBlankBack(3, 0, 2, false), false, 'Simplex jobs never add blank backs')
