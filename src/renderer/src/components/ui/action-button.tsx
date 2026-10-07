import { forwardRef, type ComponentProps } from 'react'
import {
  Copy,
  FileDown,
  FilePlus2,
  FolderOpen,
  LoaderCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  Save,
  Scan,
  Trash2,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Button, type ButtonProps } from './button'
import { useLanguage } from '@/i18n/useLanguage'

// Use action icons for commands, and file/tool icons for content identification.
const actions = {
  import: { icon: Upload, label: 'Import artwork' },
  export: { icon: FileDown, label: 'Export PDF' },
  open: { icon: FolderOpen, label: 'Open' },
  save: { icon: Save, label: 'Save' },
  saveAs: { icon: Save, label: 'Save as' },
  newProject: { icon: FilePlus2, label: 'New project' },
  reset: { icon: RotateCcw, label: 'Reset' },
  clear: { icon: Trash2, label: 'Clear' },
  undo: { icon: Undo2, label: 'Undo' },
  delete: { icon: Trash2, label: 'Delete' },
  duplicate: { icon: Copy, label: 'Duplicate' },
  fit: { icon: Scan, label: 'Fit view' },
  expand: { icon: Maximize2, label: 'Expand canvas' },
  collapse: { icon: Minimize2, label: 'Restore workspace' },
  zoomIn: { icon: ZoomIn, label: 'Zoom in' },
  zoomOut: { icon: ZoomOut, label: 'Zoom out' }
} as const

export type AppAction = keyof typeof actions

export function ActionIcon({
  action,
  ...props
}: ComponentProps<typeof Upload> & { action: AppAction }): JSX.Element {
  const Icon = actions[action].icon
  return <Icon aria-hidden="true" {...props} />
}

export const ActionButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'asChild'> & {
    action: AppAction
    isBusy?: boolean
    busyLabel?: string
    iconOnly?: boolean
  }
>(
  (
    {
      action,
      children,
      isBusy,
      busyLabel = 'Preparing…',
      iconOnly = false,
      disabled,
      variant = 'outline',
      size,
      ...props
    },
    ref
  ) => {
    const { t } = useLanguage()
    return (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={size ?? (iconOnly ? 'icon-sm' : 'default')}
        aria-label={iconOnly ? t(actions[action].label) : undefined}
        title={iconOnly ? t(actions[action].label) : undefined}
        {...props}
        disabled={disabled || isBusy}
        aria-busy={isBusy}
      >
        {isBusy ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <ActionIcon action={action} />
        )}
        {!iconOnly && (isBusy ? t(busyLabel) : (children ?? t(actions[action].label)))}
      </Button>
    )
  }
)
ActionButton.displayName = 'ActionButton'
