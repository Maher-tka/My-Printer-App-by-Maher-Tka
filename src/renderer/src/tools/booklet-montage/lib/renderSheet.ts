import {
  type PDFDocument,
  type PDFEmbeddedPage,
  type PDFImage,
  type PDFPage,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle
} from 'pdf-lib'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type {
  BookletPage,
  BookletSheet,
  BookletSide,
  BookletSlot,
  BookletSource,
  Rect,
  SheetSettings
} from '../types'
import {
  drawCanvasCropMarks,
  drawCanvasRegistrationMarks,
  drawPdfCropMarks,
  drawPdfRegistrationMarks,
  rectMmToCanvasPixels,
  rectMmToPoints
} from './cropMarks'
import {
  assertCanvasWithinLimit,
  assertNotCanceled,
  createCanceledError,
  resetCanvas
} from './memoryCleanup'
import type { SheetLayoutMm } from './printSizes'
import { mmToPixels, mmToPoints } from './units'

export interface PdfRenderAssets {
  pdf: PDFDocument
  sourceMap: Map<string, BookletSource>
  pdfPages: Map<string, PDFEmbeddedPage>
  images: Map<string, PDFImage>
}

export interface CanvasRenderAssets {
  sourceMap: Map<string, BookletSource>
  pdfCache: Map<string, PDFDocumentProxy>
  imageCache: Map<string, ImageBitmap>
}

export async function preparePdfRenderAssets(
  pdf: PDFDocument,
  _sheets: BookletSheet[],
  sources: BookletSource[],
  signal?: AbortSignal
): Promise<PdfRenderAssets> {
  assertNotCanceled(signal)

  const sourceMap = new Map(sources.map((source) => [source.id, source]))

  return { pdf, sourceMap, pdfPages: new Map(), images: new Map() }
}

export function createCanvasRenderAssets(sources: BookletSource[]): CanvasRenderAssets {
  return {
    sourceMap: new Map(sources.map((source) => [source.id, source])),
    pdfCache: new Map(),
    imageCache: new Map()
  }
}

export async function releaseCanvasRenderAssets(assets: CanvasRenderAssets): Promise<void> {
  for (const pdf of assets.pdfCache.values()) {
    await pdf.destroy()
  }

  for (const image of assets.imageCache.values()) {
    image.close()
  }

  assets.pdfCache.clear()
  assets.imageCache.clear()
}

export async function renderPdfSheetSide(
  pdfPage: PDFPage,
  side: BookletSide,
  settings: SheetSettings,
  layout: SheetLayoutMm,
  assets: PdfRenderAssets,
  signal?: AbortSignal
): Promise<void> {
  assertNotCanceled(signal)
  await drawPdfSlot(pdfPage, side.left, layout.renderSlots.left, settings, assets, signal)
  await drawPdfSlot(pdfPage, side.right, layout.renderSlots.right, settings, assets, signal)

  if (settings.cropMarks) {
    drawPdfCropMarks(pdfPage, layout.trimSlots.left)
    drawPdfCropMarks(pdfPage, layout.trimSlots.right)
  }

  if (settings.registrationMarks) {
    drawPdfRegistrationMarks(pdfPage, layout.paperSize)
  }
}

export async function renderCanvasSheetSide(
  context: CanvasRenderingContext2D,
  side: BookletSide,
  settings: SheetSettings,
  layout: SheetLayoutMm,
  assets: CanvasRenderAssets,
  dpi: number,
  signal?: AbortSignal
): Promise<void> {
  assertNotCanceled(signal)
  await drawCanvasSlot(context, side.left, layout.renderSlots.left, settings, layout, assets, dpi, signal)
  await drawCanvasSlot(context, side.right, layout.renderSlots.right, settings, layout, assets, dpi, signal)

  if (settings.cropMarks) {
    drawCanvasCropMarks(context, layout.trimSlots.left, layout.paperSize, dpi)
    drawCanvasCropMarks(context, layout.trimSlots.right, layout.paperSize, dpi)
  }

  if (settings.registrationMarks) {
    drawCanvasRegistrationMarks(context, layout.paperSize, dpi)
  }
}

export function getSheetSideFileName(
  sheetNumber: number,
  side: BookletSide['side'],
  extension: string
): string {
  return `booklet_sheet_${String(sheetNumber).padStart(3, '0')}_${side}.${extension}`
}

export function getPlacement(
  naturalSize: { width: number; height: number },
  targetRect: Rect,
  scaleMode: SheetSettings['scaleMode']
): Rect {
  if (scaleMode === 'stretch') {
    return { ...targetRect }
  }

  const widthScale = targetRect.width / naturalSize.width
  const heightScale = targetRect.height / naturalSize.height
  const scale = scaleMode === 'fill' ? Math.max(widthScale, heightScale) : Math.min(widthScale, heightScale)
  const width = naturalSize.width * scale
  const height = naturalSize.height * scale

  return {
    x: targetRect.x + (targetRect.width - width) / 2,
    y: targetRect.y + (targetRect.height - height) / 2,
    width,
    height
  }
}

export function flattenSheetSides(sheets: BookletSheet[]): BookletSide[] {
  return sheets.flatMap((sheet) => [sheet.front, sheet.back])
}

async function drawPdfSlot(
  pdfPage: PDFPage,
  slot: BookletSlot,
  slotRectMm: Rect,
  settings: SheetSettings,
  assets: PdfRenderAssets,
  signal?: AbortSignal
): Promise<void> {
  assertNotCanceled(signal)

  const page = slot.page

  if (page.kind === 'blank') {
    return
  }

  const slotRect = rectMmToPoints(slotRectMm)
  const naturalSize = { width: mmToPoints(page.widthMm), height: mmToPoints(page.heightMm) }
  const placement = getPlacement(naturalSize, slotRect, settings.scaleMode)

  pdfPage.pushOperators(
    pushGraphicsState(),
    rectangle(slotRect.x, slotRect.y, slotRect.width, slotRect.height),
    clip(),
    endPath()
  )

  if (page.kind === 'pdf' && page.sourceId && page.sourcePageIndex !== undefined) {
    const embeddedPage = await getEmbeddedPdfPage(assets, page.sourceId, page.sourcePageIndex, signal)

    if (embeddedPage) {
      pdfPage.drawPage(embeddedPage, placement)
    }
  }

  if (page.kind === 'image' && page.sourceId) {
    const image = await getEmbeddedImage(assets, page.sourceId, signal)

    if (image) {
      pdfPage.drawImage(image, placement)
    }
  }

  pdfPage.pushOperators(popGraphicsState())
}

async function drawCanvasSlot(
  context: CanvasRenderingContext2D,
  slot: BookletSlot,
  slotRectMm: Rect,
  settings: SheetSettings,
  layout: SheetLayoutMm,
  assets: CanvasRenderAssets,
  dpi: number,
  signal?: AbortSignal
): Promise<void> {
  assertNotCanceled(signal)

  const page = slot.page

  if (page.kind === 'blank') {
    return
  }

  const slotRect = rectMmToCanvasPixels(slotRectMm, layout.paperSize, dpi)
  const naturalSize = {
    width: mmToPixels(page.widthMm, dpi),
    height: mmToPixels(page.heightMm, dpi)
  }
  const placement = getPlacement(naturalSize, slotRect, settings.scaleMode)

  context.save()
  context.beginPath()
  context.rect(slotRect.x, slotRect.y, slotRect.width, slotRect.height)
  context.clip()

  try {
    if (page.kind === 'image' && page.sourceId) {
      const bitmap = await getImageBitmap(page.sourceId, assets, signal)

      if (bitmap) {
        context.drawImage(bitmap, placement.x, placement.y, placement.width, placement.height)
      }
    }

    if (page.kind === 'pdf' && page.sourceId && page.sourcePageIndex !== undefined) {
      await drawPdfPageToCanvas(context, page, placement, assets, signal)
    }
  } finally {
    context.restore()
  }
}

async function drawPdfPageToCanvas(
  context: CanvasRenderingContext2D,
  page: BookletPage,
  placement: Rect,
  assets: CanvasRenderAssets,
  signal?: AbortSignal
): Promise<void> {
  assertNotCanceled(signal)

  if (!page.sourceId || page.sourcePageIndex === undefined) {
    return
  }

  const source = assets.sourceMap.get(page.sourceId)

  if (!source) {
    return
  }

  let pdf = assets.pdfCache.get(source.id)

  if (!pdf) {
    const { loadPdfDocument } = await import('./pdfWorker')
    pdf = await loadPdfDocument(source.bytes, signal)
    assets.pdfCache.set(source.id, pdf)
  }

  const pdfPage = await pdf.getPage(page.sourcePageIndex + 1)
  const baseViewport = pdfPage.getViewport({ scale: 1 })
  const renderScale = Math.max(
    placement.width / baseViewport.width,
    placement.height / baseViewport.height,
    1
  )
  const viewport = pdfPage.getViewport({ scale: renderScale })
  const tempCanvas = document.createElement('canvas')
  const tempContext = tempCanvas.getContext('2d')

  if (!tempContext) {
    throw new Error('Could not create a canvas context for PDF page image export.')
  }

  tempCanvas.width = Math.max(Math.round(viewport.width), 1)
  tempCanvas.height = Math.max(Math.round(viewport.height), 1)
  assertCanvasWithinLimit(tempCanvas.width, tempCanvas.height, 'rendering PDF pages for image export')

  const renderTask = pdfPage.render({ canvas: tempCanvas, canvasContext: tempContext, viewport })
  const abort = () => renderTask.cancel()

  signal?.addEventListener('abort', abort, { once: true })

  try {
    await renderTask.promise
    assertNotCanceled(signal)
    context.drawImage(tempCanvas, placement.x, placement.y, placement.width, placement.height)
  } catch (error) {
    if (signal?.aborted) {
      throw createCanceledError('Export canceled.')
    }

    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
    pdfPage.cleanup()
    resetCanvas(tempCanvas)
  }
}

async function getImageBitmap(
  sourceId: string,
  assets: CanvasRenderAssets,
  signal?: AbortSignal
): Promise<ImageBitmap | undefined> {
  assertNotCanceled(signal)

  const cached = assets.imageCache.get(sourceId)

  if (cached) {
    return cached
  }

  const source = assets.sourceMap.get(sourceId)

  if (!source) {
    return undefined
  }

  const bitmap = await createImageBitmap(
    new Blob([bytesToArrayBuffer(source.bytes)], { type: source.mimeType })
  )
  assets.imageCache.set(sourceId, bitmap)

  return bitmap
}

async function getEmbeddedPdfPage(
  assets: PdfRenderAssets,
  sourceId: string,
  pageIndex: number,
  signal?: AbortSignal
): Promise<PDFEmbeddedPage | undefined> {
  const cacheKey = getPdfPageCacheKey(sourceId, pageIndex)
  const cached = assets.pdfPages.get(cacheKey)

  if (cached) {
    return cached
  }

  assertNotCanceled(signal)

  const source = assets.sourceMap.get(sourceId)

  if (!source) {
    return undefined
  }

  const [embeddedPage] = await assets.pdf.embedPdf(source.bytes, [pageIndex])
  assets.pdfPages.set(cacheKey, embeddedPage)

  return embeddedPage
}

async function getEmbeddedImage(
  assets: PdfRenderAssets,
  sourceId: string,
  signal?: AbortSignal
): Promise<PDFImage | undefined> {
  const cached = assets.images.get(sourceId)

  if (cached) {
    return cached
  }

  assertNotCanceled(signal)

  const source = assets.sourceMap.get(sourceId)

  if (!source) {
    return undefined
  }

  const embeddedImage =
    source.mimeType === 'image/png'
      ? await assets.pdf.embedPng(source.bytes)
      : await assets.pdf.embedJpg(source.bytes)

  assets.images.set(sourceId, embeddedImage)

  return embeddedImage
}

function getPdfPageCacheKey(sourceId: string, pageIndex: number): string {
  return `${sourceId}:${pageIndex}`
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
