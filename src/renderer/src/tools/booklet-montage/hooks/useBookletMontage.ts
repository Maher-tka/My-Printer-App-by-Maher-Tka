import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  BookletPage,
  BookletSource,
  ExportImageFormat,
  ExportProgress,
  ImportProgress,
  SheetSettings
} from '../types'
import {
  blanksNeededForBooklet,
  createBlankPage,
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
  marginMm: 8,
  gapMm: 4,
  bleedMm: 0,
  scaleMode: 'fit',
  cropMarks: true,
  registrationMarks: false,
  exportQuality: 'standard'
}

export function useBookletMontage() {
  const [pages, setPages] = useState<BookletPage[]>([])
  const [sources, setSources] = useState<BookletSource[]>([])
  const [settings, setSettings] = useState<SheetSettings>(defaultSheetSettings)
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

    return generateBookletSheets(pages)
  }, [pageCountIsValid, pages])

  const appendImportResult = useCallback(
    (nextSources: BookletSource[], nextPages: BookletPage[]): void => {
      setSources((current) => [...current, ...nextSources])
      setPages((current) => [...current, ...nextPages])
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

  const addBlankPage = useCallback((): void => {
    setPages((current) => [
      ...current,
      createBlankPage(current.filter((page) => page.kind === 'blank').length + 1)
    ])
  }, [])

  const autoAddBlankPages = useCallback((): void => {
    setPages((current) => {
      const needed = blanksNeededForBooklet(current.length)
      const existingBlankCount = current.filter((page) => page.kind === 'blank').length
      const blanks = Array.from({ length: needed }, (_, index) =>
        createBlankPage(existingBlankCount + index + 1)
      )

      return [...current, ...blanks]
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

      return nextPages
    })
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

      return nextPages
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
    setImportProgress(idleImportProgress)
    setExportProgress(idleExportProgress)
    setError(null)
  }, [])

  const updateSettings = useCallback((nextSettings: Partial<SheetSettings>): void => {
    setSettings((current) => ({ ...current, ...nextSettings }))
  }, [])

  const exportPdf = useCallback(async (): Promise<void> => {
    const readinessError = getExportReadinessError(pages.length, pageCountIsValid, settings)

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
      total: sheets.length * 2,
      message: 'Preparing PDF export'
    })

    try {
      const { exportBookletPdf } = await import('../lib/exportPdf')
      const blob = await exportBookletPdf(sheets, sources, settings, setExportProgress, {
        signal: abortController.signal
      })
      setExportProgress({
        phase: 'saving-file',
        current: sheets.length * 2,
        total: sheets.length * 2,
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
        current: sheets.length * 2,
        total: sheets.length * 2,
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
  }, [pageCountIsValid, pages.length, settings, sheets, sources])

  const exportImages = useCallback(
    async (format: ExportImageFormat): Promise<void> => {
      const readinessError = getExportReadinessError(pages.length, pageCountIsValid, settings)

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
        total: sheets.length * 2,
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
            onImage: async (image) => {
              if (abortController.signal.aborted) {
                throw createCanceledError('Export canceled.')
              }

              exportedImageCount += 1
              setExportProgress({
                phase: 'saving-file',
                current: exportedImageCount,
                total: sheets.length * 2,
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
          total: sheets.length * 2,
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
    [pageCountIsValid, pages.length, settings, sheets, sources]
  )

  const cancelExport = useCallback((): void => {
    exportAbortControllerRef.current?.abort()
  }, [])

  return {
    pages,
    sources,
    settings,
    sheets,
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
    deletePage,
    clearProject,
    updateSettings,
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
  settings: SheetSettings
): string | null {
  if (pageCount === 0) {
    return 'No pages imported. Import a PDF or image pages before exporting.'
  }

  if (!pageCountIsValid) {
    return 'Page count must be divisible by 4 before exporting. Use Auto add blank pages.'
  }

  const settingsErrors = validatePrintSettings(settings)

  return settingsErrors[0] ?? null
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function waitForDownloadTick(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 120)
  })
}
