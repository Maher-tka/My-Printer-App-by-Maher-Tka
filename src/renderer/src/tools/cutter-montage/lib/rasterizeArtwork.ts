import { assertCanvasWithinLimit, resetCanvas } from '../../booklet-montage/lib/memoryCleanup'
import { canvasToThumbnailBlob } from '../../booklet-montage/lib/thumbnailCache'
import type { PieceSourceFile } from '../types'
import { blobToDataUrl, bytesToDataUrl, dataUrlToBytes, getPieceSourceKind } from './sourcePreview'

const EXPORT_DPI = 240
const MAX_EXPORT_RASTER_PX = 5000

export interface RasterTargetSize {
  widthCm: number
  heightCm: number
}

export interface RasterizedArtwork {
  bytes: Uint8Array
  mimeType: 'image/png' | 'image/jpeg'
  dataUrl: string
  widthPx: number
  heightPx: number
}

export async function sourceToSvgArtworkDataUrl(
  source: PieceSourceFile,
  target: RasterTargetSize
): Promise<string> {
  if (getPieceSourceKind(source) === 'pdf-page') {
    return (await rasterizePdfPageSource(source, target)).dataUrl
  }

  return bytesToDataUrl(source.bytes, source.mimeType)
}

export async function rasterizeSourceForPdf(
  source: PieceSourceFile,
  target: RasterTargetSize
): Promise<RasterizedArtwork> {
  const sourceKind = getPieceSourceKind(source)

  if (sourceKind === 'pdf-page') {
    return rasterizePdfPageSource(source, target)
  }

  if (source.mimeType === 'image/png') {
    return {
      bytes: source.bytes,
      mimeType: 'image/png',
      dataUrl: bytesToDataUrl(source.bytes, source.mimeType),
      widthPx: source.naturalWidthPx,
      heightPx: source.naturalHeightPx
    }
  }

  if (source.mimeType === 'image/jpeg' || source.mimeType === 'image/jpg') {
    return {
      bytes: source.bytes,
      mimeType: 'image/jpeg',
      dataUrl: bytesToDataUrl(source.bytes, 'image/jpeg'),
      widthPx: source.naturalWidthPx,
      heightPx: source.naturalHeightPx
    }
  }

  if (source.previewDataUrl && typeof document === 'undefined') {
    const preview = dataUrlToBytes(source.previewDataUrl)

    if (preview.mimeType === 'image/png' || preview.mimeType === 'image/jpeg') {
      return {
        bytes: preview.bytes,
        mimeType: preview.mimeType,
        dataUrl: source.previewDataUrl,
        widthPx: source.naturalWidthPx,
        heightPx: source.naturalHeightPx
      }
    }
  }

  return rasterizeSvgSource(source, target)
}

export function getRasterTargetSize(target: RasterTargetSize): {
  widthPx: number
  heightPx: number
} {
  const widthPx = Math.max(1, Math.round((target.widthCm / 2.54) * EXPORT_DPI))
  const heightPx = Math.max(1, Math.round((target.heightCm / 2.54) * EXPORT_DPI))
  const scale = Math.min(MAX_EXPORT_RASTER_PX / widthPx, MAX_EXPORT_RASTER_PX / heightPx, 1)

  return {
    widthPx: Math.max(1, Math.round(widthPx * scale)),
    heightPx: Math.max(1, Math.round(heightPx * scale))
  }
}

async function rasterizePdfPageSource(
  source: PieceSourceFile,
  target: RasterTargetSize
): Promise<RasterizedArtwork> {
  if (typeof document === 'undefined' && source.previewDataUrl) {
    const preview = dataUrlToBytes(source.previewDataUrl)

    if (preview.mimeType === 'image/png' || preview.mimeType === 'image/jpeg') {
      return {
        bytes: preview.bytes,
        mimeType: preview.mimeType,
        dataUrl: source.previewDataUrl,
        widthPx: source.naturalWidthPx,
        heightPx: source.naturalHeightPx
      }
    }
  }

  const { loadPdfDocument } = await import('../../booklet-montage/lib/pdfWorker')
  let pdf: Awaited<ReturnType<typeof loadPdfDocument>> | undefined

  try {
    pdf = await loadPdfDocument(source.bytes)
    const page = await pdf.getPage(source.pdfPageNumber ?? 1)

    try {
      const baseViewport = page.getViewport({ scale: 1 })
      const targetSize = getRasterTargetSize(target)
      const scale = Math.max(
        targetSize.widthPx / baseViewport.width,
        targetSize.heightPx / baseViewport.height
      )
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Could not create a canvas context for PDF artwork export.')
      }

      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      assertCanvasWithinLimit(canvas.width, canvas.height, 'exporting PDF page artwork')

      try {
        await page.render({ canvas, canvasContext: context, viewport }).promise

        return await canvasToRasterizedArtwork(canvas, 'image/png')
      } finally {
        resetCanvas(canvas)
      }
    } finally {
      page.cleanup()
    }
  } catch (error) {
    const { normalizePdfError } = await import('../../booklet-montage/lib/pdfWorker')

    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

async function rasterizeSvgSource(
  source: PieceSourceFile,
  target: RasterTargetSize
): Promise<RasterizedArtwork> {
  if (typeof document === 'undefined') {
    throw new Error('SVG artwork needs the browser renderer before it can be exported to PDF.')
  }

  const targetSize = getRasterTargetSize(target)
  const image = await loadImage(bytesToDataUrl(source.bytes, source.mimeType))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not create a canvas context for SVG artwork export.')
  }

  canvas.width = targetSize.widthPx
  canvas.height = targetSize.heightPx
  assertCanvasWithinLimit(canvas.width, canvas.height, 'rasterizing SVG artwork')

  try {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    return canvasToRasterizedArtwork(canvas, 'image/png')
  } finally {
    resetCanvas(canvas)
  }
}

async function canvasToRasterizedArtwork(
  canvas: HTMLCanvasElement,
  mimeType: 'image/png' | 'image/jpeg'
): Promise<RasterizedArtwork> {
  const blob = await canvasToThumbnailBlob(canvas, mimeType, 0.92)
  const bytes = new Uint8Array(await blob.arrayBuffer())

  return {
    bytes,
    mimeType,
    dataUrl: await blobToDataUrl(blob),
    widthPx: canvas.width,
    heightPx: canvas.height
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not render SVG artwork for PDF export.'))
    image.src = src
  })
}
