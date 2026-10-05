import assert from 'node:assert/strict'
import {
  createPrintDialogResult,
  getPrintPdfFileRequestError,
  getPrintPdfRequestError,
  isPdfByteSource,
  normalizePdfPrintName
} from './print-types.js'

const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
const invalidBytes = new Uint8Array([0x50, 0x4e, 0x47, 0x0d, 0x0a])

assert.equal(isPdfByteSource(validPdfBytes), true, 'PDF signature is accepted')
assert.equal(isPdfByteSource(invalidBytes), false, 'non-PDF bytes are rejected')
assert.equal(
  getPrintPdfRequestError({
    bytes: validPdfBytes,
    suggestedName: 'booklet-montage.pdf'
  }),
  null,
  'valid print request passes validation'
)
assert.match(
  getPrintPdfRequestError({
    bytes: invalidBytes,
    suggestedName: 'booklet-montage.pdf'
  }) ?? '',
  /valid PDF/i,
  'invalid print bytes return a clear validation error'
)
assert.equal(
  getPrintPdfFileRequestError({ filePath: 'C:\\Exports\\cover.pdf' }),
  null,
  'PDF export file paths are printable'
)
assert.match(
  getPrintPdfFileRequestError({ filePath: 'C:\\Exports\\cut-contour.eps' }) ?? '',
  /Only exported PDF/i,
  'non-PDF export files are blocked'
)
assert.equal(normalizePdfPrintName('cover-sheet'), 'cover-sheet.pdf', 'PDF extension is added')
for (const copies of [1, 3, 999]) {
  assert.equal(
    getPrintPdfRequestError({ bytes: validPdfBytes, suggestedName: 'cards.pdf', copies }),
    null
  )
  assert.equal(getPrintPdfFileRequestError({ filePath: 'C:\\Exports\\cards.pdf', copies }), null)
}
for (const copies of [0, -1, 1.5, 1000, NaN, Infinity]) {
  assert.match(
    getPrintPdfRequestError({ bytes: validPdfBytes, suggestedName: 'cards.pdf', copies }) ?? '',
    /copies/
  )
  assert.match(
    getPrintPdfFileRequestError({ filePath: 'C:\\Exports\\cards.pdf', copies }) ?? '',
    /copies/
  )
}
assert.deepEqual(
  createPrintDialogResult(false, 'cancelled'),
  { ok: false, canceled: true, error: 'Print canceled.' },
  'canceled driver dialog result is reported as canceled'
)

console.log('Print API contract tests passed.')
