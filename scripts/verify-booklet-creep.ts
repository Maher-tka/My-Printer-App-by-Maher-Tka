/// <reference types="node" />

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type {
  BookletPage,
  BookletSource,
  SheetSettings
} from '../src/renderer/src/tools/booklet-montage/types'
import { generateBookletSheets } from '../src/renderer/src/tools/booklet-montage/lib/bookletImposition'
import { DEFAULT_SHEET_SETTINGS } from '../src/renderer/src/tools/booklet-montage/lib/printSizes'
import { exportBookletPdf } from '../src/renderer/src/tools/booklet-montage/lib/exportPdf'
import { mmToPoints } from '../src/renderer/src/tools/booklet-montage/lib/units'

const outputDirectory = resolve('tmp/pdfs/booklet-creep-qa')
const pageWidthMm = 148.5
const pageHeightMm = 210
const sourceBytes = await createSourcePdf()
const source: BookletSource = {
  id: 'creep-qa-source',
  kind: 'pdf',
  name: 'creep-qa-48-pages.pdf',
  mimeType: 'application/pdf',
  bytes: sourceBytes,
  pageCount: 48
}
const pages: BookletPage[] = Array.from({ length: 48 }, (_, index) => ({
  id: `creep-qa-page-${index + 1}`,
  kind: 'pdf',
  sourceType: 'pdf',
  sourceId: source.id,
  sourceName: source.name,
  sourceFileName: source.name,
  sourcePageIndex: index,
  originalPageNumber: index + 1,
  currentOrderIndex: index,
  originalOrderIndex: index,
  importBatchId: 'creep-qa-batch',
  importBatchIndex: index,
  label: `Page ${index + 1}`,
  displayName: `Creep QA Page ${index + 1}`,
  widthMm: pageWidthMm,
  heightMm: pageHeightMm
}))

await mkdir(outputDirectory, { recursive: true })
await writeFile(resolve(outputDirectory, 'source-48-pages.pdf'), sourceBytes)
await exportVariant('disabled', 'ltr', false, 0)
await exportVariant('ltr-2mm', 'ltr', true, 2)
await exportVariant('rtl-2mm', 'rtl', true, 2)

console.log(`Creep QA PDFs written to ${outputDirectory}`)

async function exportVariant(
  name: string,
  readingDirection: SheetSettings['readingDirection'],
  enabled: boolean,
  measuredTotalCreepMm: number
): Promise<void> {
  const settings: SheetSettings = {
    ...DEFAULT_SHEET_SETTINGS,
    readingDirection,
    exportQuality: 'high',
    creep: {
      ...DEFAULT_SHEET_SETTINGS.creep,
      enabled,
      mode: 'measured',
      measuredTotalCreepMm
    }
  }
  const sheets = generateBookletSheets(pages, readingDirection)
  const blob = await exportBookletPdf(sheets, [source], settings, () => undefined)
  await writeFile(resolve(outputDirectory, `${name}.pdf`), new Uint8Array(await blob.arrayBuffer()))
}

async function createSourcePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  const width = mmToPoints(pageWidthMm)
  const height = mmToPoints(pageHeightMm)
  const guideInset = mmToPoints(8)

  for (let pageIndex = 0; pageIndex < 48; pageIndex += 1) {
    const page = pdf.addPage([width, height])
    const pageNumber = pageIndex + 1
    const label = `PAGE ${pageNumber}`
    const labelWidth = font.widthOfTextAtSize(label, 30)

    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      borderWidth: mmToPoints(0.4),
      borderColor: rgb(0.05, 0.05, 0.05),
      color: pageNumber % 2 === 0 ? rgb(0.94, 0.97, 1) : rgb(1, 0.97, 0.92)
    })
    page.drawLine({
      start: { x: guideInset, y: 0 },
      end: { x: guideInset, y: height },
      thickness: mmToPoints(0.6),
      color: rgb(0.8, 0.1, 0.1)
    })
    page.drawLine({
      start: { x: width - guideInset, y: 0 },
      end: { x: width - guideInset, y: height },
      thickness: mmToPoints(0.6),
      color: rgb(0.1, 0.25, 0.8)
    })
    page.drawText(label, {
      x: (width - labelWidth) / 2,
      y: height / 2,
      size: 30,
      font,
      color: rgb(0.08, 0.08, 0.08)
    })
    page.drawText('RED = left artwork guide | BLUE = right artwork guide', {
      x: mmToPoints(12),
      y: mmToPoints(12),
      size: 9,
      font,
      color: rgb(0.2, 0.2, 0.2)
    })
  }

  return pdf.save({ useObjectStreams: false })
}
