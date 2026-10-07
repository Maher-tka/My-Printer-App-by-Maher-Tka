import { useLanguage } from '@/i18n/useLanguage'
import { ActionButton } from '@/components/ui/action-button'
import { ClearButton } from '@/components/ui/clear-button'
import type { ReactNode } from 'react'

interface ProjectFileActionsProps {
  filePath: string | null
  isBusy: boolean
  isDirty: boolean
  message: string | null
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onNew?: () => void
  onClear?: () => void
  clearDisabled?: boolean
  additionalActions?: ReactNode
}

export function ProjectFileActions({
  filePath,
  isBusy,
  isDirty,
  message,
  onOpen,
  onSave,
  onSaveAs,
  onNew,
  onClear,
  clearDisabled,
  additionalActions
}: ProjectFileActionsProps): JSX.Element {
  const { t } = useLanguage()

  return (
    <div className="flex max-w-2xl flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {onNew && (
          <ActionButton
            action="newProject"
            size="sm"
            variant="ghost"
            onClick={onNew}
            disabled={isBusy}
          />
        )}
        <ActionButton action="open" size="sm" onClick={onOpen} disabled={isBusy} />
        <ActionButton action="save" size="sm" onClick={onSave} disabled={isBusy} />
        <ActionButton action="saveAs" size="sm" onClick={onSaveAs} disabled={isBusy} />
        {onClear && <ClearButton onClear={onClear} disabled={isBusy || clearDisabled} />}
        {additionalActions}
      </div>
      <div className="flex max-w-2xl items-center justify-end gap-2 text-xs">
        {isDirty && (
          <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-warning-foreground">
            <span className="size-2 rounded-full bg-warning-foreground" aria-hidden="true" />
            {t('Unsaved changes')}
          </span>
        )}
        <p className="truncate text-right text-muted-foreground" title={filePath ?? undefined}>
          {filePath ?? t('Not saved yet')}
        </p>
      </div>
      {message && (
        <p
          className="max-w-2xl text-right text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </div>
  )
}
