import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  BookletPage,
  BookletSource,
  ExportImageFormat,
  ExportProgress,
  ImportProgress,
  SheetBoardPosition,
  SheetBoardState,
  SheetSettings
} from '../types'
import {
  blanksNeededForBooklet,
  createBlankPage,
  createStableId,
  generateBookletSheets,
  isBookletPageCount
} from '../lib/bookletImposition'
import { downloadBlob } from '../lib/download'
import {
  createCanceledError,
  isCanceledError,
  releasePageThumbnail,
  releasePageThumbnails
} from '../lib/memoryCleanup'
import { validatePrintSettings } from '../lib/printSizes'
import {
  applyImportPageOrder,
  normalizeCurrentOrder,
  reorderPagesByDrag,
  resetToOriginalOrder,
  type ResetBlankMode
} from '../lib/pageOrdering'
import {
  addEmptySheetToBoard,
  createInitialSheetBoardState,
  duplicateEmptySheetInBoard,
  flattenBookletSides,
  getEmptySheetsForExport,
  removeEmptySheetFromBoard,
  resetSheetBoardLayout,
  syncSheetBoardWithBookletSides,
  updateEmptySheetColor,
  updateSheetBoardPosition
} from '../lib/sheetLayoutState'

const idleImportProgress: ImportProgress = {
  phase: 'idle',
  current: 0,
  total: 0,
  message: 'No import running'
}

const idleExportProgress: ExportProgress = {
  phase: 'idle',
  current: 0,
  total: 0,
  message: 'No export running'
}

export const defaultSheetSettings: SheetSettings = {
  paperSize: 'A4',
  orientation: 'landscape',
  outputMode: 'front-back-pairs',
  customWidthMm: 297,
  customHeightMm: 210,
  scaleMode: 'fit',
  readingDirection: 'ltr',
  cropMarks: true,
  registrationMarks: false,
  exportQuality: 'standard'
}

export function useBookletMontage() {
  const [pages, setPages] = useState<BookletPage[]>([])
  const [sources, setSources] = useState<BookletSource[]>([])
  const [settings, setSettings] = useState<SheetSettings>(defaultSheetSettings)
  const [sheetBoardState, setSheetBoardState] = useState<SheetBoardState>(
    createInitialSheetBoardState
  )
  const [importProgress, setImportProgress] = useState<ImportProgress>(idleImportProgress)
  const [exportProgress, setExportProgress] = useState<ExportProgress>(idleExportProgress)
  const [error, setError] = useState<string | null>(null)
  const importAbortControllerRef = useRef<AbortController | null>(null)
  const exportAbortControllerRef = useRef<AbortController | null>(null)
  const pagesRef = useRef<BookletPage[]>([])

  const blanksNeeded = blanksNeededForBooklet(pages.length)
  const pageCountIsValid = isBookletPageCount(pages.length)

  useEffect(() => {
    pagesRef.current = pages
  }, [pages])

  useEffect(() => {
    return () => {
      importAbortControllerRef.current?.abort()
      exportAbortControllerRef.current?.abort()
      releasePageThumbnails(pagesRef.current)
    }
  }, [])

  const sheets = useMemo(() => {
    if (!pageCountIsValid) {
      return []
    }

    return generateBookletSheets(pages, settings.readingDirection)
  }, [pageCountIsValid, pages, settings.readingDirection])
  const sheetSides = useMemo(() => flattenBookletSides(sheets), [sheets])
  const emptySheetsForExport = useMemo(
    () => getEmptySheetsForExport(sheetBoardState),
    [sheetBoardState]
  )

  useEffect(() => {
    setSheetBoardState((current) => syncSheetBoardWithBookletSides(sheetSides, current))
  }, [sheetSides])

  const appendImportResult = useCallback(
    (nextSources: BookletSource[], nextPages: BookletPage[]): void => {
      const batchId = createStableId('batch')
      setSources((current) => [...current, ...nextSources])
      setPages((current) =>
        normalizeCurrentOrder([
          ...current,
          ...applyImportPageOrder(nextPages, {
            batchId,
            batchStartIndex: getNextOriginalOrderIndex(current)
          })
        ])
      )
    },
    []
  )

  const importPdfFiles = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0) {
        return
      }

      setError(null)
      importAbortControllerRef.current?.abort()
      const abortController = new AbortController()
      importAbortControllerRef.current = abortController

      try {
        const { importPdfFile } = await import('../lib/pdfImport')

        for (const file of files) {
          const result = await importPdfFile(file, setImportProgress, {
            signal: abortController.signal
          })
          appendImportResult(result.sources, result.pages)
        }
      } catch (importError) {
        const canceled = isCanceledError(importError)
        setImportProgress({
          phase: canceled ? 'canceled' : 'error',
          current: 0,
          total: 0,
          message: canceled ? 'PDF import canceled.' : getErrorMessage(importError)
        })
        setError(canceled ? 'PDF import canceled.' : getErrorMessage(importError))
      } finally {
        if (importAbortControllerRef.current === abortController) {
          importAbortControllerRef.current = null
        }
      }
    },
    [appendImportResult]
  )

  const importImages = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0) {
        return
      }

      setError(null)
      importAbortControllerRef.current?.abort()
      const abortController = new AbortController()
      importAbortControllerRef.current = abortController

      try {
        const { importImageFiles } = await import('../lib/imageImport')
        const result = await importImageFiles(files, setImportProgress, {
          signal: abortController.signal
        })
        appendImportResult(result.sources, result.pages)
      } catch (importError) {
        const canceled = isCanceledError(importError)
        setImportProgress({
          phase: canceled ? 'canceled' : 'error',
          current: 0,
          total: 0,
          message: canceled ? 'Image import canceled.' : getErrorMessage(importError)
        })
        setError(canceled ? 'Image import canceled.' : getErrorMessage(importError))
      } finally {
        if (importAbortControllerRef.current === abortController) {
          importAbortControllerRef.current = null
        }
      }
    },
    [appendImportResult]
  )

  const cancelImport = useCallback((): void => {
    importAbortControllerRef.current?.abort()
  }, [])

  const addBlankPage = useCallback((afterPageId?: string | null): void => {
    setPages((current) => {
      const insertAfterIndex = afterPageId
        ? current.findIndex((page) => page.id === afterPageId)
        : -1
      const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : current.length
      const nextPages = [...current]

      nextPages.splice(insertIndex, 0, createManualBlankPage(current))

      return normalizeCurrentOrder(nextPages)
    })
  }, [])

  const autoAddBlankPages = useCallback((): void => {
    setPages((current) => {
      const needed = blanksNeededForBooklet(current.length)
      const existingBlankCount = current.filter((page) => page.kind === 'blank').length
      const blanks = Array.from({ length: needed }, (_, index) =>
        createBlankPage(existingBlankCount + index + 1)
      )

      return normalizeCurrentOrder([...current, ...blanks])
    })
  }, [])

  const movePage = useCallback((pageId: string, direction: -1 | 1): void => {
    setPages((current) => {
      const index = current.findIndex((page) => page.id === pageId)
      const targetIndex = index + direction

      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current
      }

      const nextPages = [...current]
      const [page] = nextPages.splice(index, 1)
      nextPages.splice(targetIndex, 0, page)

      return normalizeCurrentOrder(nextPages)
    })
  }, [])

  const reorderPages = useCallback((activeId: string, overId: string | null): void => {
    setError(null)
    setPages((current) => reorderPagesByDrag(current, activeId, overId))
  }, [])

  const resetPageOrder = useCallback((blankMode: ResetBlankMode): void => {
    setError(null)
    setPages((current) => resetToOriginalOrder(current, blankMode))
  }, [])

  const deletePage = useCallback((pageId: string): void => {
    setPages((current) => {
      const removedPage = current.find((page) => page.id === pageId)

      if (!removedPage) {
        return current
      }

      const nextPages = current.filter((page) => page.id !== pageId)
      const activeSourceIds = new Set(
        nextPages.flatMap((page) => (page.sourceId ? [page.sourceId] : []))
      )

      releasePageThumbnail(removedPage)
      setSources((currentSources) =>
        currentSources.filter((source) => activeSourceIds.has(source.id))
      )

      return normalizeCurrentOrder(nextPages)
    })
  }, [])

  const clearProject = useCallback((): void => {
    importAbortControllerRef.current?.abort()
    exportAbortControllerRef.current?.abort()
    setPages((current) => {
      releasePageThumbnails(current)
      return []
    })
    setSources([])
    setSheetBoardState(createInitialSheetBoardState())
    setImportProgress(idleImportProgress)
    setExportProgress(idleExportProgress)
    setError(null)
  }, [])

  const updateSettings = useCallback((nextSettings: Partial<SheetSettings>): void => {
    setSettings((current) => ({ ...current, ...nextSettings }))
  }, [])

  const addEmptySheet = useCallback((): void => {
    setError(null)
    setSheetBoardState((current) => addEmptySheetToBoard(current))
  }, [])

  const resetSheetLayout = useCallback((): void => {
    setSheetBoardState((current) => resetSheetBoardLayout(current))
  }, [])

  const moveSheetBoardItem = useCallback((itemId: string, position: SheetBoardPosition): void => {
    setSheetBoardState((current) => updateSheetBoardPosition(current, itemId, position))
  }, [])

  const setEmptySheetColor = useCallback((itemId: string, colorHex: string): void => {
    setSheetBoardState((current) => updateEmptySheetColor(current, itemId, colorHex))
  }, [])

  const deleteSheetBoardItem = useCallback((itemId: string): void => {
    setSheetBoardState((current) => {
      const item = current.items.find((candidate) => candidate.id === itemId)

      if (!item) {
        return current
      }

      if (item.kind === 'booklet-side') {
        setError('This sheet is generated from the booklet order. Delete or rearrange source pages before export changes are allowed.')
        return current
      }

      setError(null)
      return removeEmptySheetFromBoard(current, itemId)
    })
  }, [])

  const duplicateSheetBoardItem = useCallback((itemId: string): void => {
    setSheetBoardState((current) => {
      const item = current.items.find((candidate) => candidate.id === itemId)

      if (!item) {
        return current
      }

      if (item.kind === 'booklet-side') {
        setError('Duplicating imposed booklet sheets is blocked for now so the export order stays correct.')
        return current
      }

      setError(null)
      return duplicateEmptySheetInBoard(current, itemId)
    })
  }, [])

  const exportPdf = useCallback(async (): Promise<void> => {
    const exportPageCount = sheets.length * 2 + emptySheetsForExport.length
    const readinessError = getExportReadinessError(
      pages.length,
      pageCountIsValid,
      settings,
      emptySheetsForExport.length
    )

    if (readinessError) {
      setError(readinessError)
      return
    }

    setError(null)
    exportAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    exportAbortControllerRef.current = abortController
    setExportProgress({
      phase: 'preparing-pages',
      current: 0,
      total: exportPageCount,
      message: 'Preparing PDF export'
    })

    try {
      const { exportBookletPdf } = await import('../lib/exportPdf')
      const blob = await exportBookletPdf(sheets, sources, settings, setExportProgress, {
        signal: abortController.signal,
        emptySheets: emptySheetsForExport
      })
      setExportProgress({
        phase: 'saving-file',
        current: exportPageCount,
        total: exportPageCount,
        message: 'Saving PDF file'
      })

      if (window.printerApp?.saveFile) {
        const result = await window.printerApp.saveFile({
          suggestedName: 'booklet-montage.pdf',
          bytes: await blobToUint8Array(blob),
          filters: [{ name: 'PDF', extensions: ['pdf'] }]
        })

        if (result.canceled) {
          throw new Error('File save canceled.')
        }

        if (!result.ok) {
          throw new Error(result.error ?? 'Export failed while saving the PDF file.')
        }
      } else {
        downloadBlob(blob, 'booklet-montage.pdf')
      }

      setExportProgress({
        phase: 'done',
        current: exportPageCount,
        total: exportPageCount,
        message: 'PDF export done'
      })
    } catch (exportError) {
      const canceled = isCanceledError(exportError)
      setExportProgress({
        phase: canceled ? 'canceled' : 'error',
        current: 0,
        total: 0,
        message: canceled ? 'Export canceled.' : getErrorMessage(exportError)
      })
      setError(canceled ? 'Export canceled.' : getErrorMessage(exportError))
    } finally {
      if (exportAbortControllerRef.current === abortController) {
        exportAbortControllerRef.current = null
      }
    }
  }, [emptySheetsForExport, pageCountIsValid, pages.length, settings, sheets, sources])

  const exportImages = useCallback(
    async (format: ExportImageFormat): Promise<void> => {
      const exportPageCount = sheets.length * 2 + emptySheetsForExport.length
      const readinessError = getExportReadinessError(
        pages.length,
        pageCountIsValid,
        settings,
        emptySheetsForExport.length
      )

      if (readinessError) {
        setError(readinessError)
        return
      }

      setError(null)
      exportAbortControllerRef.current?.abort()
      const abortController = new AbortController()
      exportAbortControllerRef.current = abortController
      setExportProgress({
        phase: 'preparing-pages',
        current: 0,
        total: exportPageCount,
        message: 'Preparing image export'
      })

      try {
        let outputFolder: string | null = null
        let exportedImageCount = 0
        const desktopApi = window.printerApp
        const writeFilesToFolder = desktopApi?.writeFilesToFolder

        if (desktopApi) {
          const folder = await desktopApi.selectOutputFolder()

          if (folder.canceled) {
            throw new Error('File save canceled.')
          }

          if (!folder.ok || !folder.folderPath) {
            throw new Error(folder.error ?? 'Export failed while choosing the output folder.')
          }

          outputFolder = folder.folderPath
        }

        const { exportBookletImages } = await import('../lib/exportImages')
        await exportBookletImages(
          sheets,
          sources,
          settings,
          format,
          setExportProgress,
          {
            signal: abortController.signal,
            emptySheets: emptySheetsForExport,
            onImage: async (image) => {
              if (abortController.signal.aborted) {
                throw createCanceledError('Export canceled.')
              }

              exportedImageCount += 1
              setExportProgress({
                phase: 'saving-file',
                current: exportedImageCount,
                total: exportPageCount,
                message: `Saving ${image.fileName}`
              })

              if (outputFolder && writeFilesToFolder) {
                const result = await writeFilesToFolder(outputFolder, [
                  {
                    fileName: image.fileName,
                    bytes: await blobToUint8Array(image.blob)
                  }
                ])

                if (!result.ok) {
                  throw new Error(result.error ?? 'Export failed while saving image sheets.')
                }

                return
              }

              downloadBlob(image.blob, image.fileName)
              await waitForDownloadTick()
            }
          }
        )

        setExportProgress({
          phase: 'done',
          current: exportedImageCount,
          total: exportPageCount,
          message: `${exportedImageCount} image sheets exported`
        })
      } catch (exportError) {
        const canceled = isCanceledError(exportError)
        setExportProgress({
          phase: canceled ? 'canceled' : 'error',
          current: 0,
          total: 0,
          message: canceled ? 'Export canceled.' : getErrorMessage(exportError)
        })
        setError(canceled ? 'Export canceled.' : getErrorMessage(exportError))
      } finally {
        if (exportAbortControllerRef.current === abortController) {
          exportAbortControllerRef.current = null
        }
      }
    },
    [emptySheetsForExport, pageCountIsValid, pages.length, settings, sheets, sources]
  )

  const cancelExport = useCallback((): void => {
    exportAbortControllerRef.current?.abort()
  }, [])

  return {
    pages,
    sources,
    settings,
    sheets,
    sheetBoardState,
    emptySheetsForExport,
    blanksNeeded,
    pageCountIsValid,
    importProgress,
    exportProgress,
    error,
    importPdfFiles,
    importImages,
    cancelImport,
    addBlankPage,
    autoAddBlankPages,
    movePage,
    reorderPages,
    resetPageOrder,
    deletePage,
    clearProject,
    updateSettings,
    addEmptySheet,
    resetSheetLayout,
    moveSheetBoardItem,
    setEmptySheetColor,
    deleteSheetBoardItem,
    duplicateSheetBoardItem,
    exportPdf,
    exportImages,
    cancelExport
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function getExportReadinessError(
  pageCount: number,
  pageCountIsValid: boolean,
  settings: SheetSettings,
  emptySheetCount: number
): string | null {
  if (pageCount === 0 && emptySheetCount === 0) {
    return 'No pages or empty sheets are available to export.'
  }

  if (pageCount > 0 && !pageCountIsValid) {
    return 'Page count must be divisible by 4 before exporting. Use Auto add blank pages.'
  }

  const settingsErrors = validatePrintSettings(settings)

  return settingsErrors[0] ?? null
}

function createManualBlankPage(currentPages: BookletPage[]): BookletPage {
  const sequence = currentPages.filter((page) => page.sourceType === 'blank').length + 1
  const blankPage = createBlankPage(sequence)

  return {
    ...blankPage,
    importBatchId: createStableId('blank-batch'),
    importBatchIndex: sequence - 1,
    originalOrderIndex: Number.MAX_SAFE_INTEGER - currentPages.length,
    currentOrderIndex: currentPages.length
  }
}

function getNextOriginalOrderIndex(pages: BookletPage[]): number {
  const finiteIndexes = pages
    .map((page) => page.originalOrderIndex)
    .filter((index) => Number.isFinite(index) && index < Number.MAX_SAFE_INTEGER / 2)

  return finiteIndexes.length > 0 ? Math.max(...finiteIndexes) + 1 : 0
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function waitForDownloadTick(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 120)
  })
}
