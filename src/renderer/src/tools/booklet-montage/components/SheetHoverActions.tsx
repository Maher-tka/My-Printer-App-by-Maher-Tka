import { Copy, Eye, Palette, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface SheetHoverActionsProps {
  onInspect: () => void
  onDelete: () => void
  onDuplicate?: () => void
  onColor?: () => void
}

export function SheetHoverActions({
  onInspect,
  onDelete,
  onDuplicate,
  onColor
}: SheetHoverActionsProps): JSX.Element {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 flex translate-y-1 gap-1 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
      <ActionButton title="Inspect sheet" onClick={onInspect}>
        <Eye className="h-4 w-4" />
      </ActionButton>
      {onColor && (
        <ActionButton title="Sheet color" onClick={onColor}>
          <Palette className="h-4 w-4" />
        </ActionButton>
      )}
      {onDuplicate && (
        <ActionButton title="Duplicate sheet" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
        </ActionButton>
      )}
      <ActionButton title="Delete sheet" danger onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </ActionButton>
    </div>
  )
}

function ActionButton({
  title,
  danger = false,
  onClick,
  children
}: {
  title: string
  danger?: boolean
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <Button
      data-no-drag="true"
      type="button"
      size="icon"
      variant="outline"
      title={title}
      className={`pointer-events-auto h-8 w-8 bg-white/95 shadow-sm ${
        danger ? 'text-destructive hover:text-destructive' : ''
      }`}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </Button>
  )
}
