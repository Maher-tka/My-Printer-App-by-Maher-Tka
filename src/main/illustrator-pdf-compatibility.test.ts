import assert from 'node:assert/strict'
import { PDFDocument, PDFName, PDFString } from 'pdf-lib'
import { verifyCs6IllustratorPdf } from './illustrator-pdf-compatibility.js'

async function fixture({
  version = 16,
  layers = ['Artwork', 'CutContour', 'FC RegisterMark Layer1'],
  hidden = true,
  editing = true,
  pages = 1
} = {}) {
  const pdf = await PDFDocument.create()
  for (let i = 0; i < pages; i++) pdf.addPage([(955 * 72) / 25.4, (355 * 72) / 25.4])
  const groups = layers.map((name) =>
    pdf.context.register(pdf.context.obj({ Type: 'OCG', Name: PDFString.of(name) }))
  )
  pdf.catalog.set(
    PDFName.of('OCProperties'),
    pdf.context.obj({
      OCGs: groups,
      D: {
        OFF: hidden ? [groups[layers.indexOf('CutContour')]] : [],
        ON: groups.filter((_, i) => layers[i] !== 'CutContour')
      }
    })
  )
  if (editing) {
    const metadata = pdf.context.register(
      pdf.context.flateStream(`%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator(R) ${version}.0\n`)
    )
    const body = pdf.context.register(pdf.context.flateStream('%%BoundingBox: 0 0 100 100\n'))
    // Producer version remains modern even when the actual editing format is CS6.
    pdf.getPages()[0].node.set(
      PDFName.of('PieceInfo'),
      pdf.context.obj({
        Illustrator: {
          Private: {
            CreatorVersion: 30,
            ContainerVersion: 11,
            AIMetaData: metadata,
            AIPrivateData1: body
          }
        }
      })
    )
  }
  return pdf.save()
}
await verifyCs6IllustratorPdf(await fixture())
await assert.rejects(
  verifyCs6IllustratorPdf(await fixture({ version: 24 })),
  /not in CS6 format/,
  'ordinary PDF resaving must not silently regenerate modern editing data'
)
await assert.rejects(
  verifyCs6IllustratorPdf(await fixture({ layers: ['Artwork'] })),
  /three production layers/
)
await assert.rejects(verifyCs6IllustratorPdf(await fixture({ hidden: false })), /must be hidden/)
await assert.rejects(
  verifyCs6IllustratorPdf(await fixture({ editing: false })),
  /editing data is missing/
)
await assert.rejects(verifyCs6IllustratorPdf(await fixture({ pages: 2 })), /one PDF page/)
console.log('CS6 editing-format, three-layer, hidden-contour and single-page PDF checks passed.')
