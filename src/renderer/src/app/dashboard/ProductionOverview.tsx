import { ArrowUpRight, CalendarClock, CheckCheck, Layers3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDeadlineState, statusLabel } from '@/jobs/jobWorkflow'
import type { PrinterJob, PrinterJobStatus } from '@/jobs/jobTypes'

const stages: PrinterJobStatus[] = [
  'draft',
  'waiting-customer-approval',
  'ready-to-print',
  'printing',
  'printed'
]

export function ProductionSummaries({
  jobs,
  today,
  onOpenJobs
}: {
  jobs: PrinterJob[]
  today: string
  onOpenJobs: () => void
}): JSX.Element {
  const due = jobs.filter((job) => getDeadlineState(job, today) === 'today').length
  const overdue = jobs.filter((job) => getDeadlineState(job, today) === 'overdue').length
  const ready = jobs.filter((job) => job.status === 'ready-to-print').length
  return (
    <div className="dashboard-summaries">
      <button
        type="button"
        onClick={onOpenJobs}
        className="dashboard-surface dashboard-summary"
        aria-label={`${due} jobs due today; ${overdue} overdue. Open Shop Jobs`}
      >
        <span className="dashboard-summary-label">
          Due today <CalendarClock aria-hidden="true" />
        </span>
        <span className="dashboard-summary-value">{due}</span>
        <span
          className={overdue ? 'dashboard-summary-note text-destructive' : 'dashboard-summary-note'}
        >
          {overdue
            ? `${overdue} overdue · follow up`
            : due
              ? 'Keep deliveries on track'
              : 'No deadlines today'}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenJobs}
        className="dashboard-surface dashboard-summary"
        aria-label={`${ready} jobs ready to print. Open Shop Jobs`}
      >
        <span className="dashboard-summary-label">
          Ready to print <CheckCheck aria-hidden="true" />
        </span>
        <span className="dashboard-summary-value">{ready}</span>
        <span className="dashboard-summary-note">
          {ready ? 'Review files before printing' : 'Your next run starts here'}
        </span>
      </button>
    </div>
  )
}

export function ActiveProduction({
  jobs,
  onOpenJobs,
  onOpenJob
}: {
  jobs: PrinterJob[]
  onOpenJobs: () => void
  onOpenJob: (id: string) => void
}): JSX.Element {
  const active = jobs.filter((job) => job.status !== 'delivered' && job.status !== 'canceled')
  const distribution = stages
    .map((status) => ({ status, count: active.filter((job) => job.status === status).length }))
    .filter(({ count }) => count > 0)
  const inPrint = active.find((job) => job.status === 'printing')
  return (
    <section
      aria-labelledby="active-production-title"
      className="dashboard-surface dashboard-active"
    >
      <div className="dashboard-card-heading">
        <h2 id="active-production-title">Active production</h2>
        <button
          type="button"
          onClick={onOpenJobs}
          className="dashboard-round-link"
          aria-label="Open production jobs"
        >
          <ArrowUpRight aria-hidden="true" />
        </button>
      </div>
      {active.length ? (
        <>
          <div className="dashboard-active-total">
            <span>{active.length}</span>
            <p>
              active {active.length === 1 ? 'job' : 'jobs'}
              <small>From preparation to collection</small>
            </p>
          </div>
          {distribution.length > 1 && (
            <div
              className="dashboard-stage-bar"
              role="img"
              aria-label={distribution
                .map(({ status, count }) => `${statusLabel(status)}: ${count}`)
                .join(', ')}
            >
              {distribution.map(({ status, count }, index) => (
                <span
                  key={status}
                  style={{
                    width: `${(count / active.length) * 100}%`,
                    opacity: 0.35 + index * 0.14
                  }}
                />
              ))}
            </div>
          )}
          <div className="dashboard-stage-labels">
            {distribution.map(({ status, count }) => (
              <span key={status}>
                <i aria-hidden="true" />
                {statusLabel(status)}
                <b>{count}</b>
              </span>
            ))}
          </div>
          {inPrint ? (
            <button
              type="button"
              onClick={() => onOpenJob(inPrint.id)}
              className="dashboard-running-job"
            >
              <span className="dashboard-running-dot" aria-hidden="true" />
              <span>
                <strong>{inPrint.jobTitle}</strong>
                <small>Printing · inspect the first finished sheet</small>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </button>
          ) : (
            <p className="dashboard-card-description">
              {distribution.some(({ status }) => status === 'waiting-customer-approval')
                ? 'Customer approval comes before the next print run.'
                : 'Open a job to review its artwork, deadline, and next step.'}
            </p>
          )}
        </>
      ) : (
        <div className="dashboard-active-empty">
          <span className="dashboard-empty-mark">
            <Layers3 aria-hidden="true" />
          </span>
          <h3>A clear view of your work.</h3>
          <p>Track customer orders and see their real production stage here.</p>
          <Button type="button" variant="ghost" onClick={onOpenJobs}>
            Open Shop Jobs <ArrowUpRight aria-hidden="true" />
          </Button>
        </div>
      )}
    </section>
  )
}
