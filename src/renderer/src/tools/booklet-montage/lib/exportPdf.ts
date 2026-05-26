import { PDFDocument } from 'pdf-lib'
import type { BookletSheet, BookletSource, ExportProgress, SheetSettings } from '../types'
import { assertNotCanceled, yieldToUi } from './memoryCleanup'
import { getPrintSizeMm, getSheetLayoutMm, validatePrintSettings } from './printSizes'
import {
  flattenSheetSides,
  preparePdfRenderAssets,
  renderPdfSheetSide
} from './renderSheet'
import { mmToPoints } from './units'

interface ExportPdfOptions {
  signal?: AbortSignal
}

export async function exportBookletPdf(
  sheets: BookletSheet[],
  sources: BookletSource[],
  settings: SheetSettings,
  onProgress: (progress: ExportProgress) => void,
  options: ExportPdfOptions = {}
): Promise<Blob> {
  const signal = options.signal

  assertNotCanceled(signal)
  assertExportCanStart(sheets, settings)

  const sides = flattenSheetSides(sheets)
  const totalSides = sides.length
  const printSize = getPrintSizeMm(settings)
  const layout = getSheetLayoutMm(settings)
  const pdf = await PDFDocument.create()

  onProgress({
    phase: 'preparing-pages',
    current: 0,
    total: totalSides,
    message: 'Preparing pages for PDF export'
  })

  const assets = await preparePdfRenderAssets(pdf, sheets, sources, signal)
  let renderedSides = 0

  for (const side of sides) {
    assertNotCanceled(signal)

    onProgress({
      phase: 'rendering-page',
      current: renderedSides,
      total: totalSides,
      message: `Rendering page ${renderedSides + 1} of ${totalSides}: sheet ${side.sheetNumber} ${side.side}`
    })

    const pdfPage = pdf.addPage([
      mmToPoints(printSize.widthMm),
      mmToPoints(printSize.heightMm)
    ])

    await renderPdfSheetSide(pdfPage, side, settings, layout, assets, signal)

    renderedSides += 1
    onProgress({
      phase: 'rendering-page',
      current: renderedSides,
      total: totalSides,
      message: `Rendered page ${renderedSides} of ${totalSides}`
    })

    await yieldToUi()
  }

  assertNotCanceled(signal)
  onProgress({
    phase: 'creating-pdf',
    current: totalSides,
    total: totalSides,
    message: 'Creating print-ready PDF'
  })

  const bytes = await pdf.save({
    useObjectStreams: settings.exportQuality === 'standard',
    addDefaultPage: false
  })

  return new Blob([bytesToArrayBuffer(bytes)], { type: 'application/pdf' })
}

export function assertExportCanStart(
  sheets: BookletSheet[],
  settings: SheetSettings
): void {
  if (sheets.length === 0) {
    throw new Error('No valid booklet sheets to export. Import pages and make the page count divisible by 4.')
  }

  const settingsErrors = validatePrintSettings(settings)

  if (settingsErrors.length > 0) {
    throw new Error(settingsErrors[0])
  }
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
