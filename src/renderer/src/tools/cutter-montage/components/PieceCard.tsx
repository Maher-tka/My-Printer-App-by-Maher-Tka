import { Copy, Edit3, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PiecePreset } from '../types'
import { formatCm } from '../lib/cutterUnits'

interface PieceCardProps {
  piece: PiecePreset
  active: boolean
  onEdit: (pieceId: string) => void
  onDuplicate: (pieceId: string) => void
  onDelete: (pieceId: string) => void
  onAddToSheet: (pieceId: string) => void
  onQuantityChange: (pieceId: string, quantity: number) => void
  onRotationAllowedChange: (pieceId: string, rotationAllowed: boolean) => void
  onRename: (pieceId: string, name: string) => void
}

export function PieceCard({
  piece,
  active,
  onEdit,
  onDuplicate,
  onDelete,
  onAddToSheet,
  onQuantityChange,
  onRotationAllowedChange,
  onRename
}: PieceCardProps): JSX.Element {
  return (
    <article
      className={`rounded-md border bg-muted/20 p-3 ${
        active ? 'border-primary ring-2 ring-primary/15' : ''
      }`}
    >
      <div className="flex gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded border bg-white">
          <img
            src={piece.previewUrl}
            alt={piece.displayName}
            className="h-full w-full object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <input
            className="w-full rounded border bg-background px-2 py-1 text-sm font-semibold"
            value={piece.displayName}
            aria-label="Piece name"
            onChange={(event) => onRename(piece.id, event.target.value)}
          />
          <p className="truncate text-xs text-muted-foreground">{piece.sourceFileName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCm(piece.widthCm)} x {formatCm(piece.heightCm)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {piece.mask.enabled ? 'Mask active' : 'No mask'} · {piece.cutline.shape} cutline
          </p>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            Qty
            <input
              className="h-8 w-16 rounded border bg-background px-2 text-sm text-foreground"
              type="number"
              min={1}
              step={1}
              value={piece.quantity}
              onChange={(event) =>
                onQuantityChange(piece.id, Math.max(1, Math.round(Number(event.target.value))))
              }
            />
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={piece.rotationAllowed}
              onChange={(event) => onRotationAllowedChange(piece.id, event.target.checked)}
            />
            Allow rotation
          </label>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onEdit(piece.id)}>
          <Edit3 data-icon="inline-start" />
          Edit
        </Button>
        <Button type="button" size="sm" onClick={() => onAddToSheet(piece.id)}>
          <Plus data-icon="inline-start" />
          Add
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onDuplicate(piece.id)}>
          <Copy data-icon="inline-start" />
          Duplicate
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(piece.id)}>
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
      </div>
    </article>
  )
}
