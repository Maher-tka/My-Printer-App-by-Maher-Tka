import { StickerLibraryRail } from './components/StickerLibraryRail'
import { StickerQuantities } from './components/StickerQuantities'
import { AIStickerMaker } from './components/AIStickerMaker'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createProjectPrinterJob } from '@/jobs/projectJob'
import { useJobStore } from '@/jobs/useJobStore'
import { getCutterProjectStateKey } from '@/projects/projectDirtyState'
import {
  createCutterProjectFile,
  getSuggestedProjectFileName,
  type CutterProjectPayload
} from '@/projects/projectFiles'
import type { AppRoute } from '@/types/navigation'
import type {
  ActiveProjectSession,
  OpenedPrinterProject,
  PrinterAppProjectResult,
  ProjectMetadata
} from '@/types/projects'
import type { UnsavedChangesAction } from '../../../../shared/project-types'
import { CutterToolbar } from './components/CutterToolbar'
import { CutlineInspector } from './components/CutlineInspector'
import { ExportCutterPanel } from './components/ExportCutterPanel'
import { LayerVisibilityControls } from './components/LayerVisibilityControls'
import { MontageArtboard } from './components/MontageArtboard'
import { PieceEditor } from './components/PieceEditor'
import { PieceLibrary } from './components/PieceLibrary'
import { PdfPageImportDialog } from './components/PdfPageImportDialog'
import { PreflightPanel } from './components/PreflightPanel'
import { SheetUsageStats } from './components/SheetUsageStats'
import { useCutterProject } from './hooks/useCutterProject'
import { DEFAULT_CUTTER_SHEET } from './lib/cutterLayout'
import { TARGET_CUTTER_LABEL, TARGET_CUTTER_PROFILE } from './lib/cutterDeviceProfile'
import { getDefaultCutterExportSettings } from './lib/exportPresets'
import { resizeFinishedStickerWidth } from './lib/stickerCutterAdapter'
import { getProductionSheetLayoutGroups } from './lib/productionSheetGroups'
import {
  getPlacedSheetIndex,
  getMarkedSheetWidth,
  getProductionSheetCount,
  getProductionSheetHeight
} from './lib/productionSheets'
import type { CutterProject } from './types'

interface PendingCutterImageImport {
  id: number
  files: File[]
}

interface CutterMontagePageProps {
  onNavigate: (route: AppRoute) => void
  openedProject?: OpenedPrinterProject<CutterProjectPayload> | null
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
  onProjectSessionChange: (session: ActiveProjectSession | null) => void
  onConfirmUnsavedChanges: (action: UnsavedChangesAction) => Promise<boolean>
  initialImageImport?: PendingCutterImageImport | null
  onInitialImageImportConsumed?: (requestId: number) => void
}

export function CutterMontagePage({
  onNavigate,
  openedProject,
  onOpenProject,
  onProjectSessionChange,
  onConfirmUnsavedChanges,
  initialImageImport,
  onInitialImageImportConsumed
}: CutterMontagePageProps): JSX.Element {
  const cutter = useCutterProject(openedProject?.project)
  const { saveJob } = useJobStore()
  const [projectFilePath, setProjectFilePath] = useState<string | null>(
    openedProject?.filePath ?? null
  )
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | null>(
    openedProject?.project.metadata ?? null
  )
  const [projectIsBusy, setProjectIsBusy] = useState(false)
  const [projectMessage, setProjectMessage] = useState<string | null>(
    openedProject ? `Opened ${openedProject.project.metadata.jobName}` : null
  )
  const consumedImageImportIdsRef = useRef(new Set<number>())
  const [step, setStep] = useState<'prepare' | 'cut' | 'quantity' | 'layout'>('prepare')
  const [stickerMakerOpen, setStickerMakerOpen] = useState(false)
  const changeStep = (next: typeof step) => {
    setStep(next)
    setPanel(null)
    cutter.setMode(next === 'layout' ? 'montage-sheet' : 'piece-editor')
  }
  const [panel, setPanel] = useState<'designs' | 'view' | 'export' | 'checks' | null>(null)
  const [printPreview, setPrintPreview] = useState(false)
  const editorWorkspaceRef = useRef<HTMLDivElement>(null)
  const productionSheetRefs = useRef<Array<HTMLDivElement | null>>([])
  const [previewSheetIndex, setPreviewSheetIndex] = useState(0)
  const productionSheetCount = useMemo(
    () => getProductionSheetCount(cutter.placedPieces),
    [cutter.placedPieces]
  )
  const productionSheetLayoutGroups = useMemo(
    () =>
      getProductionSheetLayoutGroups({
        sheet: cutter.sheet,
        sources: cutter.sources,
        pieces: cutter.pieces,
        placedPieces: cutter.placedPieces,
        layers: cutter.layers,
        exportSettings: cutter.exportSettings
      }),
    [
      cutter.exportSettings,
      cutter.layers,
      cutter.pieces,
      cutter.placedPieces,
      cutter.sheet,
      cutter.sources
    ]
  )
  const productionLayoutCount = productionSheetLayoutGroups.length
  useEffect(() => {
    setPreviewSheetIndex((current) => Math.min(current, productionLayoutCount - 1))
  }, [productionLayoutCount])
  const productionLayouts = useMemo(
    () =>
      productionSheetLayoutGroups.map((group, layoutIndex) => {
        const sheetIndex = group.templateSheetIndex

        return {
          ...group,
          layoutIndex,
          placedPieces: cutter.placedPieces.filter(
            (piece) => getPlacedSheetIndex(piece) === sheetIndex
          ),
          settings: {
            ...cutter.sheet,
            widthCm: getMarkedSheetWidth(cutter.placedPieces, cutter.sheet, sheetIndex),
            heightCm: getProductionSheetHeight(cutter.placedPieces, cutter.sheet, sheetIndex)
          }
        }
      }),
    [cutter.placedPieces, cutter.sheet, productionSheetLayoutGroups]
  )
  const selectProductionSheet = useCallback(
    (layoutIndex: number, scrollIntoView = false): void => {
      const boundedIndex = Math.min(Math.max(layoutIndex, 0), productionLayoutCount - 1)
      setPreviewSheetIndex(boundedIndex)

      if (scrollIntoView) {
        requestAnimationFrame(() => {
          productionSheetRefs.current[boundedIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          })
        })
      }
    },
    [productionLayoutCount]
  )

  useEffect(() => {
    if (!initialImageImport || consumedImageImportIdsRef.current.has(initialImageImport.id)) {
      return
    }

    consumedImageImportIdsRef.current.add(initialImageImport.id)
    void cutter
      .importDesignFiles(initialImageImport.files)
      .finally(() => onInitialImageImportConsumed?.(initialImageImport.id))
  }, [cutter.importDesignFiles, initialImageImport, onInitialImageImportConsumed])

  const projectStateKey = useMemo(
    () =>
      getCutterProjectStateKey({
        sources: cutter.sources,
        pieces: cutter.pieces,
        placedPieces: cutter.placedPieces,
        sheet: cutter.sheet,
        layers: cutter.layers,
        exportSettings: cutter.exportSettings
      }),
    [
      cutter.exportSettings,
      cutter.layers,
      cutter.pieces,
      cutter.placedPieces,
      cutter.sheet,
      cutter.sources
    ]
  )
  const [savedProjectStateKey, setSavedProjectStateKey] = useState(projectStateKey)
  const isDirty = projectStateKey !== savedProjectStateKey
  const projectName =
    projectMetadata?.jobName ??
    cutter.pieces[0]?.displayName ??
    cutter.sources[0]?.displayName ??
    'Untitled Cutter Project'
  const cutterProject = useMemo<CutterProject>(
    () => ({
      sheet: cutter.sheet,
      sources: cutter.sources,
      pieces: cutter.pieces,
      placedPieces: cutter.placedPieces,
      layers: cutter.layers,
      exportSettings: cutter.exportSettings,
      productionInfo: {
        jobName: projectName,
        appName: 'My Printer App by Maher Tka',
        targetCutterProfileId: TARGET_CUTTER_PROFILE.id,
        targetCutterLabel: TARGET_CUTTER_LABEL,
        integrationMode: TARGET_CUTTER_PROFILE.integrationMode
      }
    }),
    [
      cutter.exportSettings,
      cutter.layers,
      cutter.pieces,
      cutter.placedPieces,
      cutter.sheet,
      cutter.sources,
      projectName
    ]
  )
  const createProjectSnapshot = useCallback(
    () =>
      createCutterProjectFile({
        mode: cutter.mode,
        activePieceId: cutter.activePieceId,
        selectedPlacedIds: cutter.selectedPlacedIds,
        selectedEditorObjects: cutter.selectedEditorObjects,
        keyObject: cutter.keyObject,
        sheet: cutter.sheet,
        sources: cutter.sources,
        pieces: cutter.pieces,
        placedPieces: cutter.placedPieces,
        layers: cutter.layers,
        exportSettings: cutter.exportSettings,
        existingMetadata: projectMetadata
      }),
    [
      cutter.activePieceId,
      cutter.exportSettings,
      cutter.keyObject,
      cutter.layers,
      cutter.mode,
      cutter.pieces,
      cutter.placedPieces,
      cutter.selectedEditorObjects,
      cutter.selectedPlacedIds,
      cutter.sheet,
      cutter.sources,
      projectMetadata
    ]
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
          throw new Error(result.error ?? 'Could not save this cutter project.')
        }

        setProjectFilePath(result.filePath)
        setProjectMetadata(project.metadata)
        saveJob(
          createProjectPrinterJob({
            id: project.metadata.id,
            tool: 'cutter',
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

    setSavedProjectStateKey(getEmptyCutterProjectStateKey())
    cutter.clearProject()
    setStep('prepare')
    setPanel(null)
    setProjectFilePath(null)
    setProjectMetadata(null)
    setProjectMessage('Started a new cutter project.')
  }

  const editPieceAndFocus = useCallback(
    (pieceId: string): void => {
      cutter.editPiece(pieceId)
      if (step === 'layout') cutter.setMode('montage-sheet')
      setPanel(null)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          editorWorkspaceRef.current?.focus({ preventScroll: true })
          editorWorkspaceRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          })
        })
      })
    },
    [cutter.editPiece, step]
  )

  useEffect(() => {
    onProjectSessionChange({
      isDirty,
      projectName,
      filePath: projectFilePath,
      snapshot: createProjectSnapshot(),
      preflight: {
        warningsCount: cutter.preflight.issues.length,
        preflightStatus: cutter.preflight.canExport
          ? cutter.preflight.issues.length
            ? 'warnings'
            : 'passed'
          : 'errors'
      },
      save: () => saveProject(false)
    })
  }, [
    createProjectSnapshot,
    cutter.preflight.canExport,
    cutter.preflight.issues.length,
    isDirty,
    onProjectSessionChange,
    projectFilePath,
    projectName,
    saveProject
  ])

  useEffect(() => () => onProjectSessionChange(null), [onProjectSessionChange])

  return (
    <div className="workspace-shell cutter-workspace mx-auto flex w-full min-w-0 max-w-none flex-col overflow-hidden lg:h-[calc(100dvh-8rem)]">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0 flex-row flex-wrap items-center justify-between gap-3 border-b bg-card/80 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              aria-label={stickerMakerOpen ? 'Back to Cutter Montage' : 'Back to dashboard'}
              onClick={() => {
                if (stickerMakerOpen) {
                  setStickerMakerOpen(false)
                } else {
                  onNavigate('dashboard')
                }
              }}
            >
              <ArrowLeft />
            </Button>
            <div>
              <CardTitle className="text-base">Cutter workspace</CardTitle>
              <p className="max-w-56 truncate text-xs text-muted-foreground">{projectName}</p>
            </div>
          </div>
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={stickerMakerOpen ? 'default' : 'outline'}
              onClick={() => setStickerMakerOpen((current) => !current)}
            >
              AI Sticker Maker
            </Button>
            <span
              className="text-xs text-muted-foreground"
              title={projectFilePath ?? 'Not saved yet'}
            >
              {isDirty ? 'Unsaved' : 'Saved'}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={projectIsBusy}
              onClick={() => void openProject()}
            >
              Open
            </Button>
            <Button size="sm" disabled={projectIsBusy} onClick={() => void saveProject(false)}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={projectIsBusy}
              onClick={() => void saveProject(true)}
            >
              Save as
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void startNewProject()}
              >
                New Project
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <div className={stickerMakerOpen ? 'flex min-h-0 flex-1' : 'hidden'}>
            <AIStickerMaker
              onSend={(results, offsetMm) => {
                cutter.addStickerResults(results, offsetMm)
                setStep('layout')
              }}
              onClose={() => setStickerMakerOpen(false)}
            />
          </div>
          {!stickerMakerOpen && (
            <Tabs
              value={step}
              onValueChange={(value) => changeStep(value as typeof step)}
              className="flex min-h-0 flex-1 flex-col gap-3"
            >
              <TabsList className="grid h-10 w-full grid-cols-4" aria-label="Cutter workflow steps">
                <TabsTrigger value="prepare">1. Prepare artwork</TabsTrigger>
                <TabsTrigger value="cut">2. Cut lines</TabsTrigger>
                <TabsTrigger value="quantity">3. Quantities</TabsTrigger>
                <TabsTrigger value="layout">4. Layout & export</TabsTrigger>
              </TabsList>
              {step === 'layout' && (
                <>
                  <CutterToolbar
                    hideModeSwitcher
                    mode={cutter.mode}
                    settings={cutter.sheet}
                    warnings={cutter.warnings}
                    hasPieces={cutter.pieces.length > 0}
                    onModeChange={(mode) => changeStep(mode === 'piece-editor' ? 'cut' : 'layout')}
                    onSettingsChange={cutter.updateSheet}
                    onAutoArrange={cutter.runAutoArrange}
                    onUndoAutoArrange={cutter.undoAutoArrange}
                    onCreateTestProject={import.meta.env.DEV ? cutter.createTestMontage : undefined}
                  />
                </>
              )}

              {cutter.error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {cutter.error}
                </div>
              )}

              <div
                className="flex shrink-0 flex-wrap items-center gap-2 border-b pb-2"
                aria-label="Workspace panels"
              >
                {(step === 'layout' ? (['view', 'export', 'checks'] as const) : []).map((item) => (
                  <Button
                    key={item}
                    size="sm"
                    variant={panel === item ? 'secondary' : 'ghost'}
                    aria-expanded={panel === item}
                    aria-controls="cutter-workspace-panel"
                    onClick={() => setPanel(panel === item ? null : item)}
                  >
                    {
                      {
                        view: 'View',
                        export: 'Export',
                        checks: 'Checks'
                      }[item]
                    }
                  </Button>
                ))}
                <span
                  className="ml-auto truncate text-xs text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {projectMessage ?? cutter.status}
                </span>
              </div>
              <TabsContent
                value={step}
                className="relative mt-0 grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)] gap-3"
              >
                <StickerLibraryRail
                  pieces={cutter.pieces}
                  activeId={cutter.activePieceId}
                  onSelect={editPieceAndFocus}
                  onImport={(files) => void cutter.importDesignFiles(files)}
                  onDuplicate={cutter.duplicatePiece}
                  onDelete={cutter.deletePiece}
                  onManage={() => setPanel('designs')}
                  showProductionControls={step === 'layout'}
                  onQuantity={(id, quantity) => {
                    const piece = cutter.pieces.find((item) => item.id === id)
                    if (piece) cutter.updatePiece({ ...piece, quantity, orderMode: 'copies' })
                  }}
                  onFinishedWidthChange={(id, widthMm) => {
                    const piece = cutter.pieces.find((item) => item.id === id)
                    if (piece) cutter.updatePiece(resizeFinishedStickerWidth(piece, widthMm))
                  }}
                />
                <div className="relative flex min-h-0 min-w-0 gap-3">
                  {panel && (
                    <aside
                      id="cutter-workspace-panel"
                      aria-label={`${panel} panel`}
                      className="order-last flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[var(--ui-radius-lg)] border bg-card/80 2xl:w-[304px]"
                    >
                      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
                        <strong className="text-sm capitalize">{panel}</strong>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Close workspace panel"
                          onClick={() => setPanel(null)}
                        >
                          <X />
                        </Button>
                      </div>
                      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
                        {panel === 'designs' && (
                          <>
                            <PieceLibrary
                              pieces={cutter.pieces}
                              activePieceId={cutter.activePieceId}
                              onImport={cutter.importDesignFiles}
                              onEditPiece={editPieceAndFocus}
                              onDuplicatePiece={cutter.duplicatePiece}
                              onDeletePiece={cutter.deletePiece}
                              onAddToSheet={cutter.addPieceToSheet}
                              onAddSelectedToSheet={cutter.addPiecesToSheet}
                              onAutoArrangeSelected={cutter.runAutoArrangeForPieces}
                              onDeleteUnusedPieces={cutter.deleteUnusedPieces}
                              onPieceQuantityChange={cutter.updatePieceQuantity}
                              onPieceTargetLengthChange={cutter.updatePieceTargetLength}
                              onPieceRotationAllowedChange={cutter.updatePieceRotationAllowed}
                              onRename={cutter.renamePiece}
                            />
                          </>
                        )}
                        {panel === 'view' && (
                          <>
                            <LayerVisibilityControls
                              layers={cutter.layers}
                              settings={cutter.sheet}
                              onLayerChange={(patch) =>
                                cutter.setLayers((current) => ({ ...current, ...patch }))
                              }
                              onSettingsChange={cutter.updateSheet}
                            />
                            {cutter.mode === 'montage-sheet' && (
                              <label className="flex items-center gap-2 p-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={printPreview}
                                  onChange={(e) => setPrintPreview(e.target.checked)}
                                />
                                Print preview (hide editing overlays)
                              </label>
                            )}
                          </>
                        )}
                        {panel === 'export' && (
                          <>
                            <ExportCutterPanel
                              fineCutBusy={cutter.fineCutBusy}
                              layoutNumber={previewSheetIndex + 1}
                              onPrepareFineCut={() =>
                                void cutter.prepareFineCut(
                                  productionLayouts[previewSheetIndex]?.templateSheetIndex ?? 0
                                )
                              }
                              canExport={cutter.canExport}
                              settings={cutter.exportSettings}
                              sheet={cutter.sheet}
                              onModeChange={cutter.setExportMode}
                              onSettingsChange={cutter.setExportSettings}
                              onSheetChange={cutter.updateSheet}
                              onPresetChange={cutter.applyExportPreset}
                              onExportSvg={cutter.handleExportSvg}
                              onExportPdf={cutter.handleExportPdf}
                              onExportEps={cutter.handleExportEps}
                              onBatchExport={cutter.handleBatchExport}
                            />
                          </>
                        )}
                        {panel === 'checks' && (
                          <>
                            <CutlineInspector
                              piece={cutter.activePiece}
                              onPieceChange={cutter.updatePiece}
                            />
                            <PreflightPanel
                              report={cutter.preflight}
                              placedCount={cutter.placedPieces.length}
                            />
                            <SheetUsageStats project={cutterProject} />
                          </>
                        )}
                      </div>
                    </aside>
                  )}

                  <div
                    ref={editorWorkspaceRef}
                    tabIndex={-1}
                    className="min-h-0 min-w-0 flex-1 outline-none"
                  >
                    {step === 'quantity' ? (
                      <StickerQuantities
                        pieces={cutter.pieces}
                        onQuantity={cutter.updatePieceQuantity}
                        onEdit={(id) => {
                          editPieceAndFocus(id)
                          changeStep('cut')
                        }}
                        onContinue={() => {
                          cutter.runAutoArrange()
                          changeStep('layout')
                        }}
                      />
                    ) : step !== 'layout' ? (
                      <PieceEditor
                        inspectorHidden={panel === 'designs'}
                        stage={step === 'prepare' ? 'prepare' : 'cut'}
                        onBackgroundApply={cutter.applyArtworkEdit}
                        piece={cutter.activePiece}
                        onPieceChange={cutter.updatePiece}
                        onSave={cutter.markPieceSaved}
                        onDuplicate={() =>
                          cutter.activePiece && cutter.duplicatePiece(cutter.activePiece.id)
                        }
                      />
                    ) : (
                      <div className="flex h-full min-h-0 min-w-0 flex-col">
                        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                          <div className="text-sm">
                            <strong>
                              {productionLayoutCount} unique sheet layout
                              {productionLayoutCount === 1 ? '' : 's'} for {productionSheetCount}{' '}
                              physical sheet{productionSheetCount === 1 ? '' : 's'}
                            </strong>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {cutter.placedPieces.length} total copies · Select a sticker on the
                              left to set copies and finished width · Layout {previewSheetIndex + 1}{' '}
                              selected for Mimaki package review
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              disabled={previewSheetIndex === 0}
                              onClick={() => selectProductionSheet(previewSheetIndex - 1, true)}
                              aria-label="Select previous production layout"
                            >
                              <ChevronLeft />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              disabled={previewSheetIndex >= productionLayoutCount - 1}
                              onClick={() => selectProductionSheet(previewSheetIndex + 1, true)}
                              aria-label="Select next production layout"
                            >
                              <ChevronRight />
                            </Button>
                          </div>
                        </div>
                        <div className="min-h-0 flex-1" data-production-sheet-stack="false">
                          {productionLayouts
                            .filter((layout) => layout.layoutIndex === previewSheetIndex)
                            .map((productionLayout) => {
                              const sheetPieceIds = new Set(
                                productionLayout.placedPieces.map((piece) => piece.id)
                              )
                              const selectedPieceIds = cutter.selectedPlacedIds.filter((pieceId) =>
                                sheetPieceIds.has(pieceId)
                              )
                              const active = previewSheetIndex === productionLayout.layoutIndex

                              return (
                                <div
                                  key={productionLayout.signature}
                                  ref={(node) => {
                                    productionSheetRefs.current[productionLayout.layoutIndex] = node
                                  }}
                                  className="h-full min-h-0"
                                >
                                  <MontageArtboard
                                    settings={productionLayout.settings}
                                    pieces={cutter.pieces}
                                    placedPieces={productionLayout.placedPieces}
                                    totalPlacedCount={cutter.placedPieces.length}
                                    selectedPieceIds={selectedPieceIds}
                                    layers={cutter.layers}
                                    onHeightChange={cutter.resizeSheetHeight}
                                    allowHeightResize={productionLayout.layoutIndex === 0}
                                    cleanArtworkPreview={printPreview}
                                    sheetNumber={productionLayout.layoutIndex + 1}
                                    sheetCount={productionLayoutCount}
                                    repeatCount={productionLayout.repeatCount}
                                    physicalSheetNumbers={productionLayout.sheetIndices.map(
                                      (sheetIndex) => sheetIndex + 1
                                    )}
                                    active={active}
                                    onActivate={() =>
                                      selectProductionSheet(productionLayout.layoutIndex, false)
                                    }
                                    onSelectPiece={cutter.selectPlacedPiece}
                                    onMovePiece={cutter.movePlacedPiece}
                                    onResizePiece={cutter.resizePlacedPiece}
                                    onDuplicatePieces={cutter.duplicatePlacedPieces}
                                    onDeletePieces={cutter.deletePlacedPieces}
                                    onRotatePiece={cutter.rotatePlacedPiece}
                                    onToggleLock={cutter.togglePlacedLock}
                                    onNudgeSelected={cutter.nudgeSelected}
                                    outOfBoundsPieceIds={[
                                      ...cutter.preflight.outOfBoundsIds,
                                      ...cutter.preflight.safeAreaOutOfBoundsIds
                                    ]}
                                    overlapPieceIds={cutter.preflight.overlapIds}
                                    onAlignSelected={cutter.alignSelected}
                                  />
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              <div className="flex shrink-0 justify-between gap-2 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={step === 'prepare'}
                  onClick={() =>
                    changeStep(
                      step === 'cut' ? 'prepare' : step === 'quantity' ? 'cut' : 'quantity'
                    )
                  }
                >
                  Previous step
                </Button>
                {step !== 'layout' && (
                  <Button
                    size="sm"
                    disabled={!cutter.pieces.length}
                    onClick={() => {
                      if (step === 'quantity') cutter.runAutoArrange()
                      changeStep(
                        step === 'prepare' ? 'cut' : step === 'cut' ? 'quantity' : 'layout'
                      )
                    }}
                  >
                    {step === 'prepare'
                      ? 'Next: cut lines'
                      : step === 'cut'
                        ? 'Next: quantities'
                        : 'Next: layout & export'}
                  </Button>
                )}
              </div>
            </Tabs>
          )}
        </CardContent>
      </Card>
      {cutter.pdfImportSession && (
        <PdfPageImportDialog
          session={cutter.pdfImportSession}
          busy={cutter.isPdfImportBusy}
          onLoadMore={cutter.loadMorePdfPages}
          onCancel={cutter.cancelPdfImport}
          onImport={cutter.importSelectedPdfPages}
        />
      )}
    </div>
  )
}

function getProjectErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong with the project file.'
}

function getEmptyCutterProjectStateKey(): string {
  return getCutterProjectStateKey({
    sources: [],
    pieces: [],
    placedPieces: [],
    sheet: DEFAULT_CUTTER_SHEET,
    layers: { artwork: true, cutlines: true },
    exportSettings: getDefaultCutterExportSettings()
  })
}
