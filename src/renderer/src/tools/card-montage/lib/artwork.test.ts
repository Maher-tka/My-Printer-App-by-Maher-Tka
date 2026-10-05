import assert from 'node:assert/strict'
import { PDFDocument, rgb } from 'pdf-lib'
import { prepareCardArtworkFile } from './artwork'
import { exportCardMontagePdf } from './exportPdf'
import { DEFAULT_CARD_SETTINGS, type CardArtwork } from '../types'
import { MAX_EPS_BYTES } from '../../../../../shared/eps-import'

const eps = new File(['%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 240 150\n'], 'front.EPS')
const source = await PDFDocument.create()
source
  .addPage([240, 150])
  .drawRectangle({ x: 0, y: 0, width: 240, height: 150, color: rgb(1, 0, 0) })
const encoded = Buffer.from(await source.save()).toString('base64')
let calls = 0
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    printerApp: {
      runtime: {
        importEpsArtwork: async (request: { fileName: string; bytes: Uint8Array }) => {
          calls++
          assert.equal(request.fileName, eps.name)
          assert.match(new TextDecoder().decode(request.bytes), /^%!PS/)
          return { ok: true, bytesBase64: encoded }
        }
      }
    }
  }
})
const prepared = await prepareCardArtworkFile(eps)
assert.equal(prepared.name, eps.name)
assert.equal(prepared.type, 'application/pdf')
assert.equal(Buffer.from(await prepared.arrayBuffer()).toString('base64'), encoded)
const pdf = new File([new Uint8Array(await source.save())], 'existing.ai')
assert.equal(await prepareCardArtworkFile(pdf), pdf)
assert.equal(calls, 1, 'existing AI/PDF/image import does not call Illustrator')
await assert.rejects(prepareCardArtworkFile(new File(['broken'], 'bad.eps')), /not a supported EPS/)
await assert.rejects(prepareCardArtworkFile(new File([], 'empty.eps')), /empty/)
await assert.rejects(
  prepareCardArtworkFile(new File([new Uint8Array(MAX_EPS_BYTES + 1)], 'huge.eps')),
  /30 MB/
)
window.printerApp!.runtime.importEpsArtwork = async () => ({
  ok: false,
  error: 'Illustrator unavailable'
})
await assert.rejects(prepareCardArtworkFile(eps), /Illustrator unavailable/)
Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
await assert.rejects(prepareCardArtworkFile(eps), /desktop app and Adobe Illustrator/)
delete (globalThis as { window?: unknown }).window

const front: CardArtwork = {
  name: eps.name,
  kind: 'pdf',
  bytesBase64: encoded,
  pageNumber: 1,
  pageCount: 1,
  widthMm: (240 * 25.4) / 72,
  heightMm: (150 * 25.4) / 72,
  previewDataUrl: '',
  pdfInfo: { sourceFormat: 'eps', pages: [{ pageNumber: 1, fonts: [] }] }
}
// Converted PDF bytes are stored with the original EPS filename, so projects,
// repeat layouts and both-side printing never need Illustrator again.
const restored = JSON.parse(JSON.stringify(front)) as CardArtwork
const output = await PDFDocument.load(
  await exportCardMontagePdf(
    restored,
    {
      ...DEFAULT_CARD_SETTINGS,
      includeBack: true
    },
    { ...restored, name: 'back.eps' }
  )
)
assert.equal(output.getPageCount(), 2)
assert.ok(
  output.context
    .enumerateIndirectObjects()
    .some(([, object]) => String(object).includes('/Subtype /Form')),
  'converted EPS remains vector artwork in the montage'
)
console.log('Card EPS preparation, project roundtrip and front/back export tests passed.')
