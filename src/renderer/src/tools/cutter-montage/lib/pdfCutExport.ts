import { PDFDocument, degrees, rgb } from 'pdf-lib'
import type { CutterExportResult, CutterProject, PieceSourceFile, PlacedPiece } from '../types'
import { getPlacedArtworkRect, getPlacedCutlineRect } from './cutlineGenerator'
import { cmToPoints, mmToPoints } from './units'
import { getCutterFileName } from './svgExport'

export async function exportCutterPdf(project: CutterProject): Promise<CutterExportResult> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([
    cmToPoints(project.sheet.widthCm),
    cmToPoints(project.sheet.heightCm)
  ])
  const pieceMap = new Map(project.pieces.map((piece) => [piece.id, piece]))
  const sourceMap = new Map(project.sources.map((source) => [source.id, source]))

  page.drawRectangle({
    x: 0,
    y: 0,
    width: cmToPoints(project.sheet.widthCm),
    height: cmToPoints(project.sheet.heightCm),
    color: rgb(1, 1, 1)
  })

  if (project.layers.artwork && project.exportSettings.includeArtwork) {
    for (const placed of project.placedPieces) {
      const piece = pieceMap.get(placed.presetId)
      const source = piece ? sourceMap.get(piece.sourceId) : undefined

      if (piece && source) {
        await drawArtwork(pdf, page, source, placed, project.sheet.heightCm, piece)
      }
    }
  }

  if (project.layers.cutlines && project.exportSettings.includeCutlines) {
    for (const placed of project.placedPieces) {
      const piece = pieceMap.get(placed.presetId)

      if (!piece) {
        continue
      }

      const rect = getPlacedCutlineRect(placed, piece)

      if (piece.cutline.shape === 'ellipse') {
        page.drawEllipse({
          x: cmToPoints(rect.xCm + rect.widthCm / 2),
          y: cmToPoints(project.sheet.heightCm - rect.yCm - rect.heightCm / 2),
          xScale: cmToPoints(rect.widthCm / 2),
          yScale: cmToPoints(rect.heightCm / 2),
          rotate: degrees(rect.rotation),
          borderColor: rgb(1, 0, 1),
          borderWidth: mmToPoints(0.1)
        })
      } else {
        page.drawRectangle({
          x: cmToPoints(rect.xCm),
          y: cmToPoints(project.sheet.heightCm - rect.yCm - rect.heightCm),
          width: cmToPoints(rect.widthCm),
          height: cmToPoints(rect.heightCm),
          rotate: degrees(rect.rotation),
          borderColor: rgb(1, 0, 1),
          borderWidth: mmToPoints(0.1)
        })
      }
    }
  }

  const bytes = await pdf.save({ addDefaultPage: false, useObjectStreams: true })

  return {
    blob: new Blob([bytesToArrayBuffer(bytes)], { type: 'application/pdf' }),
    fileName: getCutterFileName(project.sheet.widthCm, project.sheet.heightCm, 'pdf')
  }
}

async function drawArtwork(
  pdf: PDFDocument,
  page: ReturnType<PDFDocument['addPage']>,
  source: PieceSourceFile,
  placed: PlacedPiece,
  sheetHeightCm: number,
  piece: NonNullable<CutterProject['pieces'][number]>
): Promise<void> {
  const rect = getPlacedArtworkRect(placed, piece)

  if (source.mimeType === 'image/svg+xml') {
    page.drawRectangle({
      x: cmToPoints(rect.xCm),
      y: cmToPoints(sheetHeightCm - rect.yCm - rect.heightCm),
      width: cmToPoints(rect.widthCm),
      height: cmToPoints(rect.heightCm),
      rotate: degrees(rect.rotation),
      borderColor: rgb(0.75, 0.78, 0.84),
      borderWidth: 0.5
    })
    page.drawText('SVG artwork', {
      x: cmToPoints(rect.xCm + 0.2),
      y: cmToPoints(sheetHeightCm - rect.yCm - 0.6),
      size: 8,
      color: rgb(0.37, 0.42, 0.5)
    })
    return
  }

  const image =
    source.mimeType === 'image/png'
      ? await pdf.embedPng(source.bytes)
      : await pdf.embedJpg(source.bytes)

  page.drawImage(image, {
    x: cmToPoints(rect.xCm),
    y: cmToPoints(sheetHeightCm - rect.yCm - rect.heightCm),
    width: cmToPoints(rect.widthCm),
    height: cmToPoints(rect.heightCm),
    rotate: degrees(rect.rotation)
  })
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
