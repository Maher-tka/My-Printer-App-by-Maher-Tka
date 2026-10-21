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
const polaroid = {
  ...request,
  preset: { ...request.preset, pagesPerSheet: 1, mode: 'polaroid-8' }
}
assert.equal(
  parseNativePrintRequest(JSON.stringify({ ...polaroid, preparedPolaroid: true })).preparedPolaroid,
  true
)
for (const invalid of [
  { ...request, preparedPolaroid: true },
  { ...polaroid, preparedPolaroid: 'true' }
])
  assert.throws(() => parseNativePrintRequest(JSON.stringify(invalid)), /Invalid prepared/)
for (const pagesPerSheet of [1, 2, 4, 6, 8, 9, 12, 16]) {
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
  { ...request.preset, pagesPerSheet: 7 },
  { ...request.preset, mode: 'document', pagesPerSheet: 1 }
])
  assert.throws(() => parseNativePrintRequest(JSON.stringify({ ...request, preset })))
assert.throws(
  () =>
    parseNativePrintRequest(JSON.stringify({ ...request, files: ['C:\\test\\unconverted.docx'] })),
  /Unsupported/
)
console.log('Native print request, copies, fit-to-frame and cleanup-directory validation passed.')
