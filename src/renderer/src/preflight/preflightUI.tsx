import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PreflightReport } from './preflightTypes'

export function PreflightSummary({ report }: { report: PreflightReport }): JSX.Element {
  const Icon =
    report.status === 'passed'
      ? CheckCircle2
      : report.status === 'warnings'
        ? AlertTriangle
        : XCircle
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon
            className={
              report.status === 'passed'
                ? 'text-emerald-600'
                : report.status === 'warnings'
                  ? 'text-amber-600'
                  : 'text-destructive'
            }
          />
          <h3 className="font-semibold">
            {report.status === 'passed'
              ? 'Preflight Passed'
              : report.status === 'warnings'
                ? 'Preflight Warnings'
                : 'Preflight Errors'}
          </h3>
        </div>
        <Badge
          variant={
            report.status === 'passed'
              ? 'success'
              : report.status === 'warnings'
                ? 'warning'
                : 'destructive'
          }
        >
          {report.issues.length} issue(s)
        </Badge>
      </div>
      {report.issues.length > 0 && (
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {report.issues.map((issue) => (
            <article
              key={issue.id}
              className={
                issue.severity === 'error'
                  ? 'rounded-md border border-destructive/30 bg-destructive/5 p-3'
                  : 'rounded-md border border-amber-500/30 bg-amber-500/5 p-3'
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={issue.severity === 'error' ? 'destructive' : 'warning'}>
                  {issue.severity}
                </Badge>
                {issue.category ? <Badge variant="outline">{issue.category}</Badge> : null}
                <p className="text-sm font-medium text-foreground">{issue.message}</p>
              </div>
              {issue.recommendation ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  <b className="text-foreground">Recommended:</b> {issue.recommendation}
                </p>
              ) : null}
              {issue.affectedItems?.length ? (
                <p
                  className="mt-1 truncate text-xs text-muted-foreground"
                  title={issue.affectedItems.join(', ')}
                >
                  Affected: {issue.affectedItems.join(', ')}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function PreflightDialog({
  report,
  action = 'export',
  onCancel,
  onConfirm
}: {
  report: PreflightReport
  action?: 'export' | 'print'
  onCancel: () => void
  onConfirm: () => void
}): JSX.Element {
  const actionText = action === 'print' ? 'Print' : 'Export'

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/20 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${actionText} preflight`}
    >
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-auto rounded-[var(--ui-radius-xl)] border border-[var(--ui-border)] bg-popover p-5 shadow-elevated">
        <PreflightSummary report={report} />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel and Fix
          </Button>
          <Button type="button" onClick={onConfirm} disabled={!report.canExport}>
            {report.canExport
              ? report.status === 'warnings'
                ? `${actionText} Anyway`
                : `Continue ${actionText}`
              : `Cannot ${actionText}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
