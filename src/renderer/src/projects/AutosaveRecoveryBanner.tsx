import { FolderOpen, History, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AutosaveEntry } from '../../../shared/release-types'

export function AutosaveRecoveryBanner({
  entry,
  isBusy,
  error,
  onRestore,
  onDiscard,
  onOpenFolder
}: {
  entry: AutosaveEntry
  isBusy: boolean
  error?: string | null
  onRestore: () => void
  onDiscard: () => void
  onOpenFolder: () => void
}): JSX.Element {
  return (
    <section className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <History className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-semibold">Recovered unsaved project found</h2>
            <p className="mt-1 truncate text-sm">
              {entry.projectName} · {new Date(entry.createdAt).toLocaleString()}
            </p>
            {error && <p className="mt-1 text-sm font-medium text-destructive">{error}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onRestore} disabled={isBusy}>
            <RotateCcw data-icon="inline-start" />
            Restore
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDiscard} disabled={isBusy}>
            <Trash2 data-icon="inline-start" />
            Discard
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onOpenFolder}>
            <FolderOpen data-icon="inline-start" />
            Open Autosave Folder
          </Button>
        </div>
      </div>
    </section>
  )
}
