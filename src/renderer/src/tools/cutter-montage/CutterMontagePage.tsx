import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { usePerformanceSettings } from '@/performance/usePerformanceSettings'
import { ProjectFileActions } from '@/projects/ProjectFileActions'
import {
  createCutterProjectFile,
  getSuggestedProjectFileName,
  type CutterProjectPayload
} from '@/projects/projectFiles'
import type { AppRoute } from '@/types/navigation'
import type {
  OpenedPrinterProject,
  PrinterAppProjectResult,
  ProjectMetadata
} from '@/types/projects'
import { CutterToolbar } from './components/CutterToolbar'
import { ExportCutterPanel } from './components/ExportCutterPanel'
import { LayerVisibilityControls } from './components/LayerVisibilityControls'
import { MontageArtboard } from './components/MontageArtboard'
import { PieceEditor } from './components/PieceEditor'
import { PieceLibrary } from './components/PieceLibrary'
import { useCutterProject } from './hooks/useCutterProject'
import { CUT_CONTOUR_NAME, normalizeSpotName } from './lib/colorSpot'

interface CutterMontagePageProps {
  onNavigate: (route: AppRoute) => void
  openedProject?: OpenedPrinterProject<CutterProjectPayload> | null
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
}

export function CutterMontagePage({
  onNavigate,
  openedProject,
  onOpenProject
}: CutterMontagePageProps): JSX.Element {
  const { settings: performanceSettings } = usePerformanceSettings()
  const cutter = useCutterProject(openedProject?.project)
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

  const saveProject = async (saveAs: boolean): Promise<void> => {
    if (!window.printerApp?.saveProject) {
      setProjectMessage('Project saving is only available in the desktop app.')
      return
    }

    setProjectIsBusy(true)
    setProjectMessage('Saving project...')

    try {
      const project = createCutterProjectFile({
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
        exportSettings: {
          strokeName: normalizeSpotName(CUT_CONTOUR_NAME),
          includeArtwork: cutter.layers.artwork,
          includeCutlines: cutter.layers.cutlines
        },
        existingMetadata: projectMetadata
      })
      const result = await window.printerApp.saveProject({
        suggestedName: getSuggestedProjectFileName(project.metadata.jobName),
        filePath: saveAs ? null : projectFilePath,
        project
      })

      if (result.canceled) {
        setProjectMessage('Save canceled.')
        return
      }

      if (!result.ok || !result.filePath) {
        throw new Error(result.error ?? 'Could not save this cutter project.')
      }

      setProjectFilePath(result.filePath)
      setProjectMetadata(project.metadata)
      setProjectMessage(`Saved ${project.metadata.jobName}`)
    } catch (error) {
      setProjectMessage(getProjectErrorMessage(error))
    } finally {
      setProjectIsBusy(false)
    }
  }

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

  const startNewProject = (): void => {
    cutter.clearProject()
    setProjectFilePath(null)
    setProjectMetadata(null)
    setProjectMessage('Started a new cutter project.')
  }

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-5">
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => onNavigate('dashboard')}
        type="button"
      >
        <ArrowLeft data-icon="inline-start" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">Cutter Layer + Big Sheet Montage</CardTitle>
              <Badge variant="warning">MVP Beta</Badge>
            </div>
            <CardDescription>
              Prepare masked sticker pieces, align vector CutContour paths, then arrange them on a real-size roll sheet.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ProjectFileActions
              filePath={projectFilePath}
              isBusy={projectIsBusy}
              message={projectMessage}
              onOpen={() => void openProject()}
              onSave={() => void saveProject(false)}
              onSaveAs={() => void saveProject(true)}
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={startNewProject}>
                New Project
              </Button>
              <Badge variant="secondary">{performanceSettings.label}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CutterToolbar
            mode={cutter.mode}
            settings={cutter.sheet}
            warnings={cutter.warnings}
            hasPieces={cutter.pieces.length > 0}
            onModeChange={cutter.setMode}
            onSettingsChange={cutter.updateSheet}
            onAutoArrange={cutter.runAutoArrange}
          />

          {cutter.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {cutter.error}
            </div>
          )}

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {cutter.status}
          </div>

          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="flex flex-col gap-4">
              <PieceLibrary
                pieces={cutter.pieces}
                activePieceId={cutter.activePieceId}
                onImport={cutter.importDesignFiles}
                onEditPiece={cutter.editPiece}
                onDuplicatePiece={cutter.duplicatePiece}
                onDeletePiece={cutter.deletePiece}
                onAddToSheet={cutter.addPieceToSheet}
                onPieceQuantityChange={cutter.updatePieceQuantity}
                onPieceRotationAllowedChange={cutter.updatePieceRotationAllowed}
              />
              <LayerVisibilityControls
                layers={cutter.layers}
                settings={cutter.sheet}
                onLayerChange={(patch) =>
                  cutter.setLayers((current) => ({ ...current, ...patch }))
                }
                onSettingsChange={cutter.updateSheet}
              />
              <ExportCutterPanel
                canExport={cutter.canExport}
                onExportSvg={cutter.handleExportSvg}
                onExportPdf={cutter.handleExportPdf}
                onExportEps={cutter.handleExportEps}
              />
            </aside>

            {cutter.mode === 'piece-editor' ? (
              <PieceEditor
                piece={cutter.activePiece}
                selectedObjects={cutter.selectedEditorObjects}
                keyObject={cutter.keyObject}
                onPieceChange={cutter.updatePiece}
                onSelectedObjectsChange={cutter.setSelectedEditorObjects}
                onSetKeyObject={(object) => cutter.setKeyObject({ object })}
                onSave={cutter.markPieceSaved}
                onDuplicate={() =>
                  cutter.activePiece && cutter.duplicatePiece(cutter.activePiece.id)
                }
              />
            ) : (
              <MontageArtboard
                settings={cutter.sheet}
                pieces={cutter.pieces}
                placedPieces={cutter.placedPieces}
                selectedPieceIds={cutter.selectedPlacedIds}
                layers={cutter.layers}
                onHeightChange={(heightCm) => cutter.updateSheet({ heightCm })}
                onSelectPiece={cutter.selectPlacedPiece}
                onMovePiece={cutter.movePlacedPiece}
                onResizePiece={cutter.resizePlacedPiece}
                onDuplicatePieces={cutter.duplicatePlacedPieces}
                onDeletePieces={cutter.deletePlacedPieces}
                onRotatePiece={cutter.rotatePlacedPiece}
                onToggleLock={cutter.togglePlacedLock}
                onNudgeSelected={cutter.nudgeSelected}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function getProjectErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong with the project file.'
}
