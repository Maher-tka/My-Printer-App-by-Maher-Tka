import { useRef } from 'react'
import { Plus, Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PiecePreset } from '../types'
import { PieceOrderControls } from './PieceOrderControls'
export function StickerLibraryRail({
  pieces,
  activeId,
  onSelect,
  onImport,
  onDuplicate,
  onDelete,
  onManage,
  onQuantity,
  onTargetLength,
  onFinishedWidthChange,
  showProductionControls = false
}: {
  pieces: PiecePreset[]
  activeId: string | null
  onSelect: (id: string) => void
  onImport: (files: File[]) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onManage: () => void
  onQuantity: (id: string, quantity: number) => void
  onTargetLength: (id: string, lengthCm: number) => boolean
  onFinishedWidthChange: (id: string, widthMm: number) => void
  showProductionControls?: boolean
}): JSX.Element {
  const input = useRef<HTMLInputElement>(null)
  return (
    <aside
      aria-label="Sticker artwork library"
      className="flex min-h-0 flex-col overflow-hidden rounded-[var(--ui-radius-lg)] border bg-card/80"
    >
      <div className="flex items-center justify-between border-b px-3 py-3">
        <strong className="text-sm font-semibold">Artwork / stickers</strong>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
          {pieces.length}
        </span>
      </div>
      <Button size="sm" className="m-2 shrink-0" onClick={() => input.current?.click()}>
        <Plus className="size-4" />
        Import artwork
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,.ai"
        className="hidden"
        aria-label="Import sticker files"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length) onImport(files)
          event.target.value = ''
        }}
      />
      <div className="min-h-0 flex-1 overflow-y-auto" role="list" aria-label="Sticker designs">
        {pieces.map((piece, index) => (
          <div
            key={piece.id}
            role="listitem"
            className={`border-b ${activeId === piece.id ? 'bg-primary/10' : ''}`}
          >
            <button
              className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/40"
              aria-pressed={activeId === piece.id}
              onClick={() => onSelect(piece.id)}
            >
              <img
                src={piece.artwork.previewUrl || piece.previewUrl}
                alt=""
                className="size-10 shrink-0 rounded border bg-white object-contain"
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">
                  {index + 1}. {piece.displayName}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {piece.cutlineObjectId ? 'Cut ready' : 'No cut line'} /{' '}
                  {piece.orderMode === 'target-length'
                    ? `${(piece.targetLengthCm ?? 100) / 100} m · ${piece.quantity} copies`
                    : `${piece.quantity} copies`}
                </span>
              </span>
            </button>
            {activeId === piece.id && showProductionControls && (
              <div className="space-y-2 border-t px-2 py-2 text-xs">
                <PieceOrderControls
                  piece={piece}
                  onQuantity={onQuantity}
                  onTargetLength={onTargetLength}
                />
                <label className="block font-medium">
                  Finished width (mm)
                  <input
                    aria-label={`Finished width of ${piece.displayName} in mm`}
                    key={`${piece.id}-width-${piece.widthCm}`}
                    type="number"
                    min={5}
                    max={960}
                    step={0.5}
                    defaultValue={Number((piece.widthCm * 10).toFixed(2))}
                    className="mt-1 h-8 w-full rounded border bg-background px-2"
                    onBlur={(event) => {
                      const value = Number(event.currentTarget.value)
                      if (Number.isFinite(value) && value >= 5 && value <= 960) {
                        if (Math.abs(value - piece.widthCm * 10) > 0.01)
                          onFinishedWidthChange(piece.id, value)
                      } else {
                        event.currentTarget.value = String(Number((piece.widthCm * 10).toFixed(2)))
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                  />
                </label>
                <p className="text-muted-foreground">
                  Artwork {Number((piece.artwork.transform.widthCm * 10).toFixed(1))} ×{' '}
                  {Number((piece.artwork.transform.heightCm * 10).toFixed(1))} mm. Finished size
                  includes the cut margin.
                </p>
              </div>
            )}
            {activeId === piece.id && (
              <div className="flex justify-end gap-1 px-2 pb-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Duplicate ${piece.displayName}`}
                  onClick={() => onDuplicate(piece.id)}
                >
                  <Copy className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Delete ${piece.displayName}`}
                  onClick={() => onDelete(piece.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
        {!pieces.length && (
          <div className="space-y-3 px-3 py-4 text-xs leading-relaxed text-muted-foreground">
            <p>Import your first design. Each sticker has its own mask, cut lines and quantity.</p>
            <p>PNG, JPG, WebP, SVG, PDF or PDF-compatible Illustrator files.</p>
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" className="m-1 shrink-0 text-xs" onClick={onManage}>
        More import options
      </Button>
    </aside>
  )
}
