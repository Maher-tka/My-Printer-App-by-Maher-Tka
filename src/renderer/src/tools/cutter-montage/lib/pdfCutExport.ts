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
import type {
  CutterExportResult,
  CutterProject,
  PiecePreset,
  PieceSourceFile,
  PlacedPiece
} from '../types'
import { getPlacedArtworkRect, getPlacedCutlineRect } from './cutlineGenerator'
import { getPlacedMaskRect } from './maskUtils'
import { cmToPoints, mmToPoints } from './units'
import { getCutterFileName } from './svgExport'

export async function exportCutterPdf(project: CutterProject): Promise<CutterExportResult> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([cmToPoints(project.sheet.widthCm), cmToPoints(project.sheet.heightCm)])
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
    const image = await embedSvgSourceAsPng(pdf, source)

    if (!image) {
      drawSvgFallback(page, hasMask ? maskRect : artworkRect, sheetHeightCm)
      return
    }

    if (hasMask) {
      pushMaskClip(page, maskRect, sheetHeightCm, piece.mask.shape)
    }

    const pdfRect = toPdfRect(artworkRect, sheetHeightCm)
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

async function embedSvgSourceAsPng(
  pdf: PDFDocument,
  source: PieceSourceFile
): Promise<PDFImage | null> {
  if (typeof document === 'undefined') {
    return null
  }

  const svgText = new TextDecoder().decode(source.bytes)
  const svgSize = getSvgIntrinsicSize(svgText, source.naturalWidthPx, source.naturalHeightPx)
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const image = await loadSvgImage(url)
    const width = Math.max(image.naturalWidth || image.width || svgSize.width || 800, 1)
    const height = Math.max(image.naturalHeight || image.height || svgSize.height || 800, 1)
    const pixelRatio =
      typeof window === 'undefined' ? 1 : Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      return null
    }

    canvas.width = Math.ceil(width * pixelRatio)
    canvas.height = Math.ceil(height * pixelRatio)
    context.scale(pixelRatio, pixelRatio)
    context.drawImage(image, 0, 0, width, height)

    const pngBytes = await canvasToPngBytes(canvas)
    resetCanvas(canvas)

    return pngBytes ? pdf.embedPng(pngBytes) : null
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not render SVG artwork for PDF export.'))
    image.src = url
  })
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null)
        return
      }

      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(() => resolve(null))
    }, 'image/png')
  })
}

function resetCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 1
  canvas.height = 1
}

function getSvgIntrinsicSize(
  svgText: string,
  fallbackWidth: number,
  fallbackHeight: number
): { width: number; height: number } {
  const width = readSvgLength(svgText, 'width')
  const height = readSvgLength(svgText, 'height')

  if (width && height) {
    return { width, height }
  }

  const viewBox = /viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i.exec(svgText)
  if (viewBox) {
    return {
      width: Number(viewBox[1]) || fallbackWidth || 800,
      height: Number(viewBox[2]) || fallbackHeight || 800
    }
  }

  return {
    width: fallbackWidth || 800,
    height: fallbackHeight || 800
  }
}

function readSvgLength(svgText: string, attribute: 'width' | 'height'): number | null {
  const match = new RegExp(`${attribute}=["']([\\d.]+)(?:px|pt|mm|cm|in)?["']`, 'i').exec(svgText)
  const value = match ? Number(match[1]) : Number.NaN

  return Number.isFinite(value) && value > 0 ? value : null
}

function drawSvgFallback(page: PdfPage, rect: RectLike, sheetHeightCm: number): void {
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
  page.drawText('SVG preview unavailable', {
    x: cmToPoints(rect.xCm + 0.2),
    y: cmToPoints(sheetHeightCm - rect.yCm - 0.6),
    size: 8,
    color: rgb(0.37, 0.42, 0.5)
  })
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
