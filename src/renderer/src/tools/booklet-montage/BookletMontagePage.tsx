import { useLanguage } from '@/i18n/useLanguage'
import { ToolHeader } from '../shared/ToolHeader'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { createPrintedJob } from '@/jobs/printHistory'
import { createProjectPrinterJob } from '@/jobs/projectJob'
import { useJobStore } from '@/jobs/useJobStore'
import { getPrintResultMessage } from '@/print/printPdf'
import { ProjectFileActions } from '@/projects/ProjectFileActions'
import { getBookletProjectStateKey } from '@/projects/projectDirtyState'
import {
  createBookletProjectFile,
  getSuggestedProjectFileName,
  type BookletProjectPayload
} from '@/projects/projectFiles'
import { getLargeProjectWarning } from '@/performance/renderQuality'
import { runBookletPreflight } from '@/preflight/bookletPreflight'
import { PreflightDialog } from '@/preflight/preflightUI'
import type { PreflightReport } from '@/preflight/preflightTypes'
import { usePerformanceSettings } from '@/performance/usePerformanceSettings'
import { Card, CardContent } from '@/components/ui/card'
import type { AppRoute } from '@/types/navigation'
import type {
  ActiveProjectSession,
  OpenedPrinterProject,
  PrinterAppProjectResult,
  ProjectMetadata
} from '@/types/projects'
import type { UnsavedChangesAction } from '../../../../shared/project-types'
import { BookFlipPreview } from './components/BookFlipPreview'
import { BookletToolbar } from './components/BookletToolbar'
import { PageManager } from './components/PageManager'
import { SheetPreview } from './components/SheetPreview'
import { useBookletMontage } from './hooks/useBookletMontage'
import { getPrintSizeMm, validatePrintSettings } from './lib/printSizes'
import type { BookletViewMode } from './types'

interface BookletMontagePageProps {
  onNavigate: (route: AppRoute) => void
  openedProject?: OpenedPrinterProject<BookletProjectPayload> | null
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
  initialPdfImport?: { id: number; files: File[] } | null
  onInitialPdfImportConsumed: (requestId: number) => void
  onProjectSessionChange: (session: ActiveProjectSession | null) => void
  onConfirmUnsavedChanges: (action: UnsavedChangesAction) => Promise<boolean>
}

export function BookletMontagePage({
  onNavigate,
  openedProject,
  onOpenProject,
  initialPdfImport,
  onInitialPdfImportConsumed,
  onProjectSessionChange,
  onConfirmUnsavedChanges
}: BookletMontagePageProps): JSX.Element {
  const { t } = useLanguage()

  const montage = useBookletMontage(openedProject?.project)
  const { jobs, saveJob } = useJobStore()
  const handledInitialPdfImportIdRef = useRef<number | null>(null)
  const { settings: performanceSettings, setPreset: setPerformancePreset } =
    usePerformanceSettings()
  const [viewMode, setViewMode] = useState<BookletViewMode>('sheet')
  const [projectFilePath, setProjectFilePath] = useState<string | null>(
    openedProject?.filePath ?? null
  )
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | null>(
    openedProject?.project.metadata ?? null
  )
  const [projectIsBusy, setProjectIsBusy] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [projectMessage, setProjectMessage] = useState<string | null>(
    openedProject ? `Opened ${openedProject.project.metadata.jobName}` : null
  )
  const [pendingExport, setPendingExport] = useState<{
    report: PreflightReport
    run: () => void
    action: 'export' | 'print'
  } | null>(null)
  const projectStateKey = useMemo(
    () =>
      getBookletProjectStateKey({
        sources: montage.sources,
        pages: montage.pages,
        settings: montage.settings,
        sheetBoardState: montage.sheetBoardState
      }),
    [montage.pages, montage.settings, montage.sheetBoardState, montage.sources]
  )
  const [savedProjectStateKey, setSavedProjectStateKey] = useState(projectStateKey)
  const isDirty = projectStateKey !== savedProjectStateKey
  const projectName = projectMetadata?.jobName ?? getUnsavedBookletName(montage.sources[0]?.name)
  const boardItemIds = useMemo(
    () => montage.sheetBoardState.items.map((item) => item.id),
    [montage.sheetBoardState.items]
  )
  const pageIds = useMemo(() => montage.pages.map((page) => page.id), [montage.pages])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const inspectSheetItem = useCallback((itemId: string): void => {
    setSelectedItemId(itemId)
    setInspectedItemId(itemId)
  }, [])
  const closeSheetInspection = useCallback((): void => setInspectedItemId(null), [])
  const importIsBusy =
    montage.importProgress.phase === 'reading' ||
    montage.importProgress.phase === 'loading-page' ||
    montage.importProgress.phase === 'generating-thumbnails' ||
    montage.importProgress.phase === 'rendering'
  const exportIsBusy =
    montage.exportProgress.phase === 'preparing-pages' ||
    montage.exportProgress.phase === 'rendering-page' ||
    montage.exportProgress.phase === 'creating-pdf' ||
    montage.exportProgress.phase === 'saving-file'
  const hasExportableItems = montage.sheets.length > 0 || montage.emptySheetsForExport.length > 0
  const readingDirectionLabel =
    montage.settings.readingDirection === 'rtl' ? 'RTL Arabic mode' : 'LTR mode'
  const canExport =
    hasExportableItems &&
    (montage.pages.length === 0 || montage.pageCountIsValid) &&
    validatePrintSettings(montage.settings, montage.sheets.length).length === 0 &&
    !exportIsBusy &&
    !importIsBusy
  const largeProjectWarning = getLargeProjectWarning({
    pageCount: montage.pages.length,
    totalBytes: montage.sources.reduce((total, source) => total + source.bytes.byteLength, 0)
  })
  const bookletPreflight = useMemo(() => {
    const paper = getPrintSizeMm(montage.settings)
    return runBookletPreflight({
      pageCount: montage.pages.length,
      blankPageCount: montage.pages.filter((page) => page.kind === 'blank').length,
      paperWidthMm: paper.widthMm,
      paperHeightMm: paper.heightMm,
      readingDirection: montage.settings.readingDirection,
      estimatedSourceBytes: montage.sources.reduce(
        (total, source) => total + source.bytes.byteLength,
        0
      ),
      pageSizesMm: montage.pages
        .filter((page) => page.kind !== 'blank')
        .map((page) => ({
          widthMm: page.widthMm,
          heightMm: page.heightMm,
          label: page.label
        })),
      outerMarginMm: montage.settings.outerMarginMm,
      pageGapMm: montage.settings.pageGapMm,
      cropMarks: montage.settings.cropMarks,
      registrationMarks: montage.settings.registrationMarks,
      scaleMode: montage.settings.scaleMode
    })
  }, [montage.pages, montage.settings, montage.sources])
  const requestBookletAction = useCallback(
    (run: () => void, action: 'export' | 'print' = 'export'): void => {
      setPendingExport({
        report: bookletPreflight,
        run,
        action
      })
    },
    [bookletPreflight]
  )

  const createProjectSnapshot = useCallback(
    () =>
      createBookletProjectFile({
        sources: montage.sources,
        pages: montage.pages,
        settings: montage.settings,
        sheetBoardState: montage.sheetBoardState,
        existingMetadata: projectMetadata
      }),
    [montage.pages, montage.settings, montage.sheetBoardState, montage.sources, projectMetadata]
  )

  const saveProject = useCallback(
    async (saveAs: boolean): Promise<boolean> => {
      if (!window.printerApp?.saveProject) {
        setProjectMessage('Project saving is only available in the desktop app.')
        return false
      }

      const stateKeyAtSave = projectStateKey
      setProjectIsBusy(true)
      setProjectMessage('Saving project...')

      try {
        const project = createProjectSnapshot()
        const result = await window.printerApp.saveProject({
          suggestedName: getSuggestedProjectFileName(
            project.metadata.jobName,
            project.metadata.tool
          ),
          filePath: saveAs ? null : projectFilePath,
          project
        })

        if (result.canceled) {
          setProjectMessage('Save canceled.')
          return false
        }

        if (!result.ok || !result.filePath) {
          throw new Error(result.error ?? 'Could not save this booklet project.')
        }

        setProjectFilePath(result.filePath)
        setProjectMetadata(project.metadata)
        saveJob(
          createProjectPrinterJob({
            id: project.metadata.id,
            tool: 'booklet',
            title: project.metadata.jobName,
            filePath: result.filePath,
            createdAt: project.metadata.createdAt
          })
        )
        setSavedProjectStateKey(stateKeyAtSave)
        setProjectMessage(`Saved ${project.metadata.jobName}`)
        return true
      } catch (error) {
        setProjectMessage(getProjectErrorMessage(error))
        return false
      } finally {
        setProjectIsBusy(false)
      }
    },
    [createProjectSnapshot, projectFilePath, projectStateKey, saveJob]
  )

  const openProject = async (): Promise<void> => {
    setProjectIsBusy(true)
    setProjectMessage('Choose a project to open...')

    const result = await onOpenProject()

    if (result.canceled) {
      setProjectMessage(null)
    } else if (!result.ok) {
      setProjectMessage(result.error ?? 'Could not open that project.')
    }

    setProjectIsBusy(false)
  }

  const startNewProject = async (): Promise<void> => {
    if (!(await onConfirmUnsavedChanges('new-project'))) {
      return
    }

    setSavedProjectStateKey(getEmptyBookletProjectStateKey(montage.settings))
    montage.clearProject()
    setProjectFilePath(null)
    setProjectMetadata(null)
    setProjectMessage('Started a new booklet project.')
  }

  const printBooklet = useCallback(async (): Promise<void> => {
    setIsPrinting(true)
    try {
      setProjectMessage('Preparing booklet PDF for printing...')
      const result = await montage.printPdf(projectName)
      setProjectMessage(getPrintResultMessage(result, 'booklet-montage.pdf'))

      if (!result.ok) return

      const existingJob = projectMetadata?.id
        ? jobs.find((job) => job.id === projectMetadata.id)
        : undefined
      saveJob(
        createPrintedJob({
          existingJob,
          projectId: projectMetadata?.id,
          tool: 'booklet',
          jobName: projectName,
          pdfName: result.pdfName ?? 'booklet-montage.pdf',
          printerName: result.printerName,
          localProjectPath: projectFilePath
        })
      )
    } catch (error) {
      setProjectMessage(getProjectErrorMessage(error))
    } finally {
      setIsPrinting(false)
    }
  }, [jobs, montage, projectFilePath, projectMetadata?.id, projectName, saveJob])

  const importPdfFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0 || !(await onConfirmUnsavedChanges('import-pdf'))) {
      return
    }

    setSavedProjectStateKey(getEmptyBookletProjectStateKey(montage.settings))
    montage.clearProject()
    setProjectFilePath(null)
    setProjectMetadata(null)
    setProjectMessage('Importing PDF into a new booklet project...')
    await montage.importPdfFiles(files)
  }

  useEffect(() => {
    onProjectSessionChange({
      isDirty,
      projectName,
      filePath: projectFilePath,
      snapshot: createProjectSnapshot(),
      preflight: {
        warningsCount: bookletPreflight.warnings.length,
        preflightStatus: bookletPreflight.status
      },
      save: () => saveProject(false)
    })
  }, [
    createProjectSnapshot,
    bookletPreflight.status,
    bookletPreflight.warnings.length,
    isDirty,
    onProjectSessionChange,
    projectFilePath,
    projectName,
    saveProject
  ])

  useEffect(() => () => onProjectSessionChange(null), [onProjectSessionChange])

  useEffect(() => {
    if (!initialPdfImport || handledInitialPdfImportIdRef.current === initialPdfImport.id) {
      return
    }

    // Wait for the mount to settle: StrictMode's cleanup aborts work started in
    // its first effect pass. Consume the dashboard request only when it runs.
    const timer = window.setTimeout(() => {
      if (handledInitialPdfImportIdRef.current === initialPdfImport.id) return
      handledInitialPdfImportIdRef.current = initialPdfImport.id
      onInitialPdfImportConsumed(initialPdfImport.id)
      void montage.importPdfFiles(initialPdfImport.files)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [initialPdfImport, montage.importPdfFiles, onInitialPdfImportConsumed])

  useEffect(() => {
    if (boardItemIds.length === 0) {
      setSelectedItemId(null)
      return
    }

    setSelectedItemId((current) =>
      current && boardItemIds.includes(current) ? current : boardItemIds[0]
    )
    setInspectedItemId((current) => (current && boardItemIds.includes(current) ? current : null))
  }, [boardItemIds])

  useEffect(() => {
    if (pageIds.length === 0) {
      setSelectedPageId(null)
      return
    }

    setSelectedPageId((current) => (current && pageIds.includes(current) ? current : pageIds[0]))
  }, [pageIds])

  useEffect(() => {
    if (viewMode !== 'montage') {
      setInspectedItemId(null)
    }
  }, [viewMode])

  return (
    <div className="workspace-shell booklet-workspace mx-auto flex w-full max-w-[1880px] flex-col gap-4">
      <Card className="border-0 bg-transparent shadow-none">
        <ToolHeader
          title={t('Booklet Montage')}
          onBack={() => onNavigate('dashboard')}
          print={{
            disabled: !canExport || projectIsBusy || importIsBusy || exportIsBusy,
            isBusy: isPrinting,
            onPrint: () => requestBookletAction(() => void printBooklet(), 'print')
          }}
          exportPdf={{
            disabled: !canExport || projectIsBusy || importIsBusy || exportIsBusy,
            onExport: () => requestBookletAction(() => void montage.exportPdf())
          }}
          actions={
            <ProjectFileActions
              filePath={projectFilePath}
              isBusy={projectIsBusy || importIsBusy || exportIsBusy}
              isDirty={isDirty}
              message={projectMessage}
              onOpen={() => void openProject()}
              onSave={() => void saveProject(false)}
              onSaveAs={() => void saveProject(true)}
              onNew={() => void startNewProject()}
            />
          }
        />
        <CardContent className="flex flex-col gap-4 p-0 pt-4">
          <BookletToolbar
            settings={montage.settings}
            viewMode={viewMode}
            blanksNeeded={montage.blanksNeeded}
            physicalSheetCount={montage.sheets.length}
            hasBoardItems={montage.sheetBoardState.items.length > 0}
            canExport={canExport}
            isBusy={importIsBusy || exportIsBusy}
            importProgress={montage.importProgress}
            exportProgress={montage.exportProgress}
            onImportPdf={(files) => void importPdfFiles(files)}
            onImportImages={montage.importImages}
            onCancelImport={montage.cancelImport}
            onCancelExport={montage.cancelExport}
            onSettingsChange={montage.updateSettings}
            onAutoAddBlankPages={montage.autoAddBlankPages}
            onAddEmptySheet={montage.addEmptySheet}
            onResetSheetLayout={montage.resetSheetLayout}
            onExportImages={(format) =>
              requestBookletAction(() => void montage.exportImages(format))
            }
            onViewModeChange={setViewMode}
          />

          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)_240px] 2xl:grid-cols-[280px_minmax(0,1fr)_280px]">
            <aside
              aria-label="Document pages"
              className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto"
            >
              <PageManager
                compact
                pages={montage.pages}
                sources={montage.sources}
                scaleMode={montage.settings.scaleMode}
                selectedPageId={selectedPageId}
                blanksNeeded={montage.blanksNeeded}
                pageCountIsValid={montage.pageCountIsValid}
                recentColors={montage.sheetBoardState.recentColors}
                onSelectPage={setSelectedPageId}
                onAddBlankPage={montage.addBlankPage}
                onAutoAddBlankPages={montage.autoAddBlankPages}
                onReorderPages={montage.reorderPages}
                onResetOrder={montage.resetPageOrder}
                onDeletePage={montage.deletePage}
                onDeleteSource={montage.deleteSource}
                onBlankPageColorChange={montage.setBlankPageColor}
              />
            </aside>
            <section className="min-w-0" aria-label="Booklet canvas">
              <div className="flex min-w-0 flex-col gap-4">
                {montage.error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                    {montage.error}
                  </div>
                )}
                {largeProjectWarning && performanceSettings.preset !== 'low-end' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <span>{largeProjectWarning}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPerformancePreset('low-end')}
                    >
                      Switch to Low-end PC mode
                    </Button>
                  </div>
                )}
                {viewMode === 'sheet' && (
                  <>
                    <ModeHeading title={t('Sheet Mode')} />
                    <div className="flex min-h-[360px] items-center justify-center rounded-[18px] border border-border/60 bg-muted/30 p-6">
                      {montage.pages.length ? (
                        (() => {
                          const page =
                            montage.pages.find((item) => item.id === selectedPageId) ??
                            montage.pages[0]
                          return (
                            <figure className="flex max-w-full flex-col items-center gap-4">
                              {page.thumbnailUrl ? (
                                <img
                                  src={page.thumbnailUrl}
                                  alt={page.displayName || page.label}
                                  className="max-h-[60vh] max-w-full rounded-sm bg-white shadow-sm"
                                />
                              ) : (
                                <div
                                  className="grid h-80 w-56 place-items-center border bg-white text-sm text-muted-foreground"
                                  style={{ backgroundColor: page.colorHex }}
                                >
                                  {t('Blank page')}
                                </div>
                              )}
                              <figcaption className="text-xs text-muted-foreground">
                                {page.displayName || page.label} · {page.widthMm.toFixed(1)} ×{' '}
                                {page.heightMm.toFixed(1)} mm
                              </figcaption>
                            </figure>
                          )
                        })()
                      ) : (
                        <div className="max-w-xs text-center">
                          <h3 className="text-base font-semibold">{t('No document loaded')}</h3>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {t(
                              'Import a PDF or images with the toolbar above. Your pages appear on the left, ready to arrange.'
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {viewMode === 'montage' && (
                  <>
                    <ModeHeading title={t('Montage Mode')} />
                    <SheetPreview
                      sheets={montage.sheets}
                      sources={montage.sources}
                      settings={montage.settings}
                      pageCountIsValid={montage.pageCountIsValid}
                      selectedItemId={selectedItemId}
                      inspectedItemId={inspectedItemId}
                      boardState={montage.sheetBoardState}
                      onInspectItem={inspectSheetItem}
                      onCloseInspect={closeSheetInspection}
                      onMoveItem={montage.moveSheetBoardItem}
                      onDeleteItem={montage.deleteSheetBoardItem}
                      onDuplicateItem={montage.duplicateSheetBoardItem}
                      onEmptySheetColorChange={montage.setEmptySheetColor}
                    />
                  </>
                )}

                {viewMode === 'book' && (
                  <>
                    <ModeHeading title={t('3D Book Mode')} />
                    <BookFlipPreview
                      orderedPages={montage.pages}
                      sources={montage.sources}
                      settings={montage.settings}
                    />
                  </>
                )}
              </div>
            </section>
            <aside
              aria-label="Booklet properties"
              className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto"
            >
              <BookletToolbar
                variant="properties"
                settings={montage.settings}
                viewMode={viewMode}
                blanksNeeded={montage.blanksNeeded}
                physicalSheetCount={montage.sheets.length}
                hasBoardItems={montage.sheetBoardState.items.length > 0}
                canExport={canExport}
                isBusy={importIsBusy || exportIsBusy}
                importProgress={montage.importProgress}
                exportProgress={montage.exportProgress}
                onImportPdf={(files) => void importPdfFiles(files)}
                onImportImages={montage.importImages}
                onCancelImport={montage.cancelImport}
                onCancelExport={montage.cancelExport}
                onSettingsChange={montage.updateSettings}
                onAutoAddBlankPages={montage.autoAddBlankPages}
                onAddEmptySheet={montage.addEmptySheet}
                onResetSheetLayout={montage.resetSheetLayout}
                onExportImages={(format) =>
                  requestBookletAction(() => void montage.exportImages(format))
                }
                onViewModeChange={setViewMode}
              />
            </aside>
          </div>
        </CardContent>
      </Card>
      {pendingExport && (
        <PreflightDialog
          report={pendingExport.report}
          action={pendingExport.action}
          onCancel={() => setPendingExport(null)}
          onConfirm={() => {
            const run = pendingExport.run
            setPendingExport(null)
            run()
          }}
        />
      )}
    </div>
  )
}

function getProjectErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong with the project file.'
}

function getUnsavedBookletName(sourceName?: string): string {
  return sourceName?.replace(/\.[^.]+$/, '') || 'Untitled Booklet Project'
}

function getEmptyBookletProjectStateKey(
  settings: Parameters<typeof getBookletProjectStateKey>[0]['settings']
): string {
  return getBookletProjectStateKey({
    sources: [],
    pages: [],
    settings,
    sheetBoardState: { items: [], recentColors: [] }
  })
}

function ModeHeading({ title }: { title: string }): JSX.Element {
  return (
    <div className="border-b border-border/60 px-1 pb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  )
}
