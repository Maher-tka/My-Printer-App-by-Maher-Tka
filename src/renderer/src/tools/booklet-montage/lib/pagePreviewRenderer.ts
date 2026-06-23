import type { PDFDocumentProxy } from 'pdfjs-dist'
import type {
  BookletPage,
  BookletSource,
  BookletScaleMode,
  Rect,
  SheetSettings
} from '../types'
import { getPerformanceSettingsSnapshot } from '../../../performance/performanceSettings'
import {
  assertCanvasWithinLimit,
  assertNotCanceled,
  createCanceledError,
  resetCanvas
} from './memoryCleanup'
import { getReadableTextColor, getSolidFillHex } from './colorUtils'
import { getPrintSizeMm } from './printSizes'
import { previewRenderQueue } from './renderQueue'

export type PagePreviewQuality = 'thumbnail' | 'medium' | 'fullPage3d'

export interface PagePreviewOptions {
  quality: PagePreviewQuality
  targetWidthPx?: number
  targetHeightPx?: number
  scaleMode?: BookletScaleMode
  signal?: AbortSignal
}

const PREVIEW_QUALITY: Record<PagePreviewQuality, number> = {
  thumbnail: 0.72,
  medium: 0.86,
  fullPage3d: 0.92
}

const PREVIEW_MAX_WIDTH: Record<PagePreviewQuality, number> = {
  thumbnail: 300,
  medium: 900,
  fullPage3d: 1200
}

const PREVIEW_MAX_HEIGHT: Record<PagePreviewQuality, number> = {
  thumbnail: 420,
  medium: 1200,
  fullPage3d: 1600
}

const previewUrlByKey = new Map<string, string>()
const previewKeyByUrl = new Map<string, string>()
const pdfDocumentBySourceId = new Map<string, PDFDocumentProxy>()
const pendingPdfDocumentBySourceId = new Map<string, Promise<PDFDocumentProxy>>()

export async function renderPagePreview(
  page: BookletPage,
  source: BookletSource | undefined,
  options: PagePreviewOptions
): Promise<string> {
  syncPreviewQueue()

  return previewRenderQueue.run(
    () => renderPagePreviewNow(page, source, options),
    options.signal,
    options.quality === 'fullPage3d' ? 6 : options.quality === 'medium' ? 4 : 1
  )
}

export async function renderPdfPagePreview(
  page: BookletPage,
  source: BookletSource,
  options: PagePreviewOptions
): Promise<string> {
  const cacheKey = getPagePreviewCacheKey(page, source, options)
  const cached = previewUrlByKey.get(cacheKey)

  if (cached) {
    return cached
  }

  const { canvas, context } = createPreviewCanvas(page, options)
  const targetRect = getCanvasRect(canvas)

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  try {
    assertNotCanceled(options.signal)

    if (page.sourcePageIndex === undefined) {
      throw new Error('PDF page index is missing.')
    }

    const pdf = await getPreviewPdfDocument(source, options.signal)
    const pdfPage = await pdf.getPage(page.sourcePageIndex + 1)
    const baseViewport = pdfPage.getViewport({ scale: 1 })
    const placement = getPreviewPlacement(
      { width: baseViewport.width, height: baseViewport.height },
      targetRect,
      options.scaleMode ?? 'fit'
    )
    const renderScale = Math.max(
      placement.width / baseViewport.width,
      placement.height / baseViewport.height,
      1
    )
    const viewport = pdfPage.getViewport({ scale: renderScale })
    const tempCanvas = document.createElement('canvas')
    const tempContext = tempCanvas.getContext('2d')

    if (!tempContext) {
      throw new Error('Could not create a canvas context for PDF preview rendering.')
    }

    tempCanvas.width = Math.max(Math.round(viewport.width), 1)
    tempCanvas.height = Math.max(Math.round(viewport.height), 1)
    assertCanvasWithinLimit(tempCanvas.width, tempCanvas.height, 'rendering PDF page previews')

    const renderTask = pdfPage.render({
      canvas: tempCanvas,
      canvasContext: tempContext,
      viewport
    })
    const abort = () => renderTask.cancel()

    options.signal?.addEventListener('abort', abort, { once: true })

    try {
      await renderTask.promise
      assertNotCanceled(options.signal)
      context.drawImage(tempCanvas, placement.x, placement.y, placement.width, placement.height)
    } catch (error) {
      if (options.signal?.aborted) {
        throw createCanceledError('Preview rendering canceled.')
      }

      throw error
    } finally {
      options.signal?.removeEventListener('abort', abort)
      pdfPage.cleanup()
      resetCanvas(tempCanvas)
    }

    return await cacheCanvasPreview(cacheKey, canvas, options.quality)
  } finally {
    resetCanvas(canvas)
  }
}

export async function renderImagePagePreview(
  page: BookletPage,
  source: BookletSource,
  options: PagePreviewOptions
): Promise<string> {
  const cacheKey = getPagePreviewCacheKey(page, source, options)
  const cached = previewUrlByKey.get(cacheKey)

  if (cached) {
    return cached
  }

  const { canvas, context } = createPreviewCanvas(page, options)
  const targetRect = getCanvasRect(canvas)

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const bitmap = await createImageBitmap(
    new Blob([bytesToArrayBuffer(source.bytes)], { type: source.mimeType })
  )

  try {
    assertNotCanceled(options.signal)

    const placement = getPreviewPlacement(
      { width: bitmap.width, height: bitmap.height },
      targetRect,
      options.scaleMode ?? 'fit'
    )

    context.drawImage(bitmap, placement.x, placement.y, placement.width, placement.height)

    return await cacheCanvasPreview(cacheKey, canvas, options.quality)
  } finally {
    bitmap.close()
    resetCanvas(canvas)
  }
}

export async function renderBlankPagePreview(
  page: BookletPage,
  options: PagePreviewOptions
): Promise<string> {
  const cacheKey = getPagePreviewCacheKey(page, undefined, options)
  const cached = previewUrlByKey.get(cacheKey)

  if (cached) {
    return cached
  }

  const { canvas, context } = createPreviewCanvas(page, options)

  try {
    const fillColor = getSolidFillHex(page.colorHex)

    context.fillStyle = fillColor
    context.fillRect(0, 0, canvas.width, canvas.height)

    if (options.quality !== 'fullPage3d') {
      context.fillStyle = getReadableTextColor(fillColor)
      context.font = `${Math.max(14, Math.round(canvas.width / 18))}px sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText('Blank Page', canvas.width / 2, canvas.height / 2)
    }

    return await cacheCanvasPreview(cacheKey, canvas, options.quality, 'image/png')
  } finally {
    resetCanvas(canvas)
  }
}

export function releasePagePreviewUrl(url: string): void {
  const key = previewKeyByUrl.get(url)

  if (!key) {
    return
  }

  URL.revokeObjectURL(url)
  previewKeyByUrl.delete(url)
  previewUrlByKey.delete(key)
}

export async function clearPagePreviewCache(): Promise<void> {
  for (const url of previewUrlByKey.values()) {
    URL.revokeObjectURL(url)
  }

  previewUrlByKey.clear()
  previewKeyByUrl.clear()
  pendingPdfDocumentBySourceId.clear()

  for (const pdf of pdfDocumentBySourceId.values()) {
    await pdf.destroy()
  }

  pdfDocumentBySourceId.clear()
}

export function getSinglePageAspectRatio(
  settings: SheetSettings,
  firstPage?: BookletPage
): number {
  return getBookPageAspectRatio(settings, firstPage)
}

export function getBookPageAspectRatio(
  settings: SheetSettings,
  firstPage?: BookletPage
): number {
  try {
    const printSize = getPrintSizeMm(settings)
    const foldedPageRatio = (printSize.widthMm / 2) / printSize.heightMm

    return clampAspectRatio(foldedPageRatio)
  } catch {
    if (firstPage && firstPage.widthMm > 0 && firstPage.heightMm > 0) {
      return clampAspectRatio(firstPage.widthMm / firstPage.heightMm)
    }

    return 0.707
  }
}

async function renderPagePreviewNow(
  page: BookletPage,
  source: BookletSource | undefined,
  options: PagePreviewOptions
): Promise<string> {
  assertNotCanceled(options.signal)

  if (page.sourceType === 'blank') {
    return renderBlankPagePreview(page, options)
  }

  if (!source) {
    return page.thumbnailUrl ?? renderBlankPagePreview(page, options)
  }

  if (page.sourceType === 'pdf') {
    return renderPdfPagePreview(page, source, options)
  }

  return renderImagePagePreview(page, source, options)
}

function getPagePreviewCacheKey(
  page: BookletPage,
  source: BookletSource | undefined,
  options: PagePreviewOptions
): string {
  return [
    options.quality,
    options.targetWidthPx ?? 'auto',
    options.targetHeightPx ?? 'auto',
    options.scaleMode ?? 'fit',
    page.id,
    page.sourceType,
    page.sourceId ?? 'none',
    page.sourcePageIndex ?? 'none',
    page.colorHex ?? 'none',
    page.widthMm,
    page.heightMm,
    source?.name ?? 'no-source'
  ].join(':')
}

function createPreviewCanvas(
  page: BookletPage,
  options: PagePreviewOptions
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const size = getPreviewCanvasSize(page, options)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not create a canvas context for page preview rendering.')
  }

  canvas.width = size.width
  canvas.height = size.height
  assertCanvasWithinLimit(canvas.width, canvas.height, 'rendering page previews')

  return { canvas, context }
}

function getPreviewCanvasSize(
  page: BookletPage,
  options: PagePreviewOptions
): { width: number; height: number } {
  if (options.targetWidthPx && options.targetHeightPx) {
    return {
      width: Math.max(Math.round(options.targetWidthPx), 1),
      height: Math.max(Math.round(options.targetHeightPx), 1)
    }
  }

  const aspectRatio =
    page.widthMm > 0 && page.heightMm > 0
      ? clampAspectRatio(page.widthMm / page.heightMm)
      : 0.707
  const performanceSettings = getPerformanceSettingsSnapshot()
  const maxWidth =
    options.quality === 'thumbnail'
      ? performanceSettings.render.thumbnailMaxSizePx
      : options.quality === 'fullPage3d'
        ? performanceSettings.render.fullPage3dMaxWidthPx
        : Math.min(PREVIEW_MAX_WIDTH[options.quality], performanceSettings.render.previewMaxWidthPx)
  const maxHeight =
    options.quality === 'thumbnail'
      ? Math.round(performanceSettings.render.thumbnailMaxSizePx * 1.45)
      : options.quality === 'fullPage3d'
        ? performanceSettings.render.fullPage3dMaxHeightPx
        : Math.min(PREVIEW_MAX_HEIGHT[options.quality], performanceSettings.render.previewMaxHeightPx)
  const widthFromHeight = maxHeight * aspectRatio

  if (widthFromHeight <= maxWidth) {
    return {
      width: Math.max(Math.round(widthFromHeight), 1),
      height: maxHeight
    }
  }

  return {
    width: maxWidth,
    height: Math.max(Math.round(maxWidth / aspectRatio), 1)
  }
}

function getCanvasRect(canvas: HTMLCanvasElement): Rect {
  return {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height
  }
}

function getPreviewPlacement(
  naturalSize: { width: number; height: number },
  targetRect: Rect,
  scaleMode: BookletScaleMode
): Rect {
  if (scaleMode === 'stretch') {
    return { ...targetRect }
  }

  const widthScale = targetRect.width / naturalSize.width
  const heightScale = targetRect.height / naturalSize.height
  const scale =
    scaleMode === 'original'
      ? Math.min(1, widthScale, heightScale)
      : Math.min(widthScale, heightScale)
  const width = naturalSize.width * scale
  const height = naturalSize.height * scale

  return {
    x: targetRect.x + (targetRect.width - width) / 2,
    y: targetRect.y + (targetRect.height - height) / 2,
    width,
    height
  }
}

async function cacheCanvasPreview(
  key: string,
  canvas: HTMLCanvasElement,
  quality: PagePreviewQuality,
  mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<string> {
  const performanceSettings = getPerformanceSettingsSnapshot()
  const jpegQuality =
    quality === 'fullPage3d'
      ? performanceSettings.render.fullPage3dJpegQuality
      : quality === 'thumbnail'
        ? performanceSettings.render.thumbnailJpegQuality
        : PREVIEW_QUALITY[quality]
  const blob = await canvasToPreviewBlob(canvas, jpegQuality, mimeType)
  const url = URL.createObjectURL(blob)

  previewUrlByKey.set(key, url)
  previewKeyByUrl.set(url, key)
  trimPreviewCache()

  return url
}

async function getPreviewPdfDocument(
  source: BookletSource,
  signal?: AbortSignal
): Promise<PDFDocumentProxy> {
  const cached = pdfDocumentBySourceId.get(source.id)

  if (cached) {
    return cached
  }

  const pending = pendingPdfDocumentBySourceId.get(source.id)

  if (pending) {
    return pending
  }

  const promise = import('./pdfWorker')
    .then(({ loadPdfDocument }) => loadPdfDocument(source.bytes, signal))
    .then((pdf) => {
      pendingPdfDocumentBySourceId.delete(source.id)
      pdfDocumentBySourceId.set(source.id, pdf)
      return pdf
    })
    .catch((error) => {
      pendingPdfDocumentBySourceId.delete(source.id)
      throw error
    })

  pendingPdfDocumentBySourceId.set(source.id, promise)

  return promise
}

function canvasToPreviewBlob(
  canvas: HTMLCanvasElement,
  quality: number,
  mimeType: 'image/jpeg' | 'image/png'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not generate page preview.'))
          return
        }

        resolve(blob)
      },
      mimeType,
      mimeType === 'image/jpeg' ? quality : undefined
    )
  })
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function clampAspectRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 0.707
  }

  return Math.max(0.35, Math.min(ratio, 1.45))
}

function syncPreviewQueue(): void {
  previewRenderQueue.setConcurrency(getPerformanceSettingsSnapshot().render.renderConcurrency)
}

function trimPreviewCache(): void {
  const limit = getPerformanceSettingsSnapshot().memory.objectUrlCacheLimit

  if (previewUrlByKey.size <= limit) {
    return
  }

  const keysToRemove = [...previewUrlByKey.keys()].slice(0, previewUrlByKey.size - limit)

  for (const key of keysToRemove) {
    const url = previewUrlByKey.get(key)

    if (url) {
      URL.revokeObjectURL(url)
      previewKeyByUrl.delete(url)
    }

    previewUrlByKey.delete(key)
  }
}
