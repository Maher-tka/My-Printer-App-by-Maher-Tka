import {
  detectIdCrop,
  idCardPlacement,
  initialIdSide,
  idCopiesLayout,
  idCopyCenters,
  DEFAULT_ID_SHEET_SETTINGS,
  type IdSheetSettings,
  type IdCopiesLayout,
  rotateIdSide,
  type IdSide,
  type IdCrop
} from '../../../shared/fast-print-id'
export type { IdSide } from '../../../shared/fast-print-id'
import type { FastPrintPreset } from '../../../shared/fast-print'
import { loadPdfDocument, destroyPdfDocument } from '../tools/booklet-montage/lib/pdfWorker'
import { getPerformancePreset } from '@/performance/performanceSettings'
import { idHeaderOrientation } from '../../../shared/id-orientation'
import { rectifyIdPixels } from '../../../shared/id-card-perspective'
import type { IdTextOrientationReader } from './idTextOrientation'

export interface IdArtwork {
  id: string
  name: string
  canvas: HTMLCanvasElement
}

export function autoIdSide(source: IdArtwork) {
  return initialIdSide(
    source.id,
    source.canvas.width,
    source.canvas.height,
    autoIdCrop(source.canvas)
  )
}

/** Geometry is cheap; load the offline text reader only when the header cannot decide. */
export class IdAutoAnalyzer {
  private cache = new Map<string, Promise<IdSide>>()
  private reader?: IdTextOrientationReader
  private stopped = false
  dispose(): void {
    this.stopped = true
    this.reader?.dispose()
  }
  analyze(source: IdArtwork): Promise<IdSide> {
    const cached = this.cache.get(source.id)
    if (cached) return cached
    const result = this.orient(source, autoIdSide(source))
    this.cache.set(source.id, result)
    return result
  }
  async orient(source: IdArtwork, side: IdSide): Promise<IdSide> {
    const art = orientIdArtwork(source, side.turns)
    const placement = idCardPlacement(
      art.width,
      art.height,
      side.crop,
      'A4',
      false,
      side.angleDegrees
    )
    const card = document.createElement('canvas'),
      scale = 900 / placement.width
    card.width = 900
    card.height = Math.max(1, Math.round(placement.height * scale))
    const context = card.getContext('2d', { willReadFrequently: true })!
    context.fillStyle = '#fff'
    context.fillRect(0, 0, card.width, card.height)
    context.transform(
      scale * placement.cos,
      -scale * placement.sin,
      scale * placement.sin,
      scale * placement.cos,
      -placement.left * scale,
      -placement.top * scale
    )
    context.drawImage(art, 0, 0)
    const pixels = context.getImageData(0, 0, card.width, card.height)
    let orientation = idHeaderOrientation(pixels.data, card.width, card.height)
    try {
      if (orientation === null) {
        const { IdTextOrientationReader } = await import('./idTextOrientation')
        if (this.stopped) return side
        this.reader ??= new IdTextOrientationReader()
        orientation = await this.reader.read(card)
      }
    } catch {
      /* Keep the editable crop when recognition is unavailable or ambiguous. */
    } finally {
      card.width = card.height = 0
      if (art !== source.canvas) art.width = art.height = 0
    }
    return orientation === 2
      ? {
          ...rotateIdSide(side, 2),
          ...(side.angleDegrees === undefined ? {} : { angleDegrees: side.angleDegrees })
        }
      : { ...side, orientationVerified: orientation === 0 }
  }
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

const rectifiedCards = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>()
export function rectifyIdArtwork(
  artwork: HTMLCanvasElement,
  crop: IdCrop,
  width: number,
  height: number
): HTMLCanvasElement {
  let cache = rectifiedCards.get(artwork)
  if (!cache) {
    cache = new Map()
    rectifiedCards.set(artwork, cache)
  }
  const key = JSON.stringify([crop, width, height]),
    previous = cache.get(key)
  if (previous) return previous
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const source = artwork
    .getContext('2d', { willReadFrequently: true })!
    .getImageData(0, 0, artwork.width, artwork.height)
  const pixels = rectifyIdPixels(source.data, artwork.width, artwork.height, crop, width, height)
  canvas
    .getContext('2d')!
    .putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0)
  if (cache.size >= 4) cache.delete(cache.keys().next().value!)
  cache.set(key, canvas)
  return canvas
}
export function drawIdSheet(
  artwork: HTMLCanvasElement,
  crop: IdCrop,
  preset: FastPrintPreset,
  dpi = 300,
  _angleDegrees?: number,
  copies?: {
    count: number
    cellHeightMm: number
    cellWidthMm?: number
    back?: boolean
    settings?: IdSheetSettings
    sheetTurns?: number
    layout?: IdCopiesLayout
  }
): HTMLCanvasElement {
  const settings = copies?.settings ?? DEFAULT_ID_SHEET_SETTINGS,
    factor = dpi / 25.4
  const card = rectifyIdArtwork(
    artwork,
    crop,
    Math.round(90 * factor),
    Math.round(settings.heightMm * factor)
  )
  const layout =
    copies?.layout ??
    idCopiesLayout(
      preset.paper,
      preset.landscape === true,
      [copies?.cellHeightMm ?? settings.heightMm],
      copies?.count ?? 1,
      {
        cellWidthMm: copies?.cellWidthMm ?? 90,
        marginMm: settings.marginMm,
        gapMm: settings.gapMm,
        spacing: settings.spacing
      }
    )
  const sheet = document.createElement('canvas')
  sheet.width = Math.round(layout.paperWidth * factor)
  sheet.height = Math.round(layout.paperHeight * factor)
  const context = sheet.getContext('2d')!
  context.fillStyle = '#fff'
  context.fillRect(0, 0, sheet.width, sheet.height)
  for (const center of idCopyCenters(layout, copies?.back)) {
    context.save()
    context.translate(center.x * factor, center.y * factor)
    context.rotate((((copies?.sheetTurns ?? 0) % 2 ? 0 : (copies?.sheetTurns ?? 0)) * Math.PI) / 2)
    context.filter = preset.color ? 'none' : 'grayscale(1)'
    context.drawImage(
      card,
      -45 * factor,
      (-settings.heightMm / 2) * factor,
      90 * factor,
      settings.heightMm * factor
    )
    context.restore()
  }
  return sheet
}
