import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Ruler,
  Settings2,
  Trash2,
  UserRound
} from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createPrintedJob } from '@/jobs/printHistory'
import { useJobStore } from '@/jobs/useJobStore'
import { usePerformanceSettings } from '@/performance/usePerformanceSettings'
import { getPrintResultMessage, printPdf } from '@/print/printPdf'
import { runHardcoverPreflight } from '@/preflight/hardcoverPreflight'
import { PreflightDialog } from '@/preflight/preflightUI'
import type { PreflightReport } from '@/preflight/preflightTypes'
import { ProjectFileActions } from '@/projects/ProjectFileActions'
import { getHardcoverProjectStateKey } from '@/projects/projectDirtyState'
import {
  createHardcoverProjectFile,
  getSuggestedProjectFileName,
  type HardcoverProjectPayload
} from '@/projects/projectFiles'
import type { AppRoute } from '@/types/navigation'
import type {
  ActiveProjectSession,
  OpenedPrinterProject,
  PrinterAppProjectResult,
  ProjectMetadata
} from '@/types/projects'
import type { UnsavedChangesAction } from '../../../../shared/project-types'
import { CoverCanvas } from './components/CoverCanvas'
import { CoverSetupPanel } from './components/CoverSetupPanel'
import { ExportHardcoverPanel } from './components/ExportHardcoverPanel'
import { EditorSection, TextAreaField, TextField } from './components/FrontCoverEditor'
import { HardcoverToolbar } from './components/HardcoverToolbar'
import { SpineEditor } from './components/SpineEditor'
import { createDefaultHardcoverProject, useHardcoverProject } from './hooks/useHardcoverProject'
import { exportHardcoverImage } from './lib/hardcoverExportImages'
import { exportHardcoverSvg } from './lib/hardcoverExportSvg'
import { resolveAutomaticSpineBackgroundColor } from './lib/spineBackground'

interface HardcoverCoverPageProps {
  onNavigate: (route: AppRoute) => void
  openedProject?: OpenedPrinterProject<HardcoverProjectPayload> | null
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
  onProjectSessionChange: (session: ActiveProjectSession | null) => void
  onConfirmUnsavedChanges: (action: UnsavedChangesAction) => Promise<boolean>
}

const LazyCoverMockupPreview = lazy(() => import('./components/CoverMockupPreview'))

type HardcoverWorkflowStep = 'source' | 'measurements' | 'spine' | 'export'

const WORKFLOW_STEPS: Array<{
  id: HardcoverWorkflowStep
  label: string
  description: string
  icon: typeof FileText
}> = [
  {
    id: 'source',
    label: 'Source PDF',
    description: 'Choose front and optional back pages.',
    icon: FileText
  },
  {
    id: 'measurements',
    label: 'Book Measurements',
    description: 'Set board, spine, wrap, and direction.',
    icon: Ruler
  },
  {
    id: 'spine',
    label: 'Spine Text',
    description: 'Year, title, and student name.',
    icon: Settings2
  },
  {
    id: 'export',
    label: 'Export',
    description: 'Preflight and save production files.',
    icon: Download
  }
]

export function HardcoverCoverPage({
  onNavigate,
  openedProject,
  onOpenProject,
  onProjectSessionChange,
  onConfirmUnsavedChanges
}: HardcoverCoverPageProps): JSX.Element {
  const hardcover = useHardcoverProject(openedProject?.project.payload)
  const { settings: performanceSettings } = usePerformanceSettings()
  const { jobs, saveJob } = useJobStore()
  const [projectFilePath, setProjectFilePath] = useState(openedProject?.filePath ?? null)
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | null>(
    openedProject?.project.metadata ?? null
  )
  const [savedStateKey, setSavedStateKey] = useState(() =>
    getHardcoverProjectStateKey(hardcover.state)
  )
  const [isBusy, setIsBusy] = useState(false)
  const savedProjectStateRef = useRef(structuredClone(hardcover.state))
  const [message, setMessage] = useState<string | null>(
    openedProject ? `Opened ${openedProject.project.metadata.jobName}` : null
  )
  const [showLowEndMockup, setShowLowEndMockup] = useState(false)
  const [activeStep, setActiveStep] = useState<HardcoverWorkflowStep>('source')
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [pendingExport, setPendingExport] = useState<{
    report: PreflightReport
    run: () => void
    action: 'export' | 'print'
  } | null>(null)
  const stateKey = useMemo(() => getHardcoverProjectStateKey(hardcover.state), [hardcover.state])
  const isDirty = stateKey !== savedStateKey
  const projectName =
    projectMetadata?.jobName ||
    hardcover.state.job.jobTitle ||
    hardcover.state.content.front.studentName ||
    'Untitled Hardcover Cover'
  const hardcoverPreflight = useMemo(() => {
    const wrap = hardcover.state.setup.wrap
    return runHardcoverPreflight({
      bookWidthMm: hardcover.state.setup.boardWidthMm,
      bookHeightMm: hardcover.state.setup.boardHeightMm,
      spineWidthMm: hardcover.state.setup.spineWidthMm,
      wrapMarginsMm: [
        hardcover.state.setup.leftBandWidthMm,
        hardcover.state.setup.rightBandWidthMm,
        wrap.topMm,
        wrap.bottomMm
      ],
      fullWidthMm: hardcover.dimensions.fullWidthMm,
      fullHeightMm: hardcover.dimensions.fullHeightMm,
      title: hardcover.state.content.front.title,
      studentName: hardcover.state.content.front.studentName,
      studentNameRequired: true,
      spineTextFits: hardcover.spineLayout.fits,
      textInsideSafeZones: !hardcover.warnings.some((warning) => /safe/i.test(warning)),
      exportMode: hardcover.state.exportSettings.mode,
      paperWidthMm: hardcover.state.setup.paperWidthMm,
      paperHeightMm: hardcover.state.setup.paperHeightMm,
      bleedMm: hardcover.state.setup.bleedMm,
      hingeMm: hardcover.state.setup.hingeMm,
      includeCropMarks: hardcover.state.exportSettings.includeCropMarks,
      sourceGeometryWarnings: Array.from(
        new Set([
          ...(hardcover.state.sourcePdf?.frontPageGeometry?.warnings ?? []),
          ...(hardcover.state.sourcePdf?.backPageGeometry?.warnings ?? []),
          ...(hardcover.state.sourcePdf?.frontSource?.pageGeometry?.warnings ?? []),
          ...(hardcover.state.sourcePdf?.backSource?.pageGeometry?.warnings ?? [])
        ])
      )
    })
  }, [hardcover.dimensions, hardcover.spineLayout.fits, hardcover.state, hardcover.warnings])
  const automaticSpineColor = resolveAutomaticSpineBackgroundColor(hardcover.state)

  const createProjectSnapshot = useCallback(
    () =>
      createHardcoverProjectFile({
        state: hardcover.state,
        existingMetadata: projectMetadata
      }),
    [hardcover.state, projectMetadata]
  )

  const saveProject = useCallback(
    async (saveAs: boolean): Promise<boolean> => {
      if (!window.printerApp?.saveProject) {
        setMessage('Project saving is only available in the desktop app.')
        return false
      }
      const keyAtSave = stateKey
      const stateAtSave = structuredClone(hardcover.state)
      setIsBusy(true)
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
          setMessage('Save canceled.')
          return false
        }
        if (!result.ok || !result.filePath)
          throw new Error(result.error ?? 'Could not save this hardcover project.')
        setProjectFilePath(result.filePath)
        setProjectMetadata(project.metadata)
        setSavedStateKey(keyAtSave)
        savedProjectStateRef.current = stateAtSave
        saveJob(
          toPrinterJob(
            hardcover.state,
            project.metadata.id,
            result.filePath,
            hardcover.quote.finalPrice,
            hardcover.quote.remaining
          )
        )
        setMessage(`Saved ${project.metadata.jobName}`)
        return true
      } catch (error) {
        setMessage(getErrorMessage(error))
        return false
      } finally {
        setIsBusy(false)
      }
    },
    [
      hardcover.quote.finalPrice,
      hardcover.quote.remaining,
      createProjectSnapshot,
      hardcover.state,
      projectFilePath,
      saveJob,
      stateKey
    ]
  )

  useEffect(() => {
    onProjectSessionChange({
      isDirty,
      projectName,
      filePath: projectFilePath,
      snapshot: createProjectSnapshot(),
      preflight: {
        warningsCount: hardcoverPreflight.warnings.length,
        preflightStatus: hardcoverPreflight.status
      },
      save: () => saveProject(false)
    })
  }, [
    createProjectSnapshot,
    hardcoverPreflight.status,
    hardcoverPreflight.warnings.length,
    isDirty,
    onProjectSessionChange,
    projectFilePath,
    projectName,
    saveProject
  ])
  useEffect(() => () => onProjectSessionChange(null), [onProjectSessionChange])

  const startNew = async (): Promise<void> => {
    if (!(await onConfirmUnsavedChanges('new-project'))) return
    const freshState = createDefaultHardcoverProject()
    hardcover.setState(freshState)
    savedProjectStateRef.current = structuredClone(freshState)
    setProjectFilePath(null)
    setProjectMetadata(null)
    setSavedStateKey(getHardcoverProjectStateKey(freshState))
    setMessage('Started a new hardcover cover.')
  }

  const discardChanges = (): void => {
    const restoredState = structuredClone(savedProjectStateRef.current)
    hardcover.setState(restoredState)
    setSavedStateKey(getHardcoverProjectStateKey(restoredState))
    setMessage(projectFilePath ? 'Discarded unsaved changes.' : 'Discarded the current draft.')
    setDiscardDialogOpen(false)
  }

  const openProject = async (): Promise<void> => {
    setIsBusy(true)
    const result = await onOpenProject()
    if (!result.ok && !result.canceled) setMessage(result.error ?? 'Could not open that project.')
    setIsBusy(false)
  }

  const saveExport = async (result: {
    bytes: Uint8Array
    fileName: string
    mimeType: string
  }): Promise<void> => {
    if (!window.printerApp?.saveFile) throw new Error('Desktop file saving is unavailable.')
    const extension = result.fileName.split('.').pop() ?? 'bin'
    const saved = await window.printerApp.saveFile({
      suggestedName: result.fileName,
      bytes: result.bytes,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
    })
    if (saved.canceled) {
      setMessage('Export canceled.')
      return
    }
    if (!saved.ok) throw new Error(saved.error ?? 'Could not save the export.')
    setMessage(`Saved ${result.fileName}`)
  }

  const runExport = async (kind: 'pdf' | 'svg' | 'image'): Promise<void> => {
    setIsBusy(true)
    setMessage(`Creating ${kind.toUpperCase()} export...`)
    try {
      const exported =
        kind === 'pdf'
          ? await (await import('./lib/hardcoverExportPdf')).exportHardcoverPdf(hardcover.state)
          : kind === 'svg'
            ? exportHardcoverSvg(hardcover.state)
            : await exportHardcoverImage(hardcover.state)
      await saveExport(exported)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  const requestHardcoverAction = (run: () => void, action: 'export' | 'print' = 'export'): void => {
    setPendingExport({
      report: hardcoverPreflight,
      run,
      action
    })
  }

  const printCoverSheet = async (): Promise<void> => {
    setIsBusy(true)
    setMessage('Preparing cover sheet PDF for printing...')
    try {
      const { exportHardcoverPdf } = await import('./lib/hardcoverExportPdf')
      const exported = await exportHardcoverPdf(hardcover.state)
      const result = await printPdf({
        bytes: exported.bytes,
        suggestedName: exported.fileName,
        jobTitle: projectName,
        silent: false
      })
      setMessage(getPrintResultMessage(result, exported.fileName))

      if (result.ok) {
        const existingJob = projectMetadata?.id
          ? jobs.find((job) => job.id === projectMetadata.id)
          : undefined
        saveJob(
          createPrintedJob({
            existingJob,
            projectId: projectMetadata?.id,
            tool: 'hardcover',
            jobName: projectName,
            pdfName: result.pdfName ?? exported.fileName,
            printerName: result.printerName,
            localProjectPath: projectFilePath
          })
        )
      }
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  const setupPanelProps = {
    setup: hardcover.state.setup,
    dimensions: hardcover.dimensions,
    sourcePdf: hardcover.state.sourcePdf,
    productionPreset: hardcover.state.productionPreset,
    onChange: hardcover.updateSetup,
    onImportPdf: hardcover.importSourcePdf,
    onSelectPdfFrontPage: hardcover.selectSourcePdfFrontPage,
    onSelectPdfBackPage: hardcover.selectSourcePdfBackPage,
    onTogglePdfBackCover: hardcover.setSourcePdfBackCoverEnabled,
    onLoadPdfPagePreviews: hardcover.loadSourcePdfPagePreviews,
    onChangePdfFitMode: hardcover.updateSourcePdfFitMode,
    onSavePreset: hardcover.saveProductionPreset,
    onUpdatePreset: hardcover.updateProductionPreset,
    onResetFactoryPreset: hardcover.resetProductionPreset
  }
  const completedSteps = useMemo(() => {
    const completed = new Set<HardcoverWorkflowStep>()
    if (hardcover.state.sourcePdf) completed.add('source')
    if (hardcover.dimensions.warnings.length === 0) completed.add('measurements')
    if (
      hardcover.spineLayout.fits &&
      hardcover.state.content.spine.year.trim() &&
      hardcover.state.content.spine.shortTitle.trim() &&
      hardcover.state.content.spine.studentName.trim()
    ) {
      completed.add('spine')
    }
    if (hardcoverPreflight.canExport) completed.add('export')
    return completed
  }, [
    hardcover.dimensions.warnings.length,
    hardcover.spineLayout.fits,
    hardcover.state.content.spine.shortTitle,
    hardcover.state.content.spine.studentName,
    hardcover.state.content.spine.year,
    hardcover.state.sourcePdf,
    hardcoverPreflight.canExport
  ])

  const renderWorkflowStep = (): JSX.Element => {
    switch (activeStep) {
      case 'source':
        return <CoverSetupPanel section="source" {...setupPanelProps} />
      case 'measurements':
        return <CoverSetupPanel section="measurements" {...setupPanelProps} />
      case 'spine':
        return (
          <div className="flex flex-col gap-4">
            <SpineEditor
              value={hardcover.state.content.spine}
              layout={hardcover.spineLayout}
              automaticSpineColor={automaticSpineColor}
              onChange={hardcover.updateSpine}
              onUseFrontTitle={() =>
                hardcover.updateSpine({ shortTitle: hardcover.state.content.front.title })
              }
            />
            <section className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Spine placement</h3>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <span className="rounded-md border bg-muted/30 p-3">Top: academic year</span>
                <span className="rounded-md border bg-muted/30 p-3">Middle: mémoire title</span>
                <span className="rounded-md border bg-muted/30 p-3">Bottom: student name</span>
              </div>
            </section>
          </div>
        )
      case 'export':
        return (
          <div className="flex flex-col gap-4">
            <ExportHardcoverPanel
              settings={hardcover.state.exportSettings}
              warnings={hardcover.warnings}
              sourcePdf={hardcover.state.sourcePdf}
              isBusy={isBusy}
              onChange={hardcover.updateExportSettings}
              onPdf={() => requestHardcoverAction(() => void runExport('pdf'))}
              onPrint={() => requestHardcoverAction(() => void printCoverSheet(), 'print')}
              onSvg={() => requestHardcoverAction(() => void runExport('svg'))}
              onImage={() => requestHardcoverAction(() => void runExport('image'))}
            />
            <JobAndQuote
              state={hardcover.state}
              quote={hardcover.quote}
              onJobChange={hardcover.updateJob}
              onQuoteChange={hardcover.updateQuote}
            />
          </div>
        )
      default:
        return <CoverSetupPanel section="source" {...setupPanelProps} />
    }
  }

  return (
    <div className="workspace-shell mx-auto flex w-full max-w-[1880px] flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" className="w-fit" onClick={() => onNavigate('dashboard')}>
          <ArrowLeft />
          Back to Dashboard
        </Button>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <ProjectFileActions
            filePath={projectFilePath}
            isBusy={isBusy}
            isDirty={isDirty}
            message={message}
            onOpen={() => void openProject()}
            onSave={() => void saveProject(false)}
            onSaveAs={() => void saveProject(true)}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => void startNew()}>
              New Project
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={!isDirty || isBusy}
              onClick={() => setDiscardDialogOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              Discard Changes
            </Button>
          </div>
        </div>
      </div>

      <section className="workspace-hero min-w-0 max-w-full overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-500/10 via-card to-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-normal text-foreground sm:text-2xl">
                Hardcover Binding Cover Sheet
              </h2>
              <Badge variant="success">Production workflow</Badge>
              <Badge variant="secondary">{performanceSettings.label}</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Upload the mémoire PDF, pick the cover pages, set the physical book measurements, and
              export the same sheet shown in the preview.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-3 gap-2 text-xs text-muted-foreground sm:min-w-[360px]">
            <div className="rounded-md border bg-muted/30 p-2">
              <span className="block font-medium text-foreground">
                {hardcover.state.sourcePdf ? 'PDF ready' : 'No PDF'}
              </span>
              Source
            </div>
            <div className="rounded-md border bg-muted/30 p-2">
              <span className="block font-medium text-foreground">{hardcoverPreflight.status}</span>
              Preflight
            </div>
            <div className="rounded-md border bg-muted/30 p-2">
              <span className="block font-medium text-foreground">
                {hardcover.state.content.spine.year || 'Year'}
              </span>
              Spine top
            </div>
          </div>
        </div>
      </section>

      <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)]">
        <aside
          className="w-full min-w-0 max-w-full overflow-hidden lg:w-[340px] 2xl:w-[400px]"
          data-hardcover-settings-column
        >
          <WorkflowStepNav
            activeStep={activeStep}
            completedSteps={completedSteps}
            onStepChange={setActiveStep}
          />
          <div className="mt-4 min-w-0 max-w-full overflow-hidden">{renderWorkflowStep()}</div>
        </aside>

        <section
          aria-label="Hardcover preview"
          className="flex min-w-0 max-w-full flex-col gap-4 overflow-hidden lg:sticky lg:top-4 lg:self-start"
          data-hardcover-preview-column
        >
          <HardcoverToolbar
            viewMode={hardcover.state.viewMode}
            zoom={hardcover.state.zoom}
            showGuides={hardcover.state.showGuides}
            showSafeZones={hardcover.state.showSafeZones}
            snapToGuides={hardcover.state.snapToGuides}
            onViewModeChange={(viewMode) =>
              hardcover.setState((current) => ({ ...current, viewMode }))
            }
            onZoomChange={(zoom) => hardcover.setState((current) => ({ ...current, zoom }))}
            onFitToScreen={() => hardcover.setState((current) => ({ ...current, zoom: 1 }))}
            onToggleGuides={() =>
              hardcover.setState((current) => ({ ...current, showGuides: !current.showGuides }))
            }
            onToggleSafeZones={() =>
              hardcover.setState((current) => ({
                ...current,
                showSafeZones: !current.showSafeZones
              }))
            }
            onToggleSnap={() =>
              hardcover.setState((current) => ({ ...current, snapToGuides: !current.snapToGuides }))
            }
          />
          <CoverCanvas
            state={hardcover.state}
            onSourcePdfPositionChange={hardcover.updateSourcePdfPosition}
          />
          <PreviewSummary
            report={hardcoverPreflight}
            warnings={hardcover.warnings}
            checklist={hardcover.checklist}
            sourcePdf={hardcover.state.sourcePdf}
          />
          {performanceSettings.preset !== 'low-end' || showLowEndMockup ? (
            <Suspense
              fallback={
                <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
                  Loading customer mockup...
                </div>
              }
            >
              <LazyCoverMockupPreview
                state={hardcover.state}
                onModeChange={(mockupMode) =>
                  hardcover.setState((current) => ({ ...current, mockupMode }))
                }
              />
            </Suspense>
          ) : (
            <div className="rounded-lg border bg-card p-4">
              <p className="font-medium">Customer mockup paused in Low-end PC mode</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Load it only when a customer preview is needed.
              </p>
              <Button
                className="mt-3"
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowLowEndMockup(true)}
              >
                Load mockup
              </Button>
            </div>
          )}
        </section>
      </div>

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

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {projectFilePath
                ? 'The hardcover project will return to its last saved state.'
                : 'The current draft will return to the clean starting state.'}{' '}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={discardChanges}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function WorkflowStepNav({
  activeStep,
  completedSteps,
  onStepChange
}: {
  activeStep: HardcoverWorkflowStep
  completedSteps: ReadonlySet<HardcoverWorkflowStep>
  onStepChange: (step: HardcoverWorkflowStep) => void
}): JSX.Element {
  return (
    <nav className="min-w-0 max-w-full overflow-hidden rounded-lg border bg-card p-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-1">
        {WORKFLOW_STEPS.map((step, index) => {
          const Icon = step.icon
          const active = activeStep === step.id
          const complete = completedSteps.has(step.id)

          return (
            <button
              key={step.id}
              type="button"
              aria-current={active ? 'step' : undefined}
              className={`min-w-0 rounded-md border p-3 text-left transition ${
                active
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-transparent bg-transparent text-foreground hover:border-border hover:bg-muted/60'
              }`}
              onClick={() => onStepChange(step.id)}
            >
              <span className="flex items-start gap-3">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-md border ${
                    active ? 'border-primary/30 bg-background' : 'bg-muted/50'
                  }`}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {index + 1}. {step.label}
                    {complete && <CheckCircle2 className="size-4 text-success" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {step.description}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function PreviewSummary({
  report,
  warnings,
  checklist,
  sourcePdf
}: {
  report: PreflightReport
  warnings: string[]
  checklist: Array<{ label: string; passed: boolean }>
  sourcePdf: HardcoverProjectPayload['sourcePdf']
}): JSX.Element {
  const passedItems = checklist.filter((item) => item.passed).length
  const reportVariant =
    report.status === 'passed'
      ? 'success'
      : report.status === 'warnings'
        ? 'warning'
        : 'destructive'

  return (
    <section className="grid min-w-0 max-w-full gap-2 overflow-hidden rounded-lg border bg-card p-3 text-sm sm:grid-cols-3">
      <div className="rounded-md bg-muted/40 p-3">
        <div className="flex items-center gap-2 font-medium">
          <FileText className="size-4" />
          PDF pages
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {sourcePdf
            ? `Front ${sourcePdf.frontPageNumber}${
                sourcePdf.backCoverEnabled && sourcePdf.backPageNumber
                  ? `, back ${sourcePdf.backPageNumber}`
                  : ', back off'
              }`
            : 'Upload a source PDF'}
        </p>
      </div>
      <div className="rounded-md bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-2 font-medium">
          Preflight
          <Badge variant={reportVariant}>{report.status}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {report.issues.length === 0
            ? 'No preflight issues.'
            : `${report.issues.length} preflight issue${report.issues.length === 1 ? '' : 's'}.`}
          {warnings.length > 0
            ? ` ${warnings.length} layout notice${warnings.length === 1 ? '' : 's'}.`
            : ''}
        </p>
      </div>
      <div className="rounded-md bg-muted/40 p-3">
        <div className="flex items-center gap-2 font-medium">
          <ClipboardCheck className="size-4" />
          Checklist
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {passedItems} of {checklist.length} item(s) ready.
        </p>
      </div>
    </section>
  )
}

function JobAndQuote({
  state,
  quote,
  onJobChange,
  onQuoteChange
}: {
  state: HardcoverProjectPayload
  quote: ReturnType<typeof import('./hooks/useHardcoverProject').calculateQuote>
  onJobChange: (patch: Partial<HardcoverProjectPayload['job']>) => void
  onQuoteChange: (patch: Partial<HardcoverProjectPayload['job']['quote']>) => void
}): JSX.Element {
  return (
    <EditorSection title="Shop job + quick quote">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserRound className="size-4" />
        Local job details are saved with this project.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Customer name"
          value={state.job.customerName}
          onChange={(customerName) => onJobChange({ customerName })}
        />
        <TextField
          label="Phone"
          value={state.job.phoneNumber}
          onChange={(phoneNumber) => onJobChange({ phoneNumber })}
        />
        <TextField
          label="Job title"
          value={state.job.jobTitle}
          onChange={(jobTitle) => onJobChange({ jobTitle })}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Status
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={state.job.status}
            onChange={(event) =>
              onJobChange({
                status: event.target.value as HardcoverProjectPayload['job']['status']
              })
            }
          >
            {['draft', 'ready-to-print', 'printed', 'delivered', 'canceled'].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>
      <TextAreaField
        label="Notes"
        value={state.job.notes}
        onChange={(notes) => onJobChange({ notes })}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuoteInput
          label="Quantity"
          value={state.job.quote.quantity}
          step={1}
          onChange={(quantity) => onQuoteChange({ quantity })}
        />
        <QuoteInput
          label="Total"
          value={state.job.quote.totalPrice ?? quote.finalPrice}
          onChange={(totalPrice) => onQuoteChange({ totalPrice })}
        />
        <QuoteInput
          label="Deposit"
          value={state.job.quote.depositPaid}
          onChange={(depositPaid) => onQuoteChange({ depositPaid })}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-sm">
        <span>
          Total <b>{quote.finalPrice.toFixed(2)}</b>
        </span>
        <span>
          Deposit <b>{quote.depositPaid.toFixed(2)}</b>
        </span>
        <span>
          Remaining <b>{quote.remaining.toFixed(2)}</b>
        </span>
      </div>
    </EditorSection>
  )
}

function QuoteInput({
  label,
  value,
  step = 0.1,
  onChange
}: {
  label: string
  value: number
  step?: number
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        className="rounded-lg border bg-background px-3 py-2 text-sm"
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function toPrinterJob(
  state: HardcoverProjectPayload,
  id: string,
  filePath: string,
  finalPrice: number,
  remainingAmount: number
) {
  const now = new Date().toISOString()
  return {
    id,
    tool: 'hardcover' as const,
    customerName: state.job.customerName,
    phoneNumber: state.job.phoneNumber,
    jobTitle: state.job.jobTitle,
    createdAt: now,
    updatedAt: now,
    status: state.job.status,
    notes: state.job.notes,
    localProjectPath: filePath,
    exportPaths: [],
    quote: { ...state.job.quote, finalPrice, remainingAmount }
  }
}
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong in Hardcover Cover.'
}
