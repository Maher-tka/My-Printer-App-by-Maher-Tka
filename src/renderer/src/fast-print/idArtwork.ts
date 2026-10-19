import { detectIdCrop, idCardPlacement, type IdCrop } from '../../../shared/fast-print-id'
import type { FastPrintPreset } from '../../../shared/fast-print'
import { loadPdfDocument, destroyPdfDocument } from '../tools/booklet-montage/lib/pdfWorker'
import { getPerformancePreset } from '@/performance/performanceSettings'

export interface IdArtwork {
  id: string
  name: string
  canvas: HTMLCanvasElement
}
export interface IdSide {
  sourceId: string
  turns: number
  crop: IdCrop
  angleDegrees?: number
}

export async function loadIdArtwork(
  name: string,
  extension: string,
  bytes: Uint8Array
): Promise<IdArtwork[]> {
  const result: IdArtwork[] = []
  const maxSize = getPerformancePreset() === 'low-end' ? 1400 : 2200
  function add(canvas: HTMLCanvasElement, label: string) {
    result.push({
      id: crypto.randomUUID(),
      name: label,
      canvas
    })
  }
  if (extension === '.pdf') {
    const pdf = await loadPdfDocument(new Uint8Array(bytes))
    try {
      if (pdf.numPages > 8) throw new Error('Choose up to 8 images or PDF pages for one ID job.')
      for (let index = 1; index <= pdf.numPages; index++) {
        const page = await pdf.getPage(index)
        try {
          const original = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({
            scale: Math.min(3, maxSize / Math.max(original.width, original.height))
          })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvas, viewport, background: '#ffffff' }).promise
          add(canvas, pdf.numPages === 1 ? name : `${name} · ${index}`)
        } finally {
          page.cleanup()
        }
      }
    } finally {
      await destroyPdfDocument(pdf)
    }
  } else {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]))
    try {
      const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      add(canvas, name)
    } finally {
      bitmap.close()
    }
  }
  return result
}

export function orientIdArtwork(source: IdArtwork, turns: number): HTMLCanvasElement {
  if (turns % 4 === 0) return source.canvas
  const canvas = document.createElement('canvas')
  canvas.width = turns % 2 ? source.canvas.height : source.canvas.width
  canvas.height = turns % 2 ? source.canvas.width : source.canvas.height
  const context = canvas.getContext('2d')!
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((turns * Math.PI) / 2)
  context.drawImage(source.canvas, -source.canvas.width / 2, -source.canvas.height / 2)
  return canvas
}

export function autoIdCrop(canvas: HTMLCanvasElement): IdCrop {
  const small = document.createElement('canvas')
  const scale = Math.min(1, 320 / Math.max(canvas.width, canvas.height))
  small.width = Math.max(1, Math.round(canvas.width * scale))
  small.height = Math.max(1, Math.round(canvas.height * scale))
  const context = small.getContext('2d', { willReadFrequently: true })!
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, small.width, small.height)
  context.drawImage(canvas, 0, 0, small.width, small.height)
  return detectIdCrop(
    context.getImageData(0, 0, small.width, small.height).data,
    small.width,
    small.height
  )
}

export function drawIdSheet(
  artwork: HTMLCanvasElement,
  crop: IdCrop,
  preset: FastPrintPreset,
  dpi = 300,
  angleDegrees?: number
): HTMLCanvasElement {
  const placement = idCardPlacement(
    artwork.width,
    artwork.height,
    crop,
    preset.paper,
    preset.landscape,
    angleDegrees
  )
  const factor = dpi / 25.4
  const sheet = document.createElement('canvas')
  sheet.width = Math.round(placement.paperWidth * factor)
  sheet.height = Math.round(placement.paperHeight * factor)
  const context = sheet.getContext('2d')!
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, sheet.width, sheet.height)
  const scale = (90 * factor) / placement.width
  const x = placement.xMm * factor - placement.left * scale
  const y = placement.yMm * factor - placement.top * scale
  context.save()
  context.beginPath()
  crop.forEach((point, index) => {
    const px =
        x +
        (point.x * artwork.width * placement.cos + point.y * artwork.height * placement.sin) *
          scale,
      py =
        y +
        (-point.x * artwork.width * placement.sin + point.y * artwork.height * placement.cos) *
          scale
    if (index === 0) context.moveTo(px, py)
    else context.lineTo(px, py)
  })
  context.closePath()
  context.clip()
  context.filter = preset.color ? 'none' : 'grayscale(1)'
  context.transform(
    scale * placement.cos,
    -scale * placement.sin,
    scale * placement.sin,
    scale * placement.cos,
    x,
    y
  )
  context.drawImage(artwork, 0, 0)
  context.restore()
  return sheet
}
