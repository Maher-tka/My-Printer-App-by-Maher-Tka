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
import {
  destroyPdfDocument,
  loadPdfDocument,
  normalizePdfError,
  type PDFPageProxy
} from './pdfWorker'
import { pdfThumbnailRenderQueue, syncRenderQueueConcurrency, yieldAfterChunk } from './renderQueue'
import {
  DEFAULT_INITIAL_THUMBNAIL_PAGE_LIMIT,
  canvasToThumbnailBlob,
  getInitialThumbnailPageIndexes,
  getOrCreateThumbnailUrl
} from './thumbnailCache'
import { pointsToMm } from './units'

export { loadPdfDocument } from './pdfWorker'

export interface PdfImportOptions {
  signal?: AbortSignal
  initialThumbnailLimit?: number
}

const LARGE_PDF_SIZE_BYTES = 50 * 1024 * 1024
const LARGE_PDF_PAGE_COUNT = 50
export const DEFAULT_PDF_IMPORT_THUMBNAIL_LIMIT = DEFAULT_INITIAL_THUMBNAIL_PAGE_LIMIT

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
    const pageCount = pdf.numPages
    const thumbnailIndexes = getInitialThumbnailPageIndexes(
      pageCount,
      options.initialThumbnailLimit ?? DEFAULT_PDF_IMPORT_THUMBNAIL_LIMIT
    )
    const thumbnailIndexSet = new Set(thumbnailIndexes)
    const deferredThumbnailCount = pageCount - thumbnailIndexes.length

    warning = appendWarning(warning, getLargePdfWarning(file.size, pageCount))
    warning = appendWarning(
      warning,
      getDeferredThumbnailWarning(thumbnailIndexes.length, pageCount)
    )

    reportProgress(onProgress, {
      phase: 'reading',
      current: 0,
      total: pageCount,
      message:
        deferredThumbnailCount > 0
          ? `PDF loaded: ${pageCount} pages; preparing ${thumbnailIndexes.length} initial thumbnails`
          : `PDF loaded: ${pageCount} pages`,
      warning
    })

    let thumbnailAttempts = 0

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      assertNotCanceled(signal)
      reportProgress(onProgress, {
        phase: 'loading-page',
        current: pageNumber,
        total: pageCount,
        message: `Loading page ${pageNumber} of ${pageCount}`,
        warning
      })

      let page: PDFPageProxy | undefined
      try {
        page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 1 })
        const importedPage: ImportedPagesResult['pages'][number] = {
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
          widthMm: pointsToMm(viewport.width),
          heightMm: pointsToMm(viewport.height)
        }

        pages.push(importedPage)

        if (thumbnailIndexSet.has(pageNumber - 1)) {
          thumbnailAttempts += 1
          reportProgress(onProgress, {
            phase: 'generating-thumbnails',
            current: thumbnailAttempts,
            total: thumbnailIndexes.length,
            message: `Generating initial thumbnails ${thumbnailAttempts} of ${thumbnailIndexes.length} (page ${pageNumber} of ${pageCount})`,
            warning
          })

          try {
            importedPage.thumbnailUrl = await pdfThumbnailRenderQueue.run(
              () =>
                renderPdfThumbnail(
                  `${sourceId}:${pageNumber - 1}:thumbnail:${thumbnailMaxSize}:${thumbnailQuality}`,
                  page as PDFPageProxy,
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
          } catch (error) {
            if (isCanceledError(error)) {
              throw error
            }

            warning = appendWarning(
              warning,
              `Page ${pageNumber} thumbnail could not be generated; the page remains available for on-demand preview.`
            )
          }
        }
      } catch (error) {
        if (isCanceledError(error)) {
          throw error
        }

        throw new Error(`Failed to load page ${pageNumber}. ${getErrorMessage(error)}`)
      } finally {
        page?.cleanup()
      }

      await yieldAfterChunk(pageNumber, batchSize)
      if (pageNumber % batchSize === 0 || pageNumber === pageCount) {
        pdf.cleanup()
      }
    }

    reportProgress(onProgress, {
      phase: 'done',
      current: pageCount,
      total: pageCount,
      message: `Done: imported ${pageCount} PDF pages (${thumbnailIndexes.length} initial thumbnails ready)`,
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
          pageCount
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
    await destroyPdfDocument(pdf)
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
    return 'Large PDF detected. Page metadata is loaded in order and thumbnail work is bounded.'
  }

  return undefined
}

function getDeferredThumbnailWarning(
  thumbnailCount: number,
  pageCount: number
): string | undefined {
  if (thumbnailCount >= pageCount) {
    return undefined
  }

  return `Only ${thumbnailCount} of ${pageCount} page thumbnails are generated during import; remaining pages render on demand.`
}

function appendWarning(current: string | undefined, next: string | undefined): string | undefined {
  if (!next || current?.includes(next)) {
    return current
  }

  return current ? `${current} ${next}` : next
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
