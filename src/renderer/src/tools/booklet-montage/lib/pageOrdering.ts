import type { ImportedPagesResult, ImportProgress, BookletPage } from '../types'

export type ResetBlankMode = 'keep' | 'remove'

interface ImportPageOrderOptions {
  batchId: string
  batchStartIndex: number
}

export function applyImportPageOrder(
  pages: BookletPage[],
  options: ImportPageOrderOptions
): BookletPage[] {
  return pages.map((page, index) => ({
    ...page,
    importBatchId: options.batchId,
    importBatchIndex: index,
    originalOrderIndex: options.batchStartIndex + index,
    currentOrderIndex: options.batchStartIndex + index
  }))
}

export function normalizeCurrentOrder(pages: BookletPage[]): BookletPage[] {
  return pages.map((page, index) => ({
    ...page,
    currentOrderIndex: index
  }))
}

export function reorderPagesByDrag(
  pages: BookletPage[],
  activeId: string,
  overId: string | null | undefined
): BookletPage[] {
  if (!overId || activeId === overId) {
    return normalizeCurrentOrder(pages)
  }

  const activeIndex = pages.findIndex((page) => page.id === activeId)
  const overIndex = pages.findIndex((page) => page.id === overId)

  if (activeIndex < 0 || overIndex < 0) {
    return normalizeCurrentOrder(pages)
  }

  const nextPages = [...pages]
  const [activePage] = nextPages.splice(activeIndex, 1)
  nextPages.splice(overIndex, 0, activePage)

  return normalizeCurrentOrder(nextPages)
}

export function resetToOriginalOrder(
  pages: BookletPage[],
  blankMode: ResetBlankMode = 'keep'
): BookletPage[] {
  const sourcePages = pages
    .filter((page) => page.sourceType !== 'blank')
    .sort(compareOriginalPageOrder)

  if (blankMode === 'remove') {
    return normalizeCurrentOrder(sourcePages)
  }

  const blankPages = pages.filter((page) => page.sourceType === 'blank')

  return normalizeCurrentOrder([...sourcePages, ...blankPages])
}

export async function createPagesFromPdf(
  pdfFile: File,
  onProgress: (progress: ImportProgress) => void,
  options: { signal?: AbortSignal } = {}
): Promise<ImportedPagesResult> {
  const { importPdfFile } = await import('./pdfImport')

  return importPdfFile(pdfFile, onProgress, options)
}

export async function createPagesFromImages(
  imageFiles: File[],
  onProgress: (progress: ImportProgress) => void,
  options: { signal?: AbortSignal } = {}
): Promise<ImportedPagesResult> {
  const { importImageFiles } = await import('./imageImport')

  return importImageFiles(imageFiles, onProgress, options)
}

function compareOriginalPageOrder(left: BookletPage, right: BookletPage): number {
  const orderDelta =
    (left.originalOrderIndex ?? Number.MAX_SAFE_INTEGER) -
    (right.originalOrderIndex ?? Number.MAX_SAFE_INTEGER)

  if (orderDelta !== 0) {
    return orderDelta
  }

  const batchDelta = left.importBatchIndex - right.importBatchIndex

  if (batchDelta !== 0) {
    return batchDelta
  }

  return left.id.localeCompare(right.id)
}
