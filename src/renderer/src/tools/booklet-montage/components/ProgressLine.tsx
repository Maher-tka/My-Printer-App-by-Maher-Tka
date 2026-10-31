import type { ExportProgress, ImportProgress } from '../types'

interface ProgressLineProps {
  progress: ImportProgress | ExportProgress
  idleMessage?: string
}

export function ProgressLine({
  progress,
  idleMessage = 'Choose PDF files or JPG/PNG images to add pages to your booklet.'
}: ProgressLineProps): JSX.Element {
  const percent =
    progress.total > 0
      ? Math.min(100, Math.max(0, Math.round((progress.current / progress.total) * 100)))
      : 0
  const isVisible = progress.phase !== 'idle'
  const isActive = !['idle', 'done', 'canceled', 'error'].includes(progress.phase)
  const warning =
    'warning' in progress
      ? progress.warning
          ?.replace(
            /Only \d+ of \d+ page thumbnails are generated during import; remaining pages render on demand\./g,
            ''
          )
          .trim()
      : undefined

  if (!isVisible) {
    return <p className="text-sm text-muted-foreground">{idleMessage}</p>
  }

  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">{progress.message}</span>
        <span className="shrink-0 font-semibold">
          {progress.phase === 'done'
            ? 'Complete'
            : isActive && progress.total > 0
              ? `${percent}%`
              : ''}
        </span>
      </div>
      {isActive && (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={progress.message}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.total > 0 ? percent : undefined}
        >
          <div
            className={`h-full w-full origin-left rounded-full bg-primary ${progress.total <= 0 ? 'motion-safe:animate-pulse' : ''}`}
            style={{ transform: `scaleX(${progress.total > 0 ? percent / 100 : 1})` }}
          />
        </div>
      )}
      {warning && (
        <p className="rounded-[var(--ui-radius-md)] border border-warning-foreground/20 bg-warning px-3 py-2 text-sm font-medium text-warning-foreground">
          {warning}
        </p>
      )}
    </div>
  )
}
