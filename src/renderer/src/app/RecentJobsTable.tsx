import { useLanguage } from '@/i18n/useLanguage'
import { FileText, FolderOpen, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PrinterAppProjectResult, RecentJob } from '@/types/projects'

interface RecentJobsTableProps {
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
}

export function RecentJobsTable({ onOpenProject }: RecentJobsTableProps): JSX.Element {
  const { t } = useLanguage()

  const [jobs, setJobs] = useState<RecentJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadRecentJobs = useCallback(async (): Promise<void> => {
    if (!window.printerApp?.listRecentProjects) {
      setJobs([])
      setError('Recent projects are only available in the desktop app.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const result = await window.printerApp.listRecentProjects()
      if (result.ok) setJobs(result.jobs ?? [])
      else setError(result.error ?? 'Could not load recent projects.')
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not load recent projects. Try refreshing.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRecentJobs()
  }, [loadRecentJobs])

  const openRecentJob = async (job: RecentJob): Promise<void> => {
    setOpeningPath(job.filePath)
    setError(null)
    try {
      const result = await onOpenProject(job.filePath)
      if (!result.ok && !result.canceled) {
        await loadRecentJobs()
        setError(result.error ?? 'Could not open that project.')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not open that project.')
    } finally {
      setOpeningPath(null)
    }
  }

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-[var(--ui-divider)]">
        <CardTitle>{t('Recent projects')}</CardTitle>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Refresh recent projects')}
          title={t('Refresh recent projects')}
          onClick={() => void loadRecentJobs()}
          disabled={isLoading}
        >
          <RefreshCw className={isLoading ? 'animate-spin' : undefined} aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="p-4">
        {error && (
          <p
            role={window.printerApp ? 'alert' : 'status'}
            className="mb-3 rounded-[var(--ui-radius-md)] bg-secondary/80 p-3 text-xs leading-5 text-muted-foreground"
          >
            {error}
          </p>
        )}
        {isLoading ? (
          <p role="status" className="py-8 text-center text-xs text-muted-foreground">
            {t('Loading recent projects…')}
          </p>
        ) : jobs.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 p-5 text-center">
            <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{t('No saved projects yet')}</p>
            <p className="max-w-64 text-xs leading-5 text-muted-foreground">
              Save a project from any production tool. Its file and settings will be available here.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const result = await onOpenProject()
                  if (!result.ok && !result.canceled)
                    setError(result.error ?? 'Could not open that project.')
                } catch {
                  setError('Could not open that project.')
                }
              }}
            >
              <FolderOpen aria-hidden="true" />
              {t('Browse projects')}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--ui-divider)]">
            {jobs.slice(0, 6).map((job) => (
              <div
                key={job.filePath}
                className="flex items-start gap-3 py-3 first:pt-1"
                title={job.summary}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium" title={job.jobName}>
                    {job.jobName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{job.tool}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatProjectDate(job.updatedAt)}
                  </p>
                  {job.status === 'Missing' && (
                    <p className="mt-1 text-xs text-warning-foreground">
                      File missing · choose its new location
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={'Open ' + job.jobName}
                  title={'Open ' + job.jobName}
                  onClick={() => void openRecentJob(job)}
                  disabled={openingPath !== null}
                >
                  <FolderOpen className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatProjectDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date
  )
}
