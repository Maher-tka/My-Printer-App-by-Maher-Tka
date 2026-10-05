import { useLanguage } from '@/i18n/useLanguage'
import { CalendarClock, ChevronLeft, ChevronRight, FolderOpen, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BOARD_STATUSES, getDeadlineState, statusLabel } from './jobWorkflow'
import type { PrinterJob, PrinterJobStatus } from './jobTypes'

export function JobBoard({
  jobs,
  onEdit,
  onStatusChange
}: {
  jobs: PrinterJob[]
  onEdit: (job: PrinterJob) => void
  onStatusChange: (job: PrinterJob, status: PrinterJobStatus) => void
}): JSX.Element {
  const { t } = useLanguage()

  const activeJobs = jobs.filter((job) => job.status !== 'canceled')

  return (
    <div
      className="overflow-x-auto pb-2"
      role="region"
      aria-label="Production stages. Scroll horizontally to see all stages."
      tabIndex={0}
    >
      <div className="grid min-w-[1320px] grid-cols-6 gap-3">
        {BOARD_STATUSES.map((column, columnIndex) => {
          const columnJobs = activeJobs.filter((job) => job.status === column.value)
          return (
            <section key={column.value} className="rounded-xl border bg-muted/20 p-3">
              <header className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{column.label}</h3>
                <Badge variant="secondary">{columnJobs.length}</Badge>
              </header>
              <div className="flex min-h-32 flex-col gap-2">
                {columnJobs.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    {t('No jobs')}
                  </p>
                ) : null}
                {columnJobs.map((job) => (
                  <BoardCard
                    key={job.id}
                    job={job}
                    columnIndex={columnIndex}
                    onEdit={onEdit}
                    onStatusChange={onStatusChange}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function BoardCard({
  job,
  columnIndex,
  onEdit,
  onStatusChange
}: {
  job: PrinterJob
  columnIndex: number
  onEdit: (job: PrinterJob) => void
  onStatusChange: (job: PrinterJob, status: PrinterJobStatus) => void
}): JSX.Element {
  const { t } = useLanguage()

  const deadlineState = getDeadlineState(job)
  const previous = BOARD_STATUSES[columnIndex - 1]?.value
  const next = BOARD_STATUSES[columnIndex + 1]?.value

  return (
    <article
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm',
        deadlineState === 'overdue' && 'border-destructive/50 bg-destructive/5',
        deadlineState === 'today' && 'border-amber-500/50 bg-amber-500/5'
      )}
    >
      <button type="button" className="w-full text-left" onClick={() => onEdit(job)}>
        <p className="line-clamp-2 text-sm font-semibold">{job.jobTitle}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {job.customerName || 'No customer'}
        </p>
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{job.tool}</Badge>
        {deadlineState === 'overdue' ? <Badge variant="destructive">{t('Overdue')}</Badge> : null}
        {deadlineState === 'today' ? <Badge variant="warning">{t('Due today')}</Badge> : null}
      </div>
      {job.deadline ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" />
          {job.deadline}
        </p>
      ) : null}
      <p className="mt-2 text-xs font-medium">
        {t('Balance:')} {job.quote.remainingAmount.toFixed(2)}
      </p>
      <div className="mt-3 flex items-center justify-between border-t pt-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!previous}
          title={previous ? `Move to ${statusLabel(previous)}` : 'First stage'}
          aria-label={previous ? `Move ${job.jobTitle} to ${statusLabel(previous)}` : 'First stage'}
          onClick={() => previous && onStatusChange(job, previous)}
        >
          <ChevronLeft />
        </Button>
        <div className="flex gap-1">
          {job.localProjectPath ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={t('Open linked project')}
              onClick={() => void window.printerApp?.runtime.openPath(job.localProjectPath!)}
            >
              <FolderOpen />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={t('Edit job')}
            aria-label={`Edit ${job.jobTitle}`}
            onClick={() => onEdit(job)}
          >
            <Pencil />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!next}
          title={next ? `Move to ${statusLabel(next)}` : 'Final stage'}
          aria-label={next ? `Move ${job.jobTitle} to ${statusLabel(next)}` : 'Final stage'}
          onClick={() => next && onStatusChange(job, next)}
        >
          <ChevronRight />
        </Button>
      </div>
    </article>
  )
}
