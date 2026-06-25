import { ArrowLeft, CheckCircle2, CircleDollarSign, ClipboardCheck, UserRound } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useJobStore } from '@/jobs/useJobStore'
import { batchCoverFileName, safeFileName } from '@/lib/fileNaming'
import { createProjectFolderPlan } from '@/lib/projectFolders'
import { usePerformanceSettings } from '@/performance/usePerformanceSettings'
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
import { BackCoverEditor } from './components/BackCoverEditor'
import { BatchStudentsPanel } from './components/BatchStudentsPanel'
import { CoverCanvas } from './components/CoverCanvas'
import { CoverSetupPanel } from './components/CoverSetupPanel'
import { CoverTemplatePanel } from './components/CoverTemplatePanel'
import { ExportHardcoverPanel } from './components/ExportHardcoverPanel'
import {
  FrontCoverEditor,
  EditorSection,
  TextAreaField,
  TextField
} from './components/FrontCoverEditor'
import { HardcoverToolbar } from './components/HardcoverToolbar'
import { SpineEditor } from './components/SpineEditor'
import { createDefaultHardcoverProject, useHardcoverProject } from './hooks/useHardcoverProject'
import { applyStudent, exportHardcoverBatchPdf, exportHardcoverPdf } from './lib/hardcoverExportPdf'
import { exportHardcoverImage } from './lib/hardcoverExportImages'
import { exportHardcoverSvg } from './lib/hardcoverExportSvg'

interface HardcoverCoverPageProps {
  onNavigate: (route: AppRoute) => void
  openedProject?: OpenedPrinterProject<HardcoverProjectPayload> | null
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
  onProjectSessionChange: (session: ActiveProjectSession | null) => void
  onConfirmUnsavedChanges: (action: UnsavedChangesAction) => Promise<boolean>
}

const LazyCoverMockupPreview = lazy(() => import('./components/CoverMockupPreview'))

export function HardcoverCoverPage({
  onNavigate,
  openedProject,
  onOpenProject,
  onProjectSessionChange,
  onConfirmUnsavedChanges
}: HardcoverCoverPageProps): JSX.Element {
  const hardcover = useHardcoverProject(openedProject?.project.payload)
  const { settings: performanceSettings } = usePerformanceSettings()
  const { saveJob } = useJobStore()
  const [projectFilePath, setProjectFilePath] = useState(openedProject?.filePath ?? null)
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | null>(
    openedProject?.project.metadata ?? null
  )
  const [savedStateKey, setSavedStateKey] = useState(() =>
    getHardcoverProjectStateKey(hardcover.state)
  )
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(
    openedProject ? `Opened ${openedProject.project.metadata.jobName}` : null
  )
  const [batchProgress, setBatchProgress] = useState<string | null>(null)
  const [showLowEndMockup, setShowLowEndMockup] = useState(false)
  const [pendingExport, setPendingExport] = useState<{
    report: PreflightReport
    run: () => void
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
      bookWidthMm: hardcover.state.setup.bookWidthMm,
      bookHeightMm: hardcover.state.setup.bookHeightMm,
      spineWidthMm: hardcover.state.setup.spineWidthMm,
      wrapMarginsMm: [wrap.topMm, wrap.rightMm, wrap.bottomMm, wrap.leftMm],
      fullWidthMm: hardcover.dimensions.fullWidthMm,
      fullHeightMm: hardcover.dimensions.fullHeightMm,
      title: hardcover.state.content.front.title,
      studentName: hardcover.state.content.front.studentName,
      studentNameRequired: true,
      spineTextFits: hardcover.spineLayout.fits,
      textInsideSafeZones: !hardcover.warnings.some((warning) => /safe/i.test(warning)),
      exportMode: hardcover.state.exportSettings.mode
    })
  }, [hardcover.dimensions, hardcover.spineLayout.fits, hardcover.state, hardcover.warnings])

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
    setProjectFilePath(null)
    setProjectMetadata(null)
    setSavedStateKey(getHardcoverProjectStateKey(freshState))
    setMessage('Started a new hardcover cover.')
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
      await saveExport(
        kind === 'pdf'
          ? await exportHardcoverPdf(hardcover.state)
          : kind === 'svg'
            ? exportHardcoverSvg(hardcover.state)
            : await exportHardcoverImage(hardcover.state)
      )
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  const requestHardcoverExport = (run: () => void): void => {
    setPendingExport({
      report: hardcoverPreflight,
      run
    })
  }

  const saveTemplateFile = async (): Promise<void> => {
    const bytes = new TextEncoder().encode(`${JSON.stringify(hardcover.state.template, null, 2)}\n`)
    await saveExport({
      bytes,
      fileName: `${safeFileName(hardcover.state.template.name)}.myprinter-cover-template.json`,
      mimeType: 'application/json'
    })
  }

  const exportBatchSeparate = async (): Promise<void> => {
    if (!window.printerApp?.selectOutputFolder || !window.printerApp.writeFilesToFolder) return
    const validStudents = hardcover.state.batchStudents.filter(
      (student) => student.studentName.trim() && student.title.trim()
    )
    if (validStudents.length === 0) {
      setMessage('Add at least one batch student with a name and title.')
      return
    }
    const folder = await window.printerApp.selectOutputFolder()
    if (!folder.ok || !folder.folderPath) return
    setIsBusy(true)
    const plan = createProjectFolderPlan(
      new Date(),
      hardcover.state.job.customerName || validStudents[0].studentName,
      hardcover.state.job.jobTitle
    )
    try {
      for (let index = 0; index < validStudents.length; index += 1) {
        setBatchProgress(`Generating cover ${index + 1} of ${validStudents.length}`)
        const exported = await exportHardcoverPdf(
          applyStudent(hardcover.state, validStudents[index])
        )
        const result = await window.printerApp.writeFilesToFolder(folder.folderPath, [
          {
            fileName: `${plan.export}/${batchCoverFileName(index, validStudents[index].studentName)}`,
            bytes: exported.bytes
          }
        ])
        if (!result.ok) throw new Error(result.error ?? 'Batch file write failed.')
      }
      setBatchProgress('Done')
      setMessage(`Exported ${validStudents.length} covers to ${plan.root}.`)
    } catch (error) {
      setMessage(getErrorMessage(error))
      setBatchProgress(null)
    } finally {
      setIsBusy(false)
    }
  }

  const exportBatchCombined = async (): Promise<void> => {
    const validStudents = hardcover.state.batchStudents.filter(
      (student) => student.studentName.trim() && student.title.trim()
    )
    if (validStudents.length === 0) return
    setIsBusy(true)
    setBatchProgress(`Generating combined PDF for ${validStudents.length} students`)
    try {
      await saveExport({
        bytes: await exportHardcoverBatchPdf(hardcover.state, validStudents),
        fileName: 'hardcover_batch_combined.pdf',
        mimeType: 'application/pdf'
      })
      setBatchProgress('Done')
    } catch (error) {
      setMessage(getErrorMessage(error))
      setBatchProgress(null)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-[1780px] flex-col gap-5">
      <Button variant="ghost" className="w-fit" onClick={() => onNavigate('dashboard')}>
        <ArrowLeft />
        Back to Dashboard
      </Button>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Hardcover Binding Cover Sheet</CardTitle>
              <Badge variant="success">Production workflow</Badge>
              <Badge variant="secondary">{performanceSettings.label}</Badge>
            </div>
            <CardDescription>
              Measure the book block, design front/spine/back, then export an exact-size production
              sheet.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ProjectFileActions
              filePath={projectFilePath}
              isBusy={isBusy}
              isDirty={isDirty}
              message={message}
              onOpen={() => void openProject()}
              onSave={() => void saveProject(false)}
              onSaveAs={() => void saveProject(true)}
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => void startNew()}>
              New Project
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[380px_minmax(0,1fr)]">
            <aside className="flex flex-col gap-4">
              <CoverSetupPanel
                setup={hardcover.state.setup}
                dimensions={hardcover.dimensions}
                onChange={hardcover.updateSetup}
              />
              <CoverTemplatePanel
                template={hardcover.state.template}
                customTemplates={hardcover.state.customTemplates}
                onChoose={hardcover.chooseTemplate}
                onDuplicate={hardcover.duplicateTemplate}
                onReset={hardcover.resetTemplate}
                onChange={hardcover.updateTemplate}
                onSave={() => void saveTemplateFile()}
              />
              <FrontCoverEditor
                value={hardcover.state.content.front}
                onChange={hardcover.updateFront}
              />
              <SpineEditor
                value={hardcover.state.content.spine}
                layout={hardcover.spineLayout}
                onChange={hardcover.updateSpine}
                onUseFrontTitle={() =>
                  hardcover.updateSpine({ shortTitle: hardcover.state.content.front.title })
                }
              />
              <BackCoverEditor
                value={hardcover.state.content.back}
                onChange={hardcover.updateBack}
              />
            </aside>
            <main className="flex min-w-0 flex-col gap-4">
              <CoverCanvas state={hardcover.state} />
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
                <div className="rounded-lg border bg-card p-5">
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
            </main>
          </div>
          <BatchStudentsPanel
            students={hardcover.state.batchStudents}
            progress={batchProgress}
            onAdd={hardcover.addBatchStudent}
            onChange={hardcover.updateBatchStudent}
            onRemove={hardcover.removeBatchStudent}
            onImportCsv={(csv) =>
              setMessage(`Imported ${hardcover.importBatchCsv(csv)} batch student(s).`)
            }
            onPreview={(student) => hardcover.setState((current) => applyStudent(current, student))}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <JobAndQuote
              state={hardcover.state}
              quote={hardcover.quote}
              onJobChange={hardcover.updateJob}
              onQuoteChange={hardcover.updateQuote}
            />
            <Checklist items={hardcover.checklist} />
          </div>
          <ExportHardcoverPanel
            settings={hardcover.state.exportSettings}
            warnings={hardcover.warnings}
            batchCount={hardcover.state.batchStudents.length}
            isBusy={isBusy}
            onChange={hardcover.updateExportSettings}
            onPdf={() => requestHardcoverExport(() => void runExport('pdf'))}
            onSvg={() => requestHardcoverExport(() => void runExport('svg'))}
            onImage={() => requestHardcoverExport(() => void runExport('image'))}
            onBatchSeparate={() => requestHardcoverExport(() => void exportBatchSeparate())}
            onBatchCombined={() => requestHardcoverExport(() => void exportBatchCombined())}
          />
        </CardContent>
      </Card>
      {pendingExport && (
        <PreflightDialog
          report={pendingExport.report}
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            'materialCost',
            'printCost',
            'finishingCost',
            'designCost',
            'quantity',
            'discount',
            'depositPaid'
          ] as const
        ).map((key) => (
          <label
            key={key}
            className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"
          >
            {quoteLabel(key)}
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              type="number"
              min={0}
              step={key === 'quantity' ? 1 : 0.1}
              value={state.job.quote[key]}
              onChange={(event) => onQuoteChange({ [key]: Number(event.target.value) })}
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-md bg-muted p-3 text-sm">
        <span>
          Subtotal <b>{quote.subtotal.toFixed(2)}</b>
        </span>
        <span>
          Final <b>{quote.finalPrice.toFixed(2)}</b>
        </span>
        <span>
          Remaining <b>{quote.remaining.toFixed(2)}</b>
        </span>
      </div>
    </EditorSection>
  )
}

function Checklist({ items }: { items: Array<{ label: string; passed: boolean }> }): JSX.Element {
  return (
    <EditorSection title="Print checklist">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ClipboardCheck className="size-4" />
        Confirm these before sending the final cover to print.
      </div>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <span>{item.label}</span>
          {item.passed ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : (
            <CircleDollarSign className="size-4 text-amber-600" />
          )}
        </div>
      ))}
    </EditorSection>
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
function quoteLabel(key: string): string {
  return (
    (
      {
        materialCost: 'Cover material',
        printCost: 'Cover print',
        finishingCost: 'Binding',
        designCost: 'Design',
        quantity: 'Quantity',
        discount: 'Discount',
        depositPaid: 'Deposit'
      } as Record<string, string>
    )[key] ?? key
  )
}
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong in Hardcover Cover.'
}
