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
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {report.issues.map((issue) => (
            <li key={issue.id}>
              <b className="text-foreground">{issue.severity}:</b> {issue.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function PreflightDialog({
  report,
  onCancel,
  onConfirm
}: {
  report: PreflightReport
  onCancel: () => void
  onConfirm: () => void
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Export preflight"
    >
      <div className="w-full max-w-xl rounded-xl border bg-background p-5 shadow-2xl">
        <PreflightSummary report={report} />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel and Fix
          </Button>
          <Button type="button" onClick={onConfirm} disabled={!report.canExport}>
            {report.canExport
              ? report.status === 'warnings'
                ? 'Export Anyway'
                : 'Continue Export'
              : 'Cannot Export'}
          </Button>
        </div>
      </div>
    </div>
  )
}
