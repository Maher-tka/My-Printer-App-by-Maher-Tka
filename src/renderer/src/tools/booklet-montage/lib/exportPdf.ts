import { PDFDocument, type PDFPage, rgb } from 'pdf-lib'
import type {
  BookletSheet,
  BookletSource,
  EmptyMontageSheet,
  ExportProgress,
  SheetSettings,
  SizeMm
} from '../types'
import { hexToRgb } from './colorUtils'
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
  emptySheets?: EmptyMontageSheet[]
}

export async function exportBookletPdf(
  sheets: BookletSheet[],
  sources: BookletSource[],
  settings: SheetSettings,
  onProgress: (progress: ExportProgress) => void,
  options: ExportPdfOptions = {}
): Promise<Blob> {
  const signal = options.signal
  const emptySheets = options.emptySheets ?? []

  assertNotCanceled(signal)
  assertExportCanStart(sheets, settings, emptySheets.length)

  const sides = flattenSheetSides(sheets)
  const totalPages = sides.length + emptySheets.length
  const printSize = getPrintSizeMm(settings)
  const layout = getSheetLayoutMm(settings)
  const pdf = await PDFDocument.create()

  onProgress({
    phase: 'preparing-pages',
    current: 0,
    total: totalPages,
    message: 'Preparing pages for PDF export'
  })

  const assets = await preparePdfRenderAssets(pdf, sheets, sources, signal)
  let renderedPages = 0

  for (const side of sides) {
    assertNotCanceled(signal)

    onProgress({
      phase: 'rendering-page',
      current: renderedPages,
      total: totalPages,
      message: `Rendering page ${renderedPages + 1} of ${totalPages}: sheet ${side.sheetNumber} ${side.side}`
    })

    const pdfPage = pdf.addPage([
      mmToPoints(printSize.widthMm),
      mmToPoints(printSize.heightMm)
    ])

    await renderPdfSheetSide(pdfPage, side, settings, layout, assets, signal)

    renderedPages += 1
    onProgress({
      phase: 'rendering-page',
      current: renderedPages,
      total: totalPages,
      message: `Rendered page ${renderedPages} of ${totalPages}`
    })

    await yieldToUi()
  }

  for (const emptySheet of emptySheets) {
    assertNotCanceled(signal)

    onProgress({
      phase: 'rendering-page',
      current: renderedPages,
      total: totalPages,
      message: `Rendering page ${renderedPages + 1} of ${totalPages}: ${emptySheet.label}`
    })

    drawPdfEmptySheet(
      pdf.addPage([mmToPoints(printSize.widthMm), mmToPoints(printSize.heightMm)]),
      printSize,
      emptySheet.colorHex
    )

    renderedPages += 1
    onProgress({
      phase: 'rendering-page',
      current: renderedPages,
      total: totalPages,
      message: `Rendered page ${renderedPages} of ${totalPages}`
    })

    await yieldToUi()
  }

  assertNotCanceled(signal)
  onProgress({
    phase: 'creating-pdf',
    current: totalPages,
    total: totalPages,
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
  settings: SheetSettings,
  emptySheetCount = 0
): void {
  if (sheets.length === 0 && emptySheetCount === 0) {
    throw new Error('No valid booklet or empty sheets to export.')
  }

  const settingsErrors = validatePrintSettings(settings)

  if (settingsErrors.length > 0) {
    throw new Error(settingsErrors[0])
  }
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function drawPdfEmptySheet(pdfPage: PDFPage, printSize: SizeMm, colorHex: string): void {
  const color = hexToRgb(colorHex) ?? { r: 255, g: 255, b: 255 }

  pdfPage.drawRectangle({
    x: 0,
    y: 0,
    width: mmToPoints(printSize.widthMm),
    height: mmToPoints(printSize.heightMm),
    color: rgb(color.r / 255, color.g / 255, color.b / 255)
  })
}
