import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import {
  DEFAULT_CARD_SETTINGS,
  type CardArtwork
} from '../src/renderer/src/tools/card-montage/types'
import { exportCardMontagePdf } from '../src/renderer/src/tools/card-montage/lib/exportPdf'
import { inspectCardPageFonts } from '../src/renderer/src/tools/card-montage/lib/pdfFonts'
import { assertCardFileSupported } from '../src/renderer/src/tools/card-montage/lib/artwork'

const folder = process.argv[2]
if (!folder) throw new Error('Pass the folder containing the AI, PDF and image samples.')
const output = resolve('output/pdf/card-source-test')
await mkdir(output, { recursive: true })

function fontPrograms(doc: PDFDocument): string[] {
  const hashes = new Set<string>()
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue
    for (const name of ['FontFile', 'FontFile2', 'FontFile3']) {
      const stream = doc.context.lookup(object.get(PDFName.of(name)))
      if (stream instanceof PDFRawStream)
        hashes.add(createHash('sha256').update(decodePDFRawStream(stream).decode()).digest('hex'))
    }
  }
  return [...hashes].sort()
}

const summary: unknown[] = []
let imageIndex = 0
for (const name of await readdir(folder)) {
  if (!/\.(ai|pdf|png|jpe?g)$/i.test(name)) continue
  const bytes = await readFile(join(folder, name))
  assertCardFileSupported(bytes, name)
  const kind = /\.(ai|pdf)$/i.test(name) ? 'pdf' : /\.png$/i.test(name) ? 'png' : 'jpeg'
  const source = kind === 'pdf' ? await PDFDocument.load(bytes) : null
  const art: CardArtwork = {
    name,
    kind,
    bytesBase64: bytes.toString('base64'),
    pageNumber: 1,
    pageCount: source?.getPageCount() ?? 1,
    widthMm: 0,
    heightMm: 0,
    previewDataUrl: ''
  }
  const exportBytes = await exportCardMontagePdf(art, {
    ...DEFAULT_CARD_SETTINGS,
    exportAllPdfPages: true
  })
  const montage = await PDFDocument.load(exportBytes)
  assert.equal(montage.getPageCount(), art.pageCount)
  for (const page of montage.getPages()) {
    assert.ok(Math.abs(page.getWidth() - (210 * 72) / 25.4) < 1e-6)
    assert.ok(Math.abs(page.getHeight() - (297 * 72) / 25.4) < 1e-6)
  }
  if (source) {
    assert.deepEqual(
      fontPrograms(montage),
      fontPrograms(source),
      'Embedded font programs must be byte-for-byte unchanged.'
    )
    const before = source.getPages().flatMap(inspectCardPageFonts)
    const after = montage.getPages().flatMap(inspectCardPageFonts)
    assert.deepEqual(
      after,
      before,
      'All source font names and embedding status must survive montage.'
    )
  }
  const outputName = /\.ai$/i.test(name)
    ? 'illustrator-both-sides.pdf'
    : source
      ? 'pdf-both-sides.pdf'
      : `image-side-${++imageIndex}.pdf`
  await writeFile(join(output, outputName), exportBytes)
  const entry = {
    name,
    pages: art.pageCount,
    fonts: source?.getPages().flatMap(inspectCardPageFonts),
    fontProgramsPreserved: Boolean(source),
    output: outputName
  }
  summary.push(entry)
  console.log(JSON.stringify(entry))
}
await writeFile(join(output, 'sample-checks.json'), JSON.stringify(summary, null, 2))
console.log('Production samples passed. A4 outputs saved to output/pdf/card-source-test.')
