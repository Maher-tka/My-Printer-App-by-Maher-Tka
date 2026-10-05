import { useLanguage } from '@/i18n/useLanguage'
import { FileText, FolderOpen, ArrowUpRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { PrinterAppProjectResult, RecentJob } from '@/types/projects'

export function RecentProjectSpotlight({
  onOpenProject
}: {
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
}): JSX.Element {
  const { t } = useLanguage()

  const [project, setProject] = useState<RecentJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const result = await window.printerApp?.listRecentProjects()
        if (active && result?.ok)
          setProject(result.jobs?.find((job) => job.status !== 'Missing') ?? null)
      } catch {
        if (active) setError('Recent project details could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])
  const open = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await onOpenProject(project?.filePath)
      if (!result.ok && !result.canceled) setError(result.error ?? 'Could not open this project.')
    } catch {
      setError('Could not open this project. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-labelledby="recent-project-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 id="recent-project-heading" className="text-base font-semibold">
          {t('Continue a project')}
        </h3>
        <FolderOpen className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-[var(--ui-radius-lg)] bg-secondary/70 p-5 text-center">
        <FileText className="size-8 text-primary/65" aria-hidden="true" />
        <p className="text-sm font-medium">
          {loading
            ? 'Loading recent project…'
            : project
              ? project.jobName
              : 'Your next project starts here'}
        </p>
        <p className="max-w-full break-words text-xs leading-5 text-muted-foreground">
          {project?.summary ||
            (project ? project.tool : t('Open a saved project or import your first document.'))}
        </p>
      </div>
      {project && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{project.tool}</span>
          <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant={project ? 'default' : 'outline'}
        className="w-full justify-between"
        disabled={busy || loading}
        onClick={() => void open()}
      >
        <span>{busy ? t('Opening…') : project ? 'Open recent project' : 'Open saved project'}</span>
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Button>
    </section>
  )
}
