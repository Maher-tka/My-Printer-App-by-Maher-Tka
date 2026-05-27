import type { ImportedPagesResult, ImportProgress } from '../types'
import { getPerformanceSettingsSnapshot } from '../../../performance/performanceSettings'
import { getLargeProjectWarning as getSharedLargeProjectWarning } from '../../../performance/renderQuality'
import { createStableId } from './bookletImposition'
import {
  assertCanvasWithinLimit,
  assertNotCanceled,
  createCanceledError,
  isCanceledError,
  releasePageThumbnails,
  resetCanvas
} from './memoryCleanup'
import { loadPdfDocument, normalizePdfError, type PDFPageProxy } from './pdfWorker'
import { pdfThumbnailRenderQueue, syncRenderQueueConcurrency, yieldAfterChunk } from './renderQueue'
import { canvasToThumbnailBlob, getOrCreateThumbnailUrl } from './thumbnailCache'
import { pointsToMm } from './units'

export { loadPdfDocument } from './pdfWorker'

interface PdfImportOptions {
  signal?: AbortSignal
}

const LARGE_PDF_SIZE_BYTES = 50 * 1024 * 1024
const LARGE_PDF_PAGE_COUNT = 50

export async function importPdfFile(
  file: File,
  onProgress: (progress: ImportProgress) => void,
  options: PdfImportOptions = {}
): Promise<ImportedPagesResult> {
  if (file.type && file.type !== 'application/pdf') {
    throw new Error(`${file.name} is not a PDF file.`)
  }

  const signal = options.signal
  const sourceId = createStableId('pdf')
  const pages: ImportedPagesResult['pages'] = []
  let pdf: Awaited<ReturnType<typeof loadPdfDocument>> | undefined
  let warning = getLargePdfWarning(file.size)
  const performanceSettings = getPerformanceSettingsSnapshot()
  const thumbnailMaxSize = performanceSettings.render.thumbnailMaxSizePx
  const thumbnailQuality = performanceSettings.render.thumbnailJpegQuality
  const batchSize = performanceSettings.render.pdfImportBatchSize

  syncRenderQueueConcurrency()

  try {
    assertNotCanceled(signal)
    reportProgress(onProgress, {
      phase: 'reading',
      current: 0,
      total: 1,
      message: `Reading PDF: ${file.name}`,
      warning
    })

    const bytes = new Uint8Array(await file.arrayBuffer())
    assertNotCanceled(signal)

    pdf = await loadPdfDocument(bytes, signal)
    warning = warning ?? getLargePdfWarning(file.size, pdf.numPages)

    reportProgress(onProgress, {
      phase: 'reading',
      current: 0,
      total: pdf.numPages,
      message: `PDF loaded: ${pdf.numPages} pages`,
      warning
    })

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      assertNotCanceled(signal)
      reportProgress(onProgress, {
        phase: 'loading-page',
        current: pageNumber,
        total: pdf.numPages,
        message: `Loading page ${pageNumber} of ${pdf.numPages}`,
        warning
      })

      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })

      reportProgress(onProgress, {
        phase: 'generating-thumbnails',
        current: pageNumber,
        total: pdf.numPages,
        message: `Generating thumbnails ${pageNumber} of ${pdf.numPages}`,
        warning
      })

      try {
        const thumbnailUrl = await pdfThumbnailRenderQueue.run(
          () =>
            renderPdfThumbnail(
              `${sourceId}:${pageNumber - 1}:thumbnail:${thumbnailMaxSize}:${thumbnailQuality}`,
              page,
              {
                maxWidth: thumbnailMaxSize,
                maxHeight: Math.round(thumbnailMaxSize * 1.45),
                quality: thumbnailQuality,
                signal
              }
            ),
          signal,
          pageNumber <= 12 ? 10 : 0
        )

        pages.push({
          id: createStableId('page'),
          kind: 'pdf',
          sourceType: 'pdf',
          sourceId,
          sourceName: file.name,
          sourceFileName: file.name,
          sourcePageIndex: pageNumber - 1,
          originalPageNumber: pageNumber,
          currentOrderIndex: pageNumber - 1,
          originalOrderIndex: pageNumber - 1,
          importBatchId: sourceId,
          importBatchIndex: pageNumber - 1,
          label: `PDF Page ${pageNumber}`,
          displayName: `${file.name} - Page ${pageNumber}`,
          thumbnailUrl,
          widthMm: pointsToMm(viewport.width),
          heightMm: pointsToMm(viewport.height)
        })
      } catch (error) {
        if (isCanceledError(error)) {
          throw error
        }

        throw new Error(`Failed to render page ${pageNumber}. ${getErrorMessage(error)}`)
      } finally {
        page.cleanup()
      }

      await yieldAfterChunk(pageNumber, batchSize)
      pdf.cleanup()
    }

    reportProgress(onProgress, {
      phase: 'done',
      current: pdf.numPages,
      total: pdf.numPages,
      message: `Done: imported ${pdf.numPages} PDF pages`,
      warning
    })

    return {
      sources: [
        {
          id: sourceId,
          kind: 'pdf',
          name: file.name,
          mimeType: 'application/pdf',
          bytes,
          pageCount: pdf.numPages
        }
      ],
      pages
    }
  } catch (error) {
    releasePageThumbnails(pages)

    if (isCanceledError(error)) {
      throw createCanceledError('PDF import canceled.')
    }

    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

async function renderPdfThumbnail(
  cacheKey: string,
  page: PDFPageProxy,
  options: {
    maxWidth: number
    maxHeight: number
    quality: number
    signal?: AbortSignal
  }
): Promise<string> {
  return getOrCreateThumbnailUrl(cacheKey, async () => {
    const signal = options.signal

    assertNotCanceled(signal)

    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.min(
      options.maxWidth / baseViewport.width,
      options.maxHeight / baseViewport.height,
      1
    )
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Could not create a canvas context for PDF thumbnail rendering.')
    }

    canvas.width = Math.max(Math.floor(viewport.width), 1)
    canvas.height = Math.max(Math.floor(viewport.height), 1)
    assertCanvasWithinLimit(canvas.width, canvas.height, 'generating PDF thumbnails')

    const renderTask = page.render({ canvas, canvasContext: context, viewport })
    const abort = () => renderTask.cancel()

    signal?.addEventListener('abort', abort, { once: true })

    try {
      await renderTask.promise
      assertNotCanceled(signal)
      return await canvasToThumbnailBlob(canvas, 'image/jpeg', options.quality)
    } catch (error) {
      if (signal?.aborted) {
        throw createCanceledError('PDF import canceled.')
      }

      throw error
    } finally {
      signal?.removeEventListener('abort', abort)
      resetCanvas(canvas)
    }
  })
}

function getLargePdfWarning(fileSize: number, pageCount?: number): string | undefined {
  const sharedWarning = getSharedLargeProjectWarning({
    pageCount: pageCount ?? 0,
    totalBytes: fileSize
  })

  if (sharedWarning) {
    return sharedWarning
  }

  if (
    fileSize >= LARGE_PDF_SIZE_BYTES ||
    (pageCount !== undefined && pageCount >= LARGE_PDF_PAGE_COUNT)
  ) {
    return 'Large PDF detected. Import may take longer. The app will process it in batches.'
  }

  return undefined
}

function reportProgress(
  onProgress: (progress: ImportProgress) => void,
  progress: ImportProgress
): void {
  onProgress(progress)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown page render error.'
}
