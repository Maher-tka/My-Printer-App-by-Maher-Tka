import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { PDFDocument } from 'pdf-lib'
import { assertEpsImportRequest, getEpsDimensions, MAX_EPS_BYTES } from '../shared/eps-import.js'
import { createEpsImportScript, validateConvertedEpsPdf } from './eps-import.js'

const eps = new TextEncoder().encode('%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 240 150\n')
assert.doesNotThrow(() => assertEpsImportRequest({ fileName: 'card.EPS', bytes: eps }))
const binary = new Uint8Array(30 + eps.length)
binary.set([0xc5, 0xd0, 0xd3, 0xc6])
new DataView(binary.buffer).setUint32(4, 30, true)
new DataView(binary.buffer).setUint32(8, eps.length, true)
binary.set(eps, 30)
assert.doesNotThrow(() => assertEpsImportRequest({ fileName: 'binary.eps', bytes: binary }))
assert.deepEqual(getEpsDimensions(binary), { widthPt: 240, heightPt: 150 })
assert.deepEqual(
  getEpsDimensions(
    new TextEncoder().encode('%%BoundingBox: (atend)\n%%HiResBoundingBox: -1.5 -20 240.5 150.25\n')
  ),
  { widthPt: 242, heightPt: 170.25 }
)
assert.deepEqual(
  getEpsDimensions(
    new TextEncoder().encode('%%BoundingBox: (atend)\n%%Trailer\n%%BoundingBox: 10 20 250 170\r\n')
  ),
  { widthPt: 240, heightPt: 150 }
)
assert.throws(() => getEpsDimensions(new TextEncoder().encode('%%BoundingBox: 0 0 NaN 10\n')))
for (const bytes of [
  new Uint8Array(),
  new Uint8Array(MAX_EPS_BYTES + 1),
  eps.subarray(1),
  binary.subarray(0, 32)
])
  assert.throws(() => assertEpsImportRequest({ fileName: 'bad.eps', bytes }))
assert.throws(() => assertEpsImportRequest({ fileName: 'bad.pdf', bytes: eps }))
assert.throws(() => assertEpsImportRequest(null))

for (const failure of [
  'none',
  'open',
  'size',
  'save',
  'link',
  'empty',
  'no-artboards',
  'too-many',
  'close'
]) {
  let closed = false
  let destination = ''
  const doc = {
    pageItems: failure === 'empty' ? [] : [{}],
    placedItems: failure === 'link' ? [{ file: { exists: false } }] : [],
    artboards:
      failure === 'no-artboards'
        ? []
        : failure === 'too-many'
          ? Array.from({ length: 201 }, () => ({ artboardRect: [0, 150, 240, 0] }))
          : [
              { artboardRect: [0, 150, failure === 'size' ? NaN : 240, 0] },
              { artboardRect: [300, 200, 480, 80] }
            ],
    saveAs(file: { path: string }, options: Record<string, unknown>) {
      if (failure === 'save') throw new Error('save failed')
      destination = file.path
      assert.equal(options.preserveEditability, false)
      assert.equal(options.artboardRange, '', 'PDF must include every native artboard')
    },
    close(value: string) {
      closed = true
      assert.equal(value, 'discard')
      if (failure === 'close') throw new Error('close failed')
    }
  }
  const app = {
    userInteractionLevel: 'previous',
    open(file: { path: string }) {
      assert.equal(file.path, "C:/test's/مهم.eps")
      if (failure === 'open') throw new Error('open failed')
      return doc
    }
  }
  const run = () =>
    runInNewContext(createEpsImportScript("C:/test's/مهم.eps", 'C:/temp/result.pdf'), {
      app,
      File: function (this: { path: string }, path: string) {
        this.path = path
      },
      PDFSaveOptions: function () {},
      PDFCompatibility: { ACROBAT7: 7 },
      DocumentColorSpace: { CMYK: 'CMYK' },
      UserInteractionLevel: { DONTDISPLAYALERTS: 'silent' },
      SaveOptions: { DONOTSAVECHANGES: 'discard' }
    })
  if (failure === 'none') {
    assert.equal(run(), '[[240,150],[180,120]]')
    assert.equal(destination, 'C:/temp/result.pdf')
  } else assert.throws(run)
  assert.equal(app.userInteractionLevel, 'previous', 'Illustrator interaction state is restored')
  assert.equal(closed, failure !== 'open', 'only the imported document is closed')
}
const twoPages = await PDFDocument.create()
twoPages.addPage([240, 150])
twoPages.addPage([180, 120])
assert.doesNotThrow(() =>
  validateConvertedEpsPdf(twoPages, [
    [240, 150],
    [180, 120]
  ])
)
assert.throws(
  () =>
    validateConvertedEpsPdf(twoPages, [
      [180, 120],
      [240, 150]
    ]),
  /dimensions changed/
)
assert.throws(() => validateConvertedEpsPdf(twoPages, [[240, 150]]), /artboards were lost/)
const flattened = await PDFDocument.create()
flattened.addPage([510, 150])
assert.throws(
  () =>
    validateConvertedEpsPdf(flattened, [
      [240, 150],
      [240, 150]
    ]),
  /artboards were lost/
)
for (const invalid of [
  null,
  [],
  [[NaN, 150]],
  [[240, 0]],
  [['240', 150]],
  [[240]],
  [[240, 150, 0]]
])
  assert.throws(() => validateConvertedEpsPdf(twoPages, invalid), /invalid artboard dimensions/)
assert.throws(
  () =>
    validateConvertedEpsPdf(
      twoPages,
      Array.from({ length: 201 }, () => [240, 150])
    ),
  /invalid artboard dimensions/
)
const singlePage = await PDFDocument.create()
singlePage.addPage([240, 150])
assert.doesNotThrow(() => validateConvertedEpsPdf(singlePage, [[240, 150]]))
console.log(
  'EPS validation, native artboards, PDF dimensions and Illustrator lifecycle tests passed.'
)
