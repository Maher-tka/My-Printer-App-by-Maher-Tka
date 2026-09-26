import type { PieceSourceFile, PieceSourceKind } from '../types'
import { assertCanvasWithinLimit, resetCanvas } from '../../booklet-montage/lib/memoryCleanup'
import { canvasToThumbnailBlob } from '../../booklet-montage/lib/thumbnailCache'

export function getPieceSourceKind(source: PieceSourceFile): PieceSourceKind {
  if (source.sourceKind) return source.sourceKind
  if (source.pdfPageNumber || source.mimeType === 'application/pdf') return 'pdf-page'
  if (source.mimeType === 'image/svg+xml') return 'svg'
  return 'image'
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

/**
 * PDF-compatible Illustrator files often keep the .ai extension and report a
 * PostScript MIME type, but their file signature is still a PDF header. Read
 * only the first 1 KiB so callers can classify those files without loading the
 * complete source into memory a second time.
 */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
  const limit = Math.min(bytes.length - signature.length + 1, 1024)

  for (let offset = 0; offset < limit; offset += 1) {
    let matches = true

    for (let index = 0; index < signature.length; index += 1) {
      if (bytes[offset + index] !== signature[index]) {
        matches = false
        break
      }
    }

    if (matches) return true
  }

  return false
}

export function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
}

export function isRasterImageFile(file: File): boolean {
  return /image\/(png|jpeg)/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name)
}

export function isSupportedArtworkFile(file: File): boolean {
  return isRasterImageFile(file) || isSvgFile(file)
}

export function getArtworkMimeType(file: File): string {
  if (file.type) return file.type
  if (/\.svg$/i.test(file.name)) return 'image/svg+xml'
  if (/\.png$/i.test(file.name)) return 'image/png'
  return 'image/jpeg'
}

export interface TrimmedTransparentPng {
  bytes: Uint8Array
  widthPx: number
  heightPx: number
}

/** Crops only fully transparent outer pixels; opaque artwork pixels are preserved. */
export async function trimTransparentPng(bytes: Uint8Array): Promise<TrimmedTransparentPng | null> {
  if (typeof document === 'undefined') return null

  const url = URL.createObjectURL(new Blob([bytesToArrayBuffer(bytes)], { type: 'image/png' }))
  const image = await loadImage(url)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  try {
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (!width || !height) return null

    canvas.width = width
    canvas.height = height
    assertCanvasWithinLimit(width, height, 'trimming transparent artwork margins')
    context?.drawImage(image, 0, 0, width, height)
    if (!context) return null

    const pixels = context.getImageData(0, 0, width, height).data
    let left = width
    let top = height
    let right = -1
    let bottom = -1

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] > 0) {
          left = Math.min(left, x)
          top = Math.min(top, y)
          right = Math.max(right, x)
          bottom = Math.max(bottom, y)
        }
      }
    }

    if (right < left || (left === 0 && top === 0 && right === width - 1 && bottom === height - 1)) {
      return null
    }

    const trimmedWidth = right - left + 1
    const trimmedHeight = bottom - top + 1
    const trimmedCanvas = document.createElement('canvas')
    const trimmedContext = trimmedCanvas.getContext('2d')
    if (!trimmedContext) return null
    trimmedCanvas.width = trimmedWidth
    trimmedCanvas.height = trimmedHeight
    assertCanvasWithinLimit(trimmedWidth, trimmedHeight, 'creating trimmed artwork')
    trimmedContext.drawImage(
      image,
      left,
      top,
      trimmedWidth,
      trimmedHeight,
      0,
      0,
      trimmedWidth,
      trimmedHeight
    )
    const blob = await canvasToThumbnailBlob(trimmedCanvas, 'image/png', 1)
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      widthPx: trimmedWidth,
      heightPx: trimmedHeight
    }
  } finally {
    resetCanvas(canvas)
    URL.revokeObjectURL(url)
  }
}

export function getSourcePreviewUrl(
  source: Omit<PieceSourceFile, 'previewUrl'> & { previewUrl?: string }
): string {
  if (source.previewDataUrl) return source.previewDataUrl

  return URL.createObjectURL(
    new Blob([bytesToArrayBuffer(source.bytes)], { type: source.mimeType })
  )
}

export function getSourceBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

export function getPdfPageFileName(fileName: string, pageNumber: number): string {
  return `${getSourceBaseName(fileName)} - page ${pageNumber}.pdf`
}

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${uint8ToBase64(bytes)}`
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl)

  if (!match) {
    throw new Error('Unsupported preview data URL.')
  }

  return {
    mimeType: match[1],
    bytes: base64ToUint8Array(match[2])
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not read PNG artwork pixels.'))
    image.src = src
  })
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read rendered artwork preview.'))
    reader.readAsDataURL(blob)
  })
}

export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

function base64ToUint8Array(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}
