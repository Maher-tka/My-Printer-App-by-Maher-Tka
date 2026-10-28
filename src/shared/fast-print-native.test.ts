import assert from 'node:assert/strict'
import { join } from 'node:path'
import { nativePrintSession, parseNativePrintRequest } from './fast-print-native.js'

const temp = process.cwd()
const directory = join(temp, 'maher-fast-print-native', 'a'.repeat(32))
assert.equal(nativePrintSession(join(directory, 'request.json'), temp), directory)
for (const file of [
  'request.json',
  join(directory, '../request.json'),
  join(directory, 'other.json'),
  join(directory, 'child/request.json')
])
  assert.throws(() => nativePrintSession(file, temp), /Invalid native/)
const request = {
  version: 1,
  files: ['C:\\test\\PDF with & spaces.pdf'],
  copies: 3,
  preset: {
    printer: 'PDF',
    paper: 'A4',
    color: true,
    pagesPerSheet: 4,
    profileId: 'a'.repeat(32),
    fitToFrame: true
  }
}
assert.equal(parseNativePrintRequest(JSON.stringify(request)).preset.fitToFrame, true)
assert.equal(parseNativePrintRequest(JSON.stringify(request)).copies, 3)
const rotated = {
  ...request,
  preset: {
    ...request.preset,
    sourceRotations: [2],
    pageRotations: [{ file: 0, page: 1, turns: 1 }]
  }
}
assert.deepEqual(parseNativePrintRequest(JSON.stringify(rotated)).preset.pageRotations, [
  { file: 0, page: 1, turns: 1 }
])
for (const pageRotations of [
  null,
  [null],
  [{ file: 1, page: 0, turns: 1 }],
  [{ file: 0, page: -1, turns: 1 }],
  [{ file: 0, page: 0, turns: 4 }],
  [{ file: 0, page: 0.5, turns: 1 }],
  [{ file: 0, page: 0, turns: '1' }],
  [
    { file: 0, page: 1, turns: 1 },
    { file: 0, page: 1, turns: 2 }
  ],
  Array.from({ length: 2001 }, (_, page) => ({ file: 0, page, turns: 1 }))
])
  assert.throws(() =>
    parseNativePrintRequest(
      JSON.stringify({ ...request, preset: { ...request.preset, pageRotations } })
    )
  )
const selected = { ...request, preset: { ...request.preset, sourcePages: [[0, 2, 4]] } }
const imageJob = {
  ...request,
  files: ['a.png', 'b.jpg'],
  preset: { ...request.preset, sourceCopies: [9, 1] }
}
assert.deepEqual(parseNativePrintRequest(JSON.stringify(imageJob)).preset.sourceCopies, [9, 1])
for (const sourceCopies of [[], [9], [0, 1], [1000, 1], [1.5, 1], ['9', 1]])
  assert.throws(() =>
    parseNativePrintRequest(
      JSON.stringify({ ...imageJob, preset: { ...imageJob.preset, sourceCopies } })
    )
  )
assert.throws(
  () =>
    parseNativePrintRequest(
      JSON.stringify({ ...request, preset: { ...request.preset, sourceCopies: [9] } })
    ),
  /Image quantities/
)
assert.throws(() =>
  parseNativePrintRequest(
    JSON.stringify({
      ...imageJob,
      preset: { ...imageJob.preset, mode: 'polaroid-9', pagesPerSheet: 1 }
    })
  )
)
assert.deepEqual(parseNativePrintRequest(JSON.stringify(selected)).preset.sourcePages, [[0, 2, 4]])
for (const sourcePages of [
  null,
  [],
  [[]],
  [[-1]],
  [[0.5]],
  [[2, 1]],
  [[0, 0]],
  [['1']],
  [[0], [1]],
  [Array.from({ length: 2001 }, (_, i) => i)]
])
  assert.throws(() =>
    parseNativePrintRequest(
      JSON.stringify({ ...request, preset: { ...request.preset, sourcePages } })
    )
  )
assert.deepEqual(
  parseNativePrintRequest(
    JSON.stringify({
      ...request,
      files: ['a.pdf', 'b.pdf'],
      preset: { ...request.preset, sourcePages: [[0], []] }
    })
  ).preset.sourcePages,
  [[0], []]
)
const polaroid = {
  ...request,
  preset: { ...request.preset, pagesPerSheet: 1, mode: 'polaroid-8' }
}
for (const mode of ['id-card', 'polaroid-8', 'polaroid-9'])
  assert.throws(() =>
    parseNativePrintRequest(
      JSON.stringify({ ...selected, preset: { ...selected.preset, pagesPerSheet: 1, mode } })
    )
  )
assert.equal(
  parseNativePrintRequest(JSON.stringify({ ...polaroid, preparedPolaroid: true })).preparedPolaroid,
  true
)
for (const invalid of [
  { ...request, preparedPolaroid: true },
  { ...polaroid, preparedPolaroid: 'true' }
])
  assert.throws(() => parseNativePrintRequest(JSON.stringify(invalid)), /Invalid prepared/)
for (const pagesPerSheet of [1, 2, 4, 5, 6, 7, 8, 9, 12, 16]) {
  const parsed = parseNativePrintRequest(
    JSON.stringify({
      ...request,
      preset: { ...request.preset, pagesPerSheet, combineImages: true }
    })
  )
  assert.equal(parsed.preset.pagesPerSheet, pagesPerSheet)
  assert.equal(parsed.preset.combineImages, true)
}
for (const copies of [0, 1000, 1.5, '3', null])
  assert.throws(
    () => parseNativePrintRequest(JSON.stringify({ ...request, copies })),
    /Invalid native/
  )
for (const preset of [
  { ...request.preset, profileId: undefined },
  { ...request.preset, fitToFrame: 'true' },
  { ...request.preset, combineImages: 'true' },
  { ...request.preset, pagesPerSheet: 3 },
  { ...request.preset, mode: 'document', pagesPerSheet: 1 }
])
  assert.throws(() => parseNativePrintRequest(JSON.stringify({ ...request, preset })))
assert.throws(
  () =>
    parseNativePrintRequest(JSON.stringify({ ...request, files: ['C:\\test\\unconverted.docx'] })),
  /Unsupported/
)
console.log('Native print request, copies, fit-to-frame and cleanup-directory validation passed.')
