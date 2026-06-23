import { FolderOpen, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProjectFileActionsProps {
  filePath: string | null
  isBusy: boolean
  isDirty: boolean
  message: string | null
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
}

export function ProjectFileActions({
  filePath,
  isBusy,
  isDirty,
  message,
  onOpen,
  onSave,
  onSaveAs
}: ProjectFileActionsProps): JSX.Element {
  return (
    <div className="flex max-w-xl flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onOpen} disabled={isBusy}>
          <FolderOpen data-icon="inline-start" />
          Open
        </Button>
        <Button type="button" onClick={onSave} disabled={isBusy}>
          <Save data-icon="inline-start" />
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onSaveAs} disabled={isBusy}>
          Save As
        </Button>
      </div>
      <div className="flex max-w-xl items-center justify-end gap-2 text-xs">
        {isDirty && (
          <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-amber-700">
            <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
            Unsaved changes
          </span>
        )}
        <p
          className="truncate text-right text-muted-foreground"
          title={filePath ?? undefined}
        >
          {isDirty
            ? filePath ?? 'Not saved yet'
            : message ?? (filePath ? filePath : 'Not saved yet')}
        </p>
      </div>
    </div>
  )
}
