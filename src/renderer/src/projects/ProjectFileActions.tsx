import { FolderOpen, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProjectFileActionsProps {
  filePath: string | null
  isBusy: boolean
  message: string | null
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
}

export function ProjectFileActions({
  filePath,
  isBusy,
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
      <p
        className="max-w-xl truncate text-right text-xs text-muted-foreground"
        title={filePath ?? undefined}
      >
        {message ?? (filePath ? filePath : 'Not saved yet')}
      </p>
    </div>
  )
}
