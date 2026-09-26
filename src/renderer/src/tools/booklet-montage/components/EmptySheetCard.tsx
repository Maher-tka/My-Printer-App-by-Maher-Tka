import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EmptySheetBoardItem } from '../types'
import { getReadableTextColor } from '../lib/colorUtils'
import { ColorPickerPopover } from './ColorPickerPopover'
import { SheetHoverActions } from './SheetHoverActions'

interface EmptySheetCardProps {
  item: EmptySheetBoardItem
  recentColors: string[]
  colorPickerOpen: boolean
  onInspect: () => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleColorPicker: () => void
  onCloseColorPicker: () => void
  onColorChange: (colorHex: string) => void
}

export function EmptySheetCard({
  item,
  recentColors,
  colorPickerOpen,
  onInspect,
  onDelete,
  onDuplicate,
  onToggleColorPicker,
  onCloseColorPicker,
  onColorChange
}: EmptySheetCardProps): JSX.Element {
  const textColor = getReadableTextColor(item.colorHex)

  return (
    <div className="relative h-[300px] overflow-visible rounded-md border border-dashed border-slate-400 bg-white p-3">
      <SheetHoverActions
        onInspect={onInspect}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onColor={onToggleColorPicker}
        showDelete={false}
      />
      <div className="mb-2 flex items-center justify-between gap-2 pr-28">
        <span className="truncate text-sm font-semibold">{item.label}</span>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-xs text-muted-foreground">Empty</span>
          <Button
            data-no-drag="true"
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Delete empty sheet"
            aria-label={`Delete ${item.label}`}
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div
        className="relative h-[236px] overflow-hidden rounded-sm border shadow-inner"
        style={{
          backgroundColor: item.colorHex,
          color: textColor
        }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(45deg, currentColor 12.5%, transparent 12.5%, transparent 50%, currentColor 50%, currentColor 62.5%, transparent 62.5%, transparent 100%)',
            backgroundSize: '18px 18px'
          }}
        />
        <div className="absolute inset-4 grid place-items-center rounded border border-current/20 bg-white/10 text-center">
          <div>
            <p className="text-sm font-semibold">Empty Sheet</p>
            <p className="mt-1 text-xs opacity-80">{item.colorHex}</p>
          </div>
        </div>
      </div>
      {colorPickerOpen && (
        <ColorPickerPopover
          colorHex={item.colorHex}
          recentColors={recentColors}
          onChange={onColorChange}
          onClose={onCloseColorPicker}
        />
      )}
    </div>
  )
}
