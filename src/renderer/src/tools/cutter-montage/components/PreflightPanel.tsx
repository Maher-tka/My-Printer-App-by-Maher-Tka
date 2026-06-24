import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CutterPreflightReport } from '../lib/preflight'

export function PreflightPanel({
  report,
  placedCount
}: {
  report: CutterPreflightReport
  placedCount: number
}): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-4">
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
      <div className="mt-3 flex flex-col gap-2">
        {report.issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-900">
            <CheckCircle2 className="size-4" />
            No obvious production problems detected.
          </div>
        ) : (
          report.issues.map((issue) => (
            <div
              key={issue.id}
              className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {issue.message}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
