import { useLanguage } from '@/i18n/useLanguage'
import { ToolHeader } from '../shared/ToolHeader'
import { CheckCircle2, FileDown, FileText, Ruler, Settings2, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ActionButton } from '@/components/ui/action-button'
import { createPrintedJob } from '@/jobs/printHistory'
import { useJobStore } from '@/jobs/useJobStore'
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
import { useHardcoverPdfDrop } from './hooks/useHardcoverPdfDrop'
import type { HardcoverPdfCoverTarget } from './types'
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

type HardcoverWorkflowStep = 'source' | 'measurements' | 'spine' | 'export'

const WORKFLOW_STEPS: Array<{
  id: HardcoverWorkflowStep
  label: string
  icon: typeof FileText
}> = [
  {
    id: 'source',
    label: 'Source PDF',
    icon: FileText
  },
  {
    id: 'measurements',
    label: 'Book Measurements',
    icon: Ruler
  },
  {
    id: 'spine',
    label: 'Spine Text',
    icon: Settings2
  },
  {
    id: 'export',
    label: 'Export',
    icon: FileDown
  }
]

export function HardcoverCoverPage({
  onNavigate,
  openedProject,
  onOpenProject,
  onProjectSessionChange,
  onConfirmUnsavedChanges
}: HardcoverCoverPageProps): JSX.Element {
  const { t } = useLanguage()

  const hardcover = useHardcoverProject(openedProject?.project.payload)
  const { jobs, saveJob } = useJobStore()
  const [projectFilePath, setProjectFilePath] = useState(openedProject?.filePath ?? null)
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | null>(
    openedProject?.project.metadata ?? null
  )
  const [savedStateKey, setSavedStateKey] = useState(() =>
    getHardcoverProjectStateKey(hardcover.state)
  )
  const [isBusy, setIsBusy] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const settingsColumnRef = useRef<HTMLElement>(null)
  const savedProjectStateRef = useRef(structuredClone(hardcover.state))
  const [message, setMessage] = useState<string | null>(
    openedProject ? `Opened ${openedProject.project.metadata.jobName}` : null
  )
  const [activeStep, setActiveStep] = useState<HardcoverWorkflowStep>('source')
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [pendingExport, setPendingExport] = useState<{
    report: PreflightReport
    run: () => void
    action: 'export' | 'print'
  } | null>(null)
  const pdfDrop = useHardcoverPdfDrop(
    hardcover.importSourcePdf,
    isBusy || discardDialogOpen || Boolean(pendingExport)
  )
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
    hardcover.resetSpineAutoFill()
    hardcover.setState(freshState)
    savedProjectStateRef.current = structuredClone(freshState)
    setProjectFilePath(null)
    setProjectMetadata(null)
    setSavedStateKey(getHardcoverProjectStateKey(freshState))
    setMessage('Started a new hardcover cover.')
  }

  const discardChanges = (): void => {
    const restoredState = structuredClone(savedProjectStateRef.current)
    hardcover.resetSpineAutoFill()
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
    if (hardcoverPreflight.canExport) {
      run()
      return
    }
    setPendingExport({
      report: hardcoverPreflight,
      run,
      action
    })
  }

  const printCoverSheet = async (): Promise<void> => {
    setIsBusy(true)
    setIsPrinting(true)
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
      setIsPrinting(false)
    }
  }

  const setupPanelProps = {
    setup: hardcover.state.setup,
    dimensions: hardcover.dimensions,
    sourcePdf: hardcover.state.sourcePdf,
    productionPreset: hardcover.state.productionPreset,
    onChange: hardcover.updateSetup,
    onImportPdf: pdfDrop.importPdfFile,
    onDropPdfFiles: pdfDrop.dropPdfFiles,
    importingPdf: pdfDrop.importingPdf,
    onSelectPdfFrontPage: (page: number) =>
      pdfDrop.runSourceOperation(() => hardcover.selectSourcePdfFrontPage(page)),
    onSelectPdfBackPage: (page: number) =>
      pdfDrop.runSourceOperation(() => hardcover.selectSourcePdfBackPage(page)),
    onTogglePdfBackCover: (enabled: boolean) =>
      pdfDrop.runSourceOperation(() => hardcover.setSourcePdfBackCoverEnabled(enabled)),
    onLoadPdfPagePreviews: (start: number, count?: number, target?: HardcoverPdfCoverTarget) =>
      pdfDrop.runSourceOperation(() => hardcover.loadSourcePdfPagePreviews(start, count, target)),
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

  useEffect(() => {
    settingsColumnRef.current?.scrollTo({ top: 0 })
  }, [activeStep])

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
              onDetectSpine={hardcover.detectSpine}
              detectingSpine={hardcover.detectingSpine}
              detectionMessage={hardcover.spineDetectionMessage}
              onUseFrontTitle={() =>
                hardcover.updateSpine({ shortTitle: hardcover.state.content.front.title })
              }
            />
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
    <div className="workspace-shell hardcover-workspace mx-auto flex w-full max-w-[1880px] flex-col gap-4">
      <ToolHeader
        title={t('Hardcover Cover')}
        onBack={() => onNavigate('dashboard')}
        print={{
          disabled: isBusy || pdfDrop.importingPdf,
          isBusy: isPrinting,
          onPrint: () => requestHardcoverAction(() => void printCoverSheet(), 'print')
        }}
        exportPdf={{
          disabled: isBusy || pdfDrop.importingPdf,
          onExport: () => requestHardcoverAction(() => void runExport('pdf'))
        }}
        actions={
          <div className="flex flex-col items-end gap-2">
            <ProjectFileActions
              filePath={projectFilePath}
              isBusy={isBusy || pdfDrop.importingPdf}
              isDirty={isDirty}
              message={message}
              onOpen={() => void openProject()}
              onSave={() => void saveProject(false)}
              onSaveAs={() => void saveProject(true)}
              onNew={() => void startNew()}
              onClear={() => {
                hardcover.clearProject(true)
                setActiveStep('source')
                setMessage(null)
              }}
              clearDisabled={
                isPrinting ||
                hardcover.detectingSpine ||
                (!hardcover.state.sourcePdf &&
                  hardcover.state.batchStudents.length === 0 &&
                  ![
                    hardcover.state.content.front.studentName,
                    hardcover.state.content.front.title,
                    hardcover.state.content.front.degree,
                    hardcover.state.content.front.university,
                    hardcover.state.content.front.department,
                    hardcover.state.content.front.supervisor,
                    hardcover.state.content.front.academicYear,
                    hardcover.state.content.front.logoDataUrl,
                    hardcover.state.content.front.backgroundDataUrl,
                    hardcover.state.content.spine.studentName,
                    hardcover.state.content.spine.shortTitle,
                    hardcover.state.content.spine.year,
                    hardcover.state.content.spine.universityInitials,
                    hardcover.state.content.back.summary,
                    hardcover.state.content.back.contactInfo,
                    hardcover.state.content.back.qrText,
                    hardcover.state.content.back.logoDataUrl
                  ].some(Boolean))
              }
              additionalActions={
                <ActionButton
                  action="reset"
                  iconOnly
                  variant="ghost"
                  aria-label={t('Discard Changes')}
                  title={t('Discard Changes')}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={!isDirty || isBusy || pdfDrop.importingPdf}
                  onClick={() => setDiscardDialogOpen(true)}
                />
              }
            />
          </div>
        }
      />

      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-muted-foreground"
        aria-label="Cover production status"
      >
        <span>
          {t('Source:')}{' '}
          <strong className="font-medium text-foreground">
            {hardcover.state.sourcePdf ? t('PDF ready') : t('No PDF')}
          </strong>
        </span>
        <span>
          {t('Preflight:')}{' '}
          <Badge variant={hardcoverPreflight.status === 'passed' ? 'success' : 'warning'}>
            {hardcoverPreflight.status}
          </Badge>
        </span>
        <span>
          {t('Spine year:')}{' '}
          <strong className="font-medium text-foreground">
            {hardcover.state.content.spine.year || t('Not set')}
          </strong>
        </span>
        {pdfDrop.pdfDropMessage && (
          <p role="status" className="basis-full">
            {pdfDrop.pdfDropMessage}
          </p>
        )}
      </div>

      <WorkflowStepNav
        activeStep={activeStep}
        completedSteps={completedSteps}
        onStepChange={setActiveStep}
      />

      <div className="grid w-full min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <aside
          ref={settingsColumnRef}
          aria-label="Hardcover properties"
          className="min-w-0 lg:order-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto"
          data-hardcover-settings-column
        >
          <div className="min-w-0 max-w-full">{renderWorkflowStep()}</div>
        </aside>

        <section
          aria-label="Hardcover preview"
          className="flex min-w-0 max-w-full flex-col gap-4 lg:order-1"
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
            <AlertDialogTitle>{t('Discard unsaved changes?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {projectFilePath
                ? 'The hardcover project will return to its last saved state.'
                : 'The current draft will return to the clean starting state.'}{' '}
              {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Keep editing')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={discardChanges}
            >
              {t('Discard changes')}
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
  const { t } = useLanguage()
  return (
    <nav className="min-w-0 max-w-full rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {WORKFLOW_STEPS.map((step, index) => {
          const Icon = step.icon
          const active = activeStep === step.id
          const complete = completedSteps.has(step.id)

          return (
            <button
              key={step.id}
              type="button"
              aria-current={active ? 'step' : undefined}
              className={`min-w-0 rounded-[14px] border p-3 text-left transition-colors ${
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
                    {index + 1}. {t(step.label)}
                    {complete && <CheckCircle2 className="size-4 text-success" />}
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
  const { t } = useLanguage()

  return (
    <EditorSection title="Shop job + quick quote">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserRound className="size-4" />
        Local job details are saved with this project.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('Customer name')}
          value={state.job.customerName}
          onChange={(customerName) => onJobChange({ customerName })}
        />
        <TextField
          label={t('Phone')}
          value={state.job.phoneNumber}
          onChange={(phoneNumber) => onJobChange({ phoneNumber })}
        />
        <TextField
          label={t('Job title')}
          value={state.job.jobTitle}
          onChange={(jobTitle) => onJobChange({ jobTitle })}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('Status')}
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
        label={t('Notes')}
        value={state.job.notes}
        onChange={(notes) => onJobChange({ notes })}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuoteInput
          label={t('Quantity')}
          value={state.job.quote.quantity}
          step={1}
          onChange={(quantity) => onQuoteChange({ quantity })}
        />
        <QuoteInput
          label={t('Total')}
          value={state.job.quote.totalPrice ?? quote.finalPrice}
          onChange={(totalPrice) => onQuoteChange({ totalPrice })}
        />
        <QuoteInput
          label={t('Deposit')}
          value={state.job.quote.depositPaid}
          onChange={(depositPaid) => onQuoteChange({ depositPaid })}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-sm">
        <span>
          {t('Total')} <b>{quote.finalPrice.toFixed(2)}</b>
        </span>
        <span>
          {t('Deposit')} <b>{quote.depositPaid.toFixed(2)}</b>
        </span>
        <span>
          {t('Remaining')} <b>{quote.remaining.toFixed(2)}</b>
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
  const { t } = useLanguage()

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t(label)}
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
