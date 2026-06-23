import {
  PDFDocument,
  appendBezierCurve,
  clip,
  closePath,
  degrees,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb
} from 'pdf-lib'
import type { CutterExportResult, CutterProject, PiecePreset, PieceSourceFile, PlacedPiece } from '../types'
import { getPlacedArtworkRect, getPlacedCutlineRect } from './cutlineGenerator'
import { getPlacedMaskRect } from './maskUtils'
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

      if (piece && source && piece.objectVisibility.artwork) {
        await drawArtwork(pdf, page, source, placed, project.sheet.heightCm, piece)
      }
    }
  }

  if (project.layers.cutlines && project.exportSettings.includeCutlines) {
    for (const placed of project.placedPieces) {
      const piece = pieceMap.get(placed.presetId)

      if (!piece || !piece.objectVisibility.cutline) {
        continue
      }

      drawCutline(page, getPlacedCutlineRect(placed, piece), project.sheet.heightCm, piece)
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
  piece: PiecePreset
): Promise<void> {
  const artworkRect = getPlacedArtworkRect(placed, piece)
  const maskRect = getPlacedMaskRect(placed, piece)
  const hasMask = piece.clippingMaskEnabled ?? piece.mask.enabled

  if (source.mimeType === 'image/svg+xml') {
    const rect = hasMask ? maskRect : artworkRect
    const pdfRect = toPdfRect(rect, sheetHeightCm)

    page.drawRectangle({
      x: pdfRect.x,
      y: pdfRect.y,
      width: pdfRect.width,
      height: pdfRect.height,
      rotate: degrees(-rect.rotation),
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
  const pdfRect = toPdfRect(artworkRect, sheetHeightCm)

  if (hasMask) {
    pushMaskClip(page, maskRect, sheetHeightCm, piece.mask.shape)
  }

  page.drawImage(image, {
    x: pdfRect.x,
    y: pdfRect.y,
    width: pdfRect.width,
    height: pdfRect.height,
    rotate: degrees(-artworkRect.rotation)
  })

  if (hasMask) {
    page.pushOperators(popGraphicsState())
  }
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

type PdfPage = ReturnType<PDFDocument['addPage']>

interface RectLike {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotation: number
}

interface PdfRect {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
}

function drawCutline(
  page: PdfPage,
  rect: RectLike,
  sheetHeightCm: number,
  piece: PiecePreset
): void {
  const pdfRect = toPdfRect(rect, sheetHeightCm)
  const borderWidth = Math.max(mmToPoints(0.1), piece.cutline.strokeWidthPt)

  if (piece.cutline.shape === 'ellipse') {
    page.drawEllipse({
      x: pdfRect.centerX,
      y: pdfRect.centerY,
      xScale: pdfRect.width / 2,
      yScale: pdfRect.height / 2,
      rotate: degrees(-rect.rotation),
      borderColor: rgb(1, 0, 1),
      borderWidth
    })
    return
  }

  page.drawRectangle({
    x: pdfRect.x,
    y: pdfRect.y,
    width: pdfRect.width,
    height: pdfRect.height,
    rotate: degrees(-rect.rotation),
    borderColor: rgb(1, 0, 1),
    borderWidth
  })
}

function pushMaskClip(
  page: PdfPage,
  rect: RectLike,
  sheetHeightCm: number,
  shape: PiecePreset['mask']['shape']
): void {
  const pdfRect = toPdfRect(rect, sheetHeightCm)

  page.pushOperators(pushGraphicsState())

  if (shape === 'ellipse') {
    pushEllipsePath(page, pdfRect)
  } else if (shape === 'custom-polygon') {
    page.pushOperators(
      moveTo(pdfRect.centerX, pdfRect.y + pdfRect.height),
      lineTo(pdfRect.x + pdfRect.width, pdfRect.centerY),
      lineTo(pdfRect.centerX, pdfRect.y),
      lineTo(pdfRect.x, pdfRect.centerY),
      closePath()
    )
  } else {
    page.pushOperators(rectangle(pdfRect.x, pdfRect.y, pdfRect.width, pdfRect.height))
  }

  page.pushOperators(clip(), endPath())
}

function pushEllipsePath(page: PdfPage, rect: PdfRect): void {
  const kappa = 0.5522847498307936
  const rx = rect.width / 2
  const ry = rect.height / 2
  const cx = rect.centerX
  const cy = rect.centerY

  page.pushOperators(
    moveTo(cx + rx, cy),
    appendBezierCurve(cx + rx, cy + ry * kappa, cx + rx * kappa, cy + ry, cx, cy + ry),
    appendBezierCurve(cx - rx * kappa, cy + ry, cx - rx, cy + ry * kappa, cx - rx, cy),
    appendBezierCurve(cx - rx, cy - ry * kappa, cx - rx * kappa, cy - ry, cx, cy - ry),
    appendBezierCurve(cx + rx * kappa, cy - ry, cx + rx, cy - ry * kappa, cx + rx, cy),
    closePath()
  )
}

function toPdfRect(rect: RectLike, sheetHeightCm: number): PdfRect {
  const x = cmToPoints(rect.xCm)
  const y = cmToPoints(sheetHeightCm - rect.yCm - rect.heightCm)
  const width = cmToPoints(rect.widthCm)
  const height = cmToPoints(rect.heightCm)

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2
  }
}
