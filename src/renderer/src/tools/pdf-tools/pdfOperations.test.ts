import assert from 'node:assert/strict'
import { PDFDocument, degrees } from 'pdf-lib'
import { mergePdfs, splitPdf, optimizePdf, overlayPdf } from './pdfOperations'
import { DEFAULT_PDF_OPTIONS, PDF_TOOLS, parsePageGroups, validatePdfFiles } from './model'
import { pdfToolsMessages } from '@/i18n/pdfToolsMessages'

const first = await PDFDocument.create()
first.addPage([595, 842]).drawText('FIRST')
first.addPage([842, 595]).drawText('SECOND')
first.getPage(1).setRotation(degrees(90))
const second = await PDFDocument.create()
second.addPage([300, 400]).drawText('THIRD')
const bytes = await first.save(),
  other = await second.save()
const original = bytes.slice()
const merged = await PDFDocument.load(await mergePdfs([{ bytes: other }, { bytes }]))
assert.deepEqual(
  merged.getPages().map((page) => page.getSize()),
  [
    { width: 300, height: 400 },
    { width: 595, height: 842 },
    { width: 842, height: 595 }
  ]
)
assert.equal(merged.getPage(2).getRotation().angle, 90)
await assert.rejects(() => mergePdfs([{ bytes }]), /at least two/)
const split = await splitPdf(bytes, '2, 1-2')
assert.equal((await PDFDocument.load(split[0])).getPage(0).getRotation().angle, 90)
assert.equal((await PDFDocument.load(split[1])).getPageCount(), 2)
assert.equal((await splitPdf(bytes, '', true)).length, 2)
assert.equal((await splitPdf(bytes, '')).length, 1)
for (const range of ['0', '3', '2-1', '1,,2', '1-x', '-1', '1.5'])
  assert.throws(() => parsePageGroups(range, 2), /range|page/)
assert.deepEqual(parsePageGroups(' 2, 1-2 ', 2), [[1], [0, 1]])
assert.deepEqual(bytes, original, 'All operations preserve the input bytes')
assert.ok(
  (await optimizePdf(bytes)).length <= bytes.length,
  'Lossless optimization never increases the file size'
)
assert.equal((await PDFDocument.load(await overlayPdf(bytes, []))).getPageCount(), 2)
assert.throws(() => validatePdfFiles(PDF_TOOLS[0], [new File(['hello'], 'fake.docx')]), /type/)
assert.throws(
  () => validatePdfFiles(PDF_TOOLS[1], [new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')]),
  /one/
)
assert.throws(() => validatePdfFiles(PDF_TOOLS[0], [new File([], 'empty.pdf')]), /empty/)
assert.equal(PDF_TOOLS.length, 12)
assert.equal(DEFAULT_PDF_OPTIONS.compression, 'lossless')
assert.doesNotThrow(
  () => validatePdfFiles(PDF_TOOLS[0], [{ name: 'large.pdf', size: 200 * 1024 * 1024 }]),
  '8 GB fallback permits files above the previous 150 MB limit'
)
await assert.rejects(() => splitPdf(bytes, '1,2', false, undefined, undefined, 1), /memory budget/)
for (const tool of PDF_TOOLS) assert.ok(pdfToolsMessages[tool.title]?.ar, `Translate ${tool.title}`)
const controller = new AbortController()
controller.abort()
await assert.rejects(() => mergePdfs([{ bytes }, { bytes: other }], controller.signal), /abort/i)
console.log(
  'PDF merge order, rotation, split ranges, lossless sizing, input preservation, cancellation, file validation, and tool translations passed.'
)
