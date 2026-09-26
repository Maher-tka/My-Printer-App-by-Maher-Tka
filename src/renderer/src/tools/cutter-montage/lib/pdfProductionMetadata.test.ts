import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { hasPdfSignature } from './sourcePreview'
import { inspectPdfProductionMetadata } from './pdfImport'

const fixtureRoot =
  process.env.PRINTER_PRODUCTION_SAMPLES_DIR ?? path.resolve(process.cwd(), '..', 'test vinnyl')

if (!existsSync(fixtureRoot)) {
  console.log(`PDF production metadata fixture test skipped; missing ${fixtureRoot}.`)
  process.exit(0)
}

function fixture(name: string): Uint8Array {
  const path = `${fixtureRoot}/${name}`
  assert.ok(existsSync(path), `fixture is missing: ${path}`)
  return new Uint8Array(readFileSync(path))
}

const printAndCutName = 'impression et decoupe planche 1 .pdf'
const printAndCutBytes = fixture(printAndCutName)
const printAndCutMetadata = inspectPdfProductionMetadata(printAndCutBytes, printAndCutName, 1)

assert.equal(hasPdfSignature(printAndCutBytes), true)
assert.equal(printAndCutMetadata.classification, 'likely-print-and-cut')
assert.equal(
  printAndCutMetadata.layers.find((layer) => layer.name === 'Calque 2')?.defaultVisible,
  false
)
assert.equal(printAndCutMetadata.pageBoxes?.media?.widthMm !== undefined, true)
assert.equal(printAndCutMetadata.pageBoxes?.media?.heightMm !== undefined, true)
assert.ok(
  Math.abs((printAndCutMetadata.pageSizeMm?.widthMm ?? 0) - 945.67) < 0.2,
  `unexpected print sheet width: ${printAndCutMetadata.pageSizeMm?.widthMm}`
)
assert.ok(
  Math.abs((printAndCutMetadata.pageSizeMm?.heightMm ?? 0) - 2074.3) < 0.2,
  `unexpected print sheet height: ${printAndCutMetadata.pageSizeMm?.heightMm}`
)
assert.ok(printAndCutMetadata.colorants.some((colorant) => colorant.name === 'MimakiFCRM'))
assert.ok(printAndCutMetadata.colorants.some((colorant) => colorant.name === 'MimakiFCRMDir'))
assert.ok(printAndCutMetadata.warnings.some((warning) => /Calque 2/.test(warning)))
assert.ok(printAndCutMetadata.warnings.some((warning) => /MimakiFCRM/.test(warning)))
assert.ok(
  printAndCutMetadata.warnings.every(
    (warning) =>
      !/automatically converted into an editable CutContour/.test(warning) || /not/.test(warning)
  )
)

const artworkOnlyName = 'vinyle - 10.pdf'
const artworkOnlyMetadata = inspectPdfProductionMetadata(
  fixture(artworkOnlyName),
  artworkOnlyName,
  1
)
assert.equal(artworkOnlyMetadata.classification, 'artwork-only')
assert.equal(artworkOnlyMetadata.colorants.length, 0)

const illustratorName = 'VISACARD.ai'
const illustratorBytes = fixture(illustratorName)
const illustratorMetadata = inspectPdfProductionMetadata(illustratorBytes, illustratorName, 1)
assert.equal(hasPdfSignature(illustratorBytes), true)
assert.equal(illustratorMetadata.sourceFormat, 'pdf-compatible-ai')
assert.equal(illustratorMetadata.classification, 'artwork-only')
assert.ok(illustratorMetadata.notes.some((note) => /PDF-compatible Illustrator/.test(note)))

console.log('PDF production metadata fixtures passed.')
