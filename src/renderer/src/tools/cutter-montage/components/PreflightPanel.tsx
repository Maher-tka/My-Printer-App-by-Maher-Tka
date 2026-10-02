import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CutterPreflightIssue, CutterPreflightReport } from '../lib/preflight'

export function PreflightPanel({
  report,
  placedCount
}: {
  report: CutterPreflightReport
  placedCount: number
}): JSX.Element {
  const errors = report.issues.filter((issue) => issue.severity === 'error').length
  const warnings = report.issues.filter((issue) => issue.severity === 'warning').length
  const info = report.issues.filter((issue) => issue.severity === 'info').length

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Preflight Check</h3>
          <p className="text-sm text-muted-foreground">Production safety checks before export.</p>
        </div>
        <Badge variant={report.canExport ? 'success' : 'warning'}>
          {report.canExport ? 'Ready' : 'Fix issues'}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <span className="rounded bg-muted p-2">
          <b className="block text-base">{placedCount}</b>pieces
        </span>
        <span className="rounded bg-muted p-2">
          <b className="block text-base">{report.usedAreaPercent.toFixed(1)}%</b>used
        </span>
        <span className="rounded bg-muted p-2">
          <b className="block text-base">{report.wasteAreaPercent.toFixed(1)}%</b>waste
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
        <span className="rounded bg-destructive/10 p-2 text-destructive">
          <b className="block text-base">{errors}</b>errors
        </span>
        <span className="rounded bg-warning p-2 text-warning-foreground">
          <b className="block text-base">{warnings}</b>warnings
        </span>
        <span className="rounded bg-primary/5 p-2 text-primary">
          <b className="block text-base">{info}</b>notes
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {report.issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-success-foreground/15 bg-success p-2 text-sm text-success-foreground">
            <CheckCircle2 className="size-4" />
            No obvious production problems detected.
          </div>
        ) : (
          report.issues.map((issue) => (
            <div key={issue.id} className={getIssueClassName(issue)}>
              {getIssueIcon(issue)}
              {issue.message}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function getIssueClassName(issue: CutterPreflightIssue): string {
  if (issue.severity === 'error') {
    return 'flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive'
  }

  if (issue.severity === 'info') {
    return 'flex items-start gap-2 rounded-md border border-primary/15 bg-primary/5 p-2 text-xs text-primary'
  }

  return 'flex items-start gap-2 rounded-md border border-warning-foreground/15 bg-warning p-2 text-xs text-warning-foreground'
}

function getIssueIcon(issue: CutterPreflightIssue): JSX.Element {
  if (issue.severity === 'error') return <OctagonAlert className="mt-0.5 size-4 shrink-0" />
  if (issue.severity === 'info') return <Info className="mt-0.5 size-4 shrink-0" />
  return <AlertTriangle className="mt-0.5 size-4 shrink-0" />
}
