import { ArrowRight, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useJobStore } from '@/jobs/useJobStore'
import { localDateKey, statusLabel } from '@/jobs/jobWorkflow'
import { prioritizeJobs } from './jobPriorities'

export function NextActions({
  onOpenJob,
  onOpenJobs
}: {
  onOpenJob: (jobId: string) => void
  onOpenJobs: () => void
}): JSX.Element {
  const { jobs } = useJobStore()
  const [today, setToday] = useState(() => localDateKey(new Date()))
  useEffect(() => {
    const update = (): void => setToday(localDateKey(new Date()))
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [])
  const priorities = prioritizeJobs(jobs, today)
  const overdue = priorities.filter((item) => item.urgency === 'overdue').length
  return (
    <section
      aria-labelledby="next-actions-title"
      className="h-full rounded-[var(--ui-radius-xl)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Keep things moving
          </p>
          <h2 id="next-actions-title" className="text-base font-semibold">
            Your production queue
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {overdue
              ? `${overdue} overdue ${overdue === 1 ? 'job needs' : 'jobs need'} your attention.`
              : 'Your next steps, in delivery order.'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary"
          onClick={onOpenJobs}
        >
          All jobs <ArrowUpRight className="size-3.5" />
        </Button>
      </div>
      <div className="mt-5 space-y-2">
        {priorities.slice(0, 4).map(({ job, urgency, reason, nextStep }, index) => (
          <button
            key={job.id}
            type="button"
            onClick={() => onOpenJob(job.id)}
            className="group flex w-full items-center gap-3 rounded-xl border border-border/60 p-4 text-left transition hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className="hidden self-start pt-0.5 text-xs font-medium tabular-nums text-muted-foreground/60 sm:block"
              aria-hidden="true"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="break-words text-sm font-semibold">{job.jobTitle}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${urgency === 'overdue' ? 'bg-destructive/10 text-destructive' : urgency === 'today' ? 'bg-warning text-warning-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  {reason}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {job.customerName || 'No customer assigned'} · {statusLabel(job.status)}
              </p>
              <p className="mt-2 text-xs font-medium text-primary">{nextStep}</p>
            </div>
            <ArrowUpRight
              className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
              aria-hidden="true"
            />
          </button>
        ))}
        {!priorities.length && (
          <div className="flex min-h-44 flex-col items-start justify-center rounded-xl bg-accent/35 p-6">
            <span className="mb-4 grid size-10 place-items-center rounded-full border border-primary/15 bg-card text-primary">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium">
              {jobs.length ? 'A clear desk. A fresh start.' : 'Good work starts with a plan.'}
            </p>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {jobs.length
                ? 'Every tracked job is delivered or canceled. Your next order can start here.'
                : 'Track your first customer order. We’ll keep deadlines and next steps in view.'}
            </p>
            <button
              type="button"
              onClick={onOpenJobs}
              className="mt-4 flex items-center gap-2 rounded text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {jobs.length ? 'Open shop jobs' : 'Add your first job'}{' '}
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      {priorities.length > 4 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing the first 4 of {priorities.length} active jobs.
        </p>
      )}
    </section>
  )
}
