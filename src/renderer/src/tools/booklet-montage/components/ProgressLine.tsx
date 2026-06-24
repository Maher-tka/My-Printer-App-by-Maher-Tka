import type { ExportProgress, ImportProgress } from '../types'

interface ProgressLineProps {
  progress: ImportProgress | ExportProgress
}

export function ProgressLine({ progress }: ProgressLineProps): JSX.Element {
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const isVisible = progress.phase !== 'idle'

  if (!isVisible) {
    return <p className="text-sm text-muted-foreground">Ready for local PDF or image input.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">{progress.message}</span>
        <span className="font-semibold">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      {'warning' in progress && progress.warning && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {progress.warning}
        </p>
      )}
    </div>
  )
}
