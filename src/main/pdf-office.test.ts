import assert from 'node:assert/strict'
import {
  convertOfficePdf,
  getOfficePdfCapabilities,
  validateOfficePdfRequest
} from './pdf-office.js'

const bytes = new Uint8Array([1, 2, 3])
assert.equal(validateOfficePdfRequest({ kind: 'word', fileName: 'résumé.DOCX', bytes }), 'docx')
assert.throws(
  () => validateOfficePdfRequest({ kind: 'word', fileName: 'run.ps1', bytes }),
  /extension/
)
assert.throws(
  () => validateOfficePdfRequest({ kind: 'excel', fileName: 'file.docx', bytes }),
  /extension/
)
assert.throws(
  () => validateOfficePdfRequest({ kind: 'word', fileName: 'empty.docx', bytes: new Uint8Array() }),
  /memory limit/
)
assert.throws(
  () => validateOfficePdfRequest({ kind: 'bad' as 'word', fileName: 'file.docx', bytes }),
  /Unsupported/
)
const capabilities = await getOfficePdfCapabilities()
assert.equal(typeof capabilities.word, 'boolean')
assert.equal(typeof capabilities.powerpoint, 'boolean')
assert.equal(typeof capabilities.excel, 'boolean')
const invalid = await convertOfficePdf({ kind: 'word', fileName: 'file.exe', bytes })
assert.equal(invalid.ok, false)
if (!capabilities.word && !capabilities.libreOffice) {
  const unavailable = await convertOfficePdf({ kind: 'word', fileName: 'file.docx', bytes })
  assert.equal(unavailable.ok, false)
  if (!unavailable.ok) assert.match(unavailable.error, /Install Microsoft Office or LibreOffice/)
}
console.log('Office conversion request validation and capability detection passed.', capabilities)
