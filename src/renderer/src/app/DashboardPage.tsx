import { useLanguage } from '@/i18n/useLanguage'
import { getLanguage, translate } from '@/i18n/language'
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CreditCard,
  FileImage,
  FilePlus2,
  FileText,
  FolderOpen,
  Hash,
  Import,
  Layers3,
  PenLine,
  RefreshCw,
  SquareStack
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ActiveProduction, ProductionSummaries } from '@/app/dashboard/ProductionOverview'
import { ProjectPreview } from '@/app/dashboard/ProjectPreview'
import { useDashboardProjects } from '@/app/dashboard/useDashboardProjects'
import { TaskFinder } from '@/assistant/ProductionTaskFinder'
import { NextActions } from '@/assistant/NextActions'
import { RecentExportsCard } from '@/app/RecentExportsCard'
import { PdfFilePickerInput } from '@/components/file-input/PdfFilePickerInput'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getToolAccessState } from '@/licensing/tool-access'
import { printerTools } from '@/lib/app-data'
import { localDateKey } from '@/jobs/jobWorkflow'
import { useJobStore } from '@/jobs/useJobStore'
import type { AppRoute } from '@/types/navigation'
import type { PrinterAppProjectResult } from '@/types/projects'
import type { LicenseSnapshot } from '../../../shared/licensing-types'
import './dashboard/dashboard.css'

interface DashboardPageProps {
  licenseState: LicenseSnapshot | null
  isLicenseLoading: boolean
  onNavigate: (route: AppRoute) => void
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
  onImportBookletPdf: (files: File[]) => void
  onOpenImageFile: () => void
  onOpenJob: (jobId: string) => void
}
type ProductionAction = 'pdf' | 'artwork' | 'booklet' | 'cutter'
const productionActions = [
  {
    id: 'pdf' as const,
    title: 'Import PDF',
    description: 'Arrange pages for booklet imposition',
    icon: FileText,
    button: 'Choose PDF file'
  },
  {
    id: 'artwork' as const,
    title: 'Import artwork',
    description: 'Prepare artwork and cutting contours',
    icon: FileImage,
    button: 'Choose artwork'
  },
  {
    id: 'booklet' as const,
    title: 'New booklet',
    description: 'Start a new booklet workspace',
    icon: BookOpen,
    button: 'Open Booklet Montage'
  },
  {
    id: 'cutter' as const,
    title: 'New cutter job',
    description: 'Start a print-and-cut sheet',
    icon: PenLine,
    button: 'Open Cutter Montage'
  }
]
const toolIcons = {
  'card-montage': CreditCard,
  'booklet-montage': BookOpen,
  'hardcover-cover': SquareStack,
  'cutter-montage': PenLine,
  'sequential-number': Hash
}

export function DashboardPage({
  licenseState,
  isLicenseLoading,
  onNavigate,
  onOpenProject,
  onImportBookletPdf,
  onOpenImageFile,
  onOpenJob
}: DashboardPageProps): JSX.Element {
  const { t, language } = useLanguage()

  const { jobs } = useJobStore()
  const { projects, loading, error: recentError, refresh } = useDashboardProjects()
  const [projectOpenError, setProjectOpenError] = useState<string | null>(null)
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] = useState<ProductionAction>('pdf')
  const [today, setToday] = useState(() => localDateKey(new Date()))
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const currentProject = projects.find((project) => project.status !== 'Missing') ?? null
  const linkedJob = currentProject
    ? jobs.find(
        (job) => job.id === currentProject.id || job.localProjectPath === currentProject.filePath
      )
    : null
  const action =
    productionActions.find((item) => item.id === selectedAction) ?? productionActions[0]
  useEffect(() => {
    const update = (): void => setToday(localDateKey(new Date()))
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [])
  const openProject = async (filePath?: string): Promise<void> => {
    if (openingPath !== null) return
    setOpeningPath(filePath ?? 'browse')
    setProjectOpenError(null)
    try {
      const result = await onOpenProject(filePath)
      if (!result.ok && !result.canceled)
        setProjectOpenError(result.error ?? 'Could not open that project.')
    } catch {
      setProjectOpenError('Could not open that project. Please try again.')
    } finally {
      setOpeningPath(null)
    }
  }
  const importPdf = (): void => {
    if (!licenseState?.canUsePaidTools) {
      onNavigate('booklet-montage')
      return
    }
    pdfInputRef.current?.click()
  }
  const startProduction = (): void => {
    if (selectedAction === 'pdf') importPdf()
    else if (selectedAction === 'artwork') onOpenImageFile()
    else onNavigate(selectedAction === 'booklet' ? 'booklet-montage' : 'cutter-montage')
  }
  const quickActions = [
    { title: 'Import PDF', icon: Import, run: importPdf },
    { title: 'Artwork', icon: FileImage, run: onOpenImageFile },
    { title: 'New booklet', icon: FilePlus2, run: () => onNavigate('booklet-montage') },
    { title: 'Open', icon: FolderOpen, run: () => void openProject() }
  ]
  return (
    <div className="production-dashboard">
      <div className="dashboard-welcome">
        <div>
          <h2>{t('Ready for your next impression?')}</h2>
          <p>{t('Your projects, production and finishing touches — in one place.')}</p>
        </div>
        <span>
          {new Intl.DateTimeFormat(language, {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          }).format(new Date())}
        </span>
      </div>
      {projectOpenError && (
        <p role="alert" className="dashboard-error">
          {projectOpenError}
        </p>
      )}
      <div className="dashboard-columns">
        <div className="dashboard-column dashboard-left">
          <section
            aria-labelledby="current-project-title"
            className="dashboard-surface dashboard-current"
          >
            <div className="dashboard-card-heading">
              <h2 id="current-project-title">{t('Continue your work')}</h2>
              <button
                type="button"
                onClick={() => void openProject(currentProject?.filePath)}
                disabled={openingPath !== null || loading}
                aria-label={currentProject ? t('Open current project') : t('Browse saved projects')}
                className="dashboard-round-link"
              >
                <ArrowUpRight aria-hidden="true" />
              </button>
            </div>
            <ProjectPreview
              thumbnail={linkedJob?.thumbnailPreview}
              title={currentProject?.jobName ?? t('New project')}
            />
            <div className="dashboard-project-copy">
              <h3>
                {loading
                  ? t('Loading your projects…')
                  : (currentProject?.jobName ?? t('Your next print starts here'))}
              </h3>
              <p>
                {currentProject?.summary ||
                  t('Open a saved project or import your first document.')}
              </p>
            </div>
            {currentProject && (
              <div className="dashboard-project-meta">
                <span>{currentProject.tool}</span>
                <button
                  type="button"
                  onClick={() => void openProject(currentProject.filePath)}
                  disabled={openingPath !== null}
                >
                  {openingPath === currentProject.filePath ? t('Opening…') : t('Open project')}
                  <ArrowUpRight aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="dashboard-quick">
              <h3>{t('Quick actions')}</h3>
              <div>
                {quickActions.map(({ title, icon: Icon, run }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={run}
                    disabled={title === 'Open' && openingPath !== null}
                    className="dashboard-quick-button"
                  >
                    <span>
                      <Icon aria-hidden="true" />
                    </span>
                    <small>{t(title)}</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section
            aria-labelledby="recent-files-title"
            className="dashboard-surface dashboard-recent"
          >
            <div className="dashboard-card-heading">
              <h2 id="recent-files-title">{t('Recent projects')}</h2>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="dashboard-quiet-link"
                aria-label={t('Refresh recent projects')}
              >
                <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              </button>
            </div>
            {recentError && (
              <p role="alert" className="dashboard-card-description">
                {recentError}
              </p>
            )}
            {loading ? (
              <p role="status" className="dashboard-card-description">
                {t('Loading recent files…')}
              </p>
            ) : projects.length ? (
              <div className="dashboard-recent-list">
                {projects.slice(0, 4).map((project) => (
                  <button
                    type="button"
                    key={project.filePath}
                    onClick={() => void openProject(project.filePath)}
                    disabled={openingPath !== null}
                    className="dashboard-recent-row"
                    title={project.filePath}
                  >
                    <span className="dashboard-file-symbol">
                      <FileText aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{project.jobName}</strong>
                      <small>
                        {project.tool} ·{' '}
                        {project.status === 'Missing'
                          ? t('File missing')
                          : formatDate(project.updatedAt)}
                      </small>
                    </span>
                    <ArrowUpRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="dashboard-list-empty">
                <FolderOpen aria-hidden="true" />
                <p>
                  {t('No saved projects yet')}
                  <small>
                    {t('Save a project from any production workspace to return to it here.')}
                  </small>
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => void openProject()}
              disabled={openingPath !== null}
              className="dashboard-text-link"
            >
              {t('Browse projects')} <ArrowRight aria-hidden="true" />
            </button>
          </section>
        </div>
        <div className="dashboard-column dashboard-center">
          <ProductionSummaries jobs={jobs} today={today} onOpenJobs={() => onNavigate('jobs')} />
          <ActiveProduction
            jobs={jobs}
            onOpenJobs={() => onNavigate('jobs')}
            onOpenJob={onOpenJob}
          />
          <Tabs defaultValue="queue" className="dashboard-activity">
            <TabsList aria-label={t('Production activity')} className="dashboard-activity-tabs">
              <TabsTrigger value="queue">{t('Production queue')}</TabsTrigger>
              <TabsTrigger value="exports">{t('Recent exports')}</TabsTrigger>
            </TabsList>
            <TabsContent value="queue" className="dashboard-queue">
              <NextActions onOpenJob={onOpenJob} onOpenJobs={() => onNavigate('jobs')} />
            </TabsContent>
            <TabsContent value="exports" className="dashboard-exports">
              <RecentExportsCard onNavigate={onNavigate} />
            </TabsContent>
          </Tabs>
        </div>
        <div className="dashboard-column dashboard-right">
          <section
            aria-labelledby="production-actions-title"
            className="dashboard-surface dashboard-start"
          >
            <div className="dashboard-card-heading">
              <h2 id="production-actions-title">{t('Start production')}</h2>
              <Layers3 aria-hidden="true" />
            </div>
            <fieldset className="dashboard-action-options">
              <legend className="sr-only">{t('Choose a production action')}</legend>
              {productionActions.map(({ id, title, icon: Icon }) => (
                <label
                  key={id}
                  className={
                    selectedAction === id
                      ? 'dashboard-action-option is-selected'
                      : 'dashboard-action-option'
                  }
                >
                  <input
                    type="radio"
                    name="production-action"
                    value={id}
                    checked={selectedAction === id}
                    onChange={() => setSelectedAction(id)}
                  />
                  <span className="dashboard-action-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="dashboard-action-copy">
                    <strong>{t(title)}</strong>
                  </span>
                  <span className="dashboard-choice-mark" aria-hidden="true" />
                </label>
              ))}
            </fieldset>
            <Button type="button" onClick={startProduction} className="dashboard-start-button">
              <span>{t(action.button)}</span>
              <ArrowRight aria-hidden="true" />
            </Button>
            <span className="dashboard-local-note">{t('Files stay on this computer.')}</span>
          </section>
          <section aria-labelledby="production-toolkit-title" className="dashboard-toolkit">
            <div className="dashboard-toolkit-heading">
              <span>{t('Made for the work you do.')}</span>
              <h2 id="production-toolkit-title">{t('Your production toolkit')}</h2>
            </div>
            <div className="dashboard-toolkit-options">
              {printerTools.map((tool) => {
                const Icon = toolIcons[tool.id as keyof typeof toolIcons] ?? Layers3
                const access = getToolAccessState(tool, licenseState, isLicenseLoading)
                const label = access.isCheckingLicense
                  ? 'Checking access'
                  : access.isLicenseLocked
                    ? 'View locked tool'
                    : 'Open workspace'
                return (
                  <button
                    key={tool.id}
                    type="button"
                    disabled={access.isCheckingLicense}
                    onClick={() => onNavigate(tool.route)}
                    aria-label={t(label) + ' — ' + t(tool.shortTitle)}
                    title={t(access.licenseReason ?? tool.description)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{t(tool.shortTitle)}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </button>
                )
              })}
            </div>
            <div className="dashboard-toolkit-pages" aria-hidden="true">
              <span>{t('Pages')}</span>
              <span>{t('Sheets')}</span>
              <span>{t('Output')}</span>
            </div>
          </section>
          <details className="dashboard-guide">
            <summary>
              {t('Find the right tool')} <ArrowUpRight aria-hidden="true" />
            </summary>
            <TaskFinder onNavigate={onNavigate} />
          </details>
        </div>
      </div>
      <PdfFilePickerInput ref={pdfInputRef} onFilesSelected={onImportBookletPdf} />
    </div>
  )
}
function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? translate('Unknown date')
    : new Intl.DateTimeFormat(getLanguage(), { month: 'short', day: 'numeric' }).format(date)
}
