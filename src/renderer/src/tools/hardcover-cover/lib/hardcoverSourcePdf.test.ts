import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import {
  createHardcoverSeparatePdfSource,
  readHardcoverPdfPageGeometry,
  updateHardcoverSeparatePdfSource
} from './sourcePdf'
import type { HardcoverPdfCoverSource } from '../types'

const fixtureRoot =
  process.env.HARDCOVER_TEST_FIXTURE_ROOT ??
  path.resolve(process.cwd(), '..', 'test vinnyl', '24-06-2026', '6 LIVRE 50740380')
const frontPath = path.join(fixtureRoot, 'PAGE DE GARDE.pdf')
const backPath = path.join(fixtureRoot, 'arriere.pdf')
const interiorPath = path.join(fixtureRoot, 'RAPPORT FINALE DE MEMOIRE_compressed.pdf')

if (!existsSync(frontPath) || !existsSync(backPath)) {
  console.log(`Hardcover source fixture test skipped; missing ${fixtureRoot}.`)
  process.exit(0)
}

const frontBytes = new Uint8Array(readFileSync(frontPath))
const backBytes = new Uint8Array(readFileSync(backPath))
const [frontDocument, backDocument] = await Promise.all([
  PDFDocument.load(frontBytes),
  PDFDocument.load(backBytes)
])

assert.ok(frontDocument.getPageCount() >= 1, 'front fixture has at least one page')
assert.ok(backDocument.getPageCount() >= 1, 'back fixture has at least one page')

const [frontGeometry, backGeometry] = await Promise.all([
  readHardcoverPdfPageGeometry(frontBytes, 1),
  readHardcoverPdfPageGeometry(backBytes, 1)
])

for (const [label, geometry] of [
  ['front', frontGeometry],
  ['back', backGeometry]
] as const) {
  assert.ok(geometry.widthPt > 0, `${label} page width is available`)
  assert.ok(geometry.heightPt > 0, `${label} page height is available`)
  assert.ok(geometry.mediaBox, `${label} MediaBox is available`)
  assert.ok(geometry.cropBox, `${label} CropBox is available`)
  assert.ok(geometry.trimBox, `${label} TrimBox fallback is reported`)
  assert.ok(geometry.bleedBox, `${label} BleedBox fallback is reported`)
}

const frontSource: HardcoverPdfCoverSource = {
  sourceId: 'fixture-front',
  fileName: path.basename(frontPath),
  pageCount: frontDocument.getPageCount(),
  pageNumber: 1,
  fitMode: 'fit',
  pageGeometry: frontGeometry
}
const backSource: HardcoverPdfCoverSource = {
  sourceId: 'fixture-back',
  fileName: path.basename(backPath),
  pageCount: backDocument.getPageCount(),
  pageNumber: 1,
  fitMode: 'fill',
  pageGeometry: backGeometry
}
const separateSource = createHardcoverSeparatePdfSource(frontSource, backSource)

assert.equal(separateSource.sourceMode, 'separate', 'front/back sources use separate mode')
assert.equal(separateSource.frontSource?.fileName, path.basename(frontPath))
assert.equal(separateSource.backSource?.fileName, path.basename(backPath))
assert.equal(separateSource.frontSource?.fitMode, 'fit', 'front keeps its placement mode')
assert.equal(separateSource.backSource?.fitMode, 'fill', 'back keeps its placement mode')

const disabledBackSource = { ...separateSource, backCoverEnabled: false }
const refreshedFrontSource = updateHardcoverSeparatePdfSource(disabledBackSource, 'front', {
  ...frontSource,
  pageNumber: 1
})
assert.equal(
  refreshedFrontSource.backCoverEnabled,
  false,
  'refreshing the front source preserves a disabled back cover'
)
assert.equal(
  refreshedFrontSource.backSource?.fileName,
  path.basename(backPath),
  'refreshing the front source preserves the independent back descriptor'
)

const serialized = structuredClone(separateSource) as unknown as Record<string, unknown>
assert.equal('bytes' in serialized, false, 'separate source does not serialize PDF bytes')
assert.equal(
  'bytes' in ((serialized.frontSource ?? {}) as Record<string, unknown>),
  false,
  'front descriptor does not serialize PDF bytes'
)
assert.equal(
  'bytes' in ((serialized.backSource ?? {}) as Record<string, unknown>),
  false,
  'back descriptor does not serialize PDF bytes'
)

if (existsSync(interiorPath)) {
  const interiorBytes = new Uint8Array(readFileSync(interiorPath))
  const interiorDocument = await PDFDocument.load(interiorBytes)
  assert.equal(interiorDocument.getPageCount(), 183, 'long interior fixture has 183 pages')
  const interiorGeometry = await readHardcoverPdfPageGeometry(
    interiorBytes,
    Math.ceil(interiorDocument.getPageCount() / 2)
  )
  assert.ok(interiorGeometry.widthPt > 0, 'long interior middle page has a width')
  assert.ok(interiorGeometry.heightPt > 0, 'long interior middle page has a height')
}

console.log('Hardcover independent source fixture tests passed.')
