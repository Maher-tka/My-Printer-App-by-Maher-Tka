import type { PDFPageProxy } from 'pdfjs-dist'
import { getPerformanceSettingsSnapshot } from '../../../performance/performanceSettings'
import { assertCanvasWithinLimit, resetCanvas } from '../../booklet-montage/lib/memoryCleanup'
import { loadPdfDocument, normalizePdfError } from '../../booklet-montage/lib/pdfWorker'
import {
  canvasToThumbnailBlob,
  getOrCreateThumbnailUrl
} from '../../booklet-montage/lib/thumbnailCache'
import type { HardcoverPdfPagePreview, HardcoverPdfSource } from '../types'
import { isValidHardcoverPageNumber } from './coverCalculations'

type HardcoverPdfPageTarget = 'front' | 'back'

export async function importHardcoverPdfSource(file: File): Promise<HardcoverPdfSource> {
  if (file.type && file.type !== 'application/pdf') {
    throw new Error(`${file.name} is not a PDF file.`)
  }
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error(`${file.name} is not a PDF file.`)
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const source: HardcoverPdfSource = {
    fileName: file.name,
    filePath: getFilePath(file),
    pageCount: 0,
    frontPageNumber: 1,
    backCoverEnabled: false,
    fitMode: 'fit',
    pagePreviews: [],
    bytes
  }

  let pdf: Awaited<ReturnType<typeof loadPdfDocument>> | undefined

  try {
    pdf = await loadPdfDocument(bytes)
    const pagePreviews = await renderHardcoverPdfPagePreviews(file.name, pdf)
    const firstPage = pagePreviews[0]

    return {
      ...source,
      pageCount: pdf.numPages,
      frontPageRotation: firstPage?.rotation ?? 0,
      thumbnailDataUrl: firstPage?.thumbnailDataUrl,
      pagePreviews
    }
  } catch (error) {
    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

export async function selectHardcoverPdfFrontPage(
  source: HardcoverPdfSource,
  pageNumber: number
): Promise<HardcoverPdfSource> {
  return selectHardcoverPdfPage(source, 'front', pageNumber)
}

export async function selectHardcoverPdfBackPage(
  source: HardcoverPdfSource,
  pageNumber: number
): Promise<HardcoverPdfSource> {
  return selectHardcoverPdfPage(source, 'back', pageNumber)
}

export async function setHardcoverPdfBackCoverEnabled(
  source: HardcoverPdfSource,
  enabled: boolean
): Promise<HardcoverPdfSource> {
  if (!enabled) {
    return {
      ...source,
      backCoverEnabled: false,
      backPageNumber: undefined,
      backPageRotation: undefined,
      backThumbnailDataUrl: undefined
    }
  }

  return selectHardcoverPdfBackPage(
    source,
    source.backPageNumber ?? Math.max(1, Math.min(2, source.pageCount))
  )
}

async function selectHardcoverPdfPage(
  source: HardcoverPdfSource,
  target: HardcoverPdfPageTarget,
  pageNumber: number
): Promise<HardcoverPdfSource> {
  if (!isValidHardcoverPageNumber(pageNumber, source.pageCount)) {
    throw new Error(`Choose a page between 1 and ${source.pageCount}.`)
  }

  const cachedPreview = findPagePreview(source, pageNumber)
  if (!source.bytes) {
    return applyPdfPageSelection(source, target, pageNumber, cachedPreview)
  }

  let pdf: Awaited<ReturnType<typeof loadPdfDocument>> | undefined

  try {
    pdf = await loadPdfDocument(source.bytes)
    const preview =
      cachedPreview ?? (await renderHardcoverPdfPagePreview(source.fileName, pdf, pageNumber))
    const pagePreviews = upsertPagePreview(source.pagePreviews ?? [], preview)

    return applyPdfPageSelection({ ...source, pagePreviews }, target, pageNumber, preview)
  } catch (error) {
    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

async function renderHardcoverPdfPagePreviews(
  fileName: string,
  pdf: Awaited<ReturnType<typeof loadPdfDocument>>
): Promise<HardcoverPdfPagePreview[]> {
  const previews: HardcoverPdfPagePreview[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    previews.push(await renderHardcoverPdfPagePreview(fileName, pdf, pageNumber))
  }

  return previews
}

async function renderHardcoverPdfPagePreview(
  fileName: string,
  pdf: Awaited<ReturnType<typeof loadPdfDocument>>,
  pageNumber: number
): Promise<HardcoverPdfPagePreview> {
  const page = await pdf.getPage(pageNumber)

  try {
    return {
      pageNumber,
      rotation: page.rotate ?? 0,
      thumbnailDataUrl: await renderHardcoverPdfThumbnail(fileName, page, pageNumber)
    }
  } finally {
    page.cleanup()
  }
}

async function renderHardcoverPdfThumbnail(
  fileName: string,
  page: PDFPageProxy,
  pageNumber: number
): Promise<string> {
  const performanceSettings = getPerformanceSettingsSnapshot()
  const maxWidth = performanceSettings.render.thumbnailMaxSizePx
  const maxHeight = Math.round(maxWidth * 1.45)
  const quality = performanceSettings.render.thumbnailJpegQuality
  const viewport = page.getViewport({ scale: 1 })
  const scale = Math.min(maxWidth / viewport.width, maxHeight / viewport.height, 1)
  const renderViewport = page.getViewport({ scale })
  const cacheKey = `hardcover:${fileName}:${pageNumber}:${maxWidth}:${quality}`

  return getOrCreateThumbnailUrl(cacheKey, async () => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Could not create a canvas context for PDF thumbnail rendering.')
    }

    canvas.width = Math.max(Math.floor(renderViewport.width), 1)
    canvas.height = Math.max(Math.floor(renderViewport.height), 1)
    assertCanvasWithinLimit(canvas.width, canvas.height, 'generating hardcover PDF thumbnail')

    try {
      await page.render({ canvas, canvasContext: context, viewport: renderViewport }).promise
      return canvasToThumbnailBlob(canvas, 'image/jpeg', quality)
    } finally {
      resetCanvas(canvas)
    }
  })
}

function applyPdfPageSelection(
  source: HardcoverPdfSource,
  target: HardcoverPdfPageTarget,
  pageNumber: number,
  preview: HardcoverPdfPagePreview | undefined
): HardcoverPdfSource {
  if (target === 'back') {
    return {
      ...source,
      backCoverEnabled: true,
      backPageNumber: pageNumber,
      backPageRotation: preview?.rotation,
      backThumbnailDataUrl: preview?.thumbnailDataUrl
    }
  }

  return {
    ...source,
    frontPageNumber: pageNumber,
    frontPageRotation: preview?.rotation,
    thumbnailDataUrl: preview?.thumbnailDataUrl
  }
}

function findPagePreview(
  source: HardcoverPdfSource,
  pageNumber: number
): HardcoverPdfPagePreview | undefined {
  return source.pagePreviews?.find((preview) => preview.pageNumber === pageNumber)
}

function upsertPagePreview(
  previews: HardcoverPdfPagePreview[],
  preview: HardcoverPdfPagePreview
): HardcoverPdfPagePreview[] {
  return [...previews.filter((item) => item.pageNumber !== preview.pageNumber), preview].sort(
    (first, second) => first.pageNumber - second.pageNumber
  )
}

function getFilePath(file: File): string | undefined {
  const candidate = file as File & { path?: unknown }

  return typeof candidate.path === 'string' ? candidate.path : undefined
}
