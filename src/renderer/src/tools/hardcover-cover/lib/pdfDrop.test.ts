import assert from 'node:assert/strict'
import { isFileDrag, planHardcoverPdfDrop } from './pdfDrop'
import { consumeHardcoverPdfImportTarget, markHardcoverPdfImportTarget } from './sourcePdf'

const front = new File(['fixture'], 'PAGE DE GARDE.PDF', { type: 'application/pdf' })
const back = new File(['fixture'], 'arrière.pdf', { type: 'application/pdf' })
const pair = planHardcoverPdfDrop([back, front])
assert.deepEqual(
  pair.map(({ file, target }) => [file.name, target]),
  [
    [front.name, 'front'],
    [back.name, 'back']
  ],
  'a reversed file list still routes the named front/back pair correctly'
)
for (const item of pair) {
  markHardcoverPdfImportTarget(item.file, item.target!)
  assert.equal(
    consumeHardcoverPdfImportTarget(item.file),
    item.target,
    'drop routing reaches the existing importer'
  )
  assert.equal(
    consumeHardcoverPdfImportTarget(item.file),
    'single',
    'routing cannot leak into a later import of the same file'
  )
}
assert.equal(
  planHardcoverPdfDrop([back], 'front')[0].target,
  'front',
  'explicit drop destination takes precedence over the filename'
)
assert.equal(
  planHardcoverPdfDrop([front], 'single')[0].target,
  'single',
  'whole-book destination preserves the existing page selection workflow'
)
assert.equal(
  planHardcoverPdfDrop([front])[0].target,
  'front',
  'a workspace drop uses the front cover'
)
assert.throws(
  () => planHardcoverPdfDrop([front, new File(['fixture'], 'other.pdf')]),
  /Cannot tell/,
  'an ambiguous pair does not replace a source by guessing file order'
)
assert.throws(
  () => planHardcoverPdfDrop([front, back], 'back'),
  /one PDF at a time/,
  'an explicit board does not silently discard a second file'
)
assert.throws(
  () => planHardcoverPdfDrop([front, new File(['fixture'], 'report.docx')]),
  /Use PDF/,
  'the entire set is checked before any import begins'
)
assert.throws(() => planHardcoverPdfDrop([new File([], 'empty.pdf')]), /empty/)
assert.throws(() => planHardcoverPdfDrop([]), /folder or link/)
assert.equal(
  isFileDrag({ types: ['text/plain'] }),
  false,
  'internal artwork drags do not become file imports'
)
assert.equal(isFileDrag({ types: ['Files', 'text/uri-list'] }), true)
console.log('Hardcover PDF drop routing and validation tests passed.')
