import { AlertTriangle, Copy, Edit3, FileText, Image, Plus, Scissors, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PiecePreset } from '../types'
import { formatCm } from '../lib/cutterUnits'
import { PRODUCTION_SHEET_LENGTH_PRESETS_CM } from '../lib/productionSheets'

interface PieceCardProps {
  piece: PiecePreset
  active: boolean
  selected: boolean
  onSelectedChange: (pieceId: string, selected: boolean) => void
  onEdit: (pieceId: string) => void
  onDuplicate: (pieceId: string) => void
  onDelete: (pieceId: string) => void
  onAddToSheet: (pieceId: string) => void
  onQuantityChange: (pieceId: string, quantity: number) => void
  onTargetLengthChange: (pieceId: string, targetLengthCm: number) => void
  onRotationAllowedChange: (pieceId: string, rotationAllowed: boolean) => void
  onRename: (pieceId: string, name: string) => void
}

export function PieceCard({
  piece,
  active,
  selected,
  onSelectedChange,
  onEdit,
  onDuplicate,
  onDelete,
  onAddToSheet,
  onQuantityChange,
  onTargetLengthChange,
  onRotationAllowedChange,
  onRename
}: PieceCardProps): JSX.Element {
  const orderMode = piece.orderMode ?? 'copies'
  const targetLengthCm = piece.targetLengthCm ?? 100
  const hasPresetTargetLength = PRODUCTION_SHEET_LENGTH_PRESETS_CM.some(
    (lengthCm) => lengthCm === targetLengthCm
  )

  return (
    <article
      className={`rounded-md border bg-muted/20 p-3 ${
        active ? 'border-primary ring-2 ring-primary/15' : ''
      }`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '190px' }}
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
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={selected}
              aria-label={`Select ${piece.displayName}`}
              onChange={(event) => onSelectedChange(piece.id, event.target.checked)}
            />
            <input
              className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm font-semibold"
              value={piece.displayName}
              aria-label="Piece name"
              onChange={(event) => onRename(piece.id, event.target.value)}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              title={`Delete ${piece.displayName}`}
              aria-label={`Delete imported artwork ${piece.displayName}`}
              onClick={() => onDelete(piece.id)}
            >
              <Trash2 />
            </Button>
          </div>
          <p className="truncate text-xs text-muted-foreground">{piece.sourceFileName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCm(piece.widthCm)} x {formatCm(piece.heightCm)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-muted-foreground">
              {getSourceIcon(piece)}
              {getSourceLabel(piece)}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-muted-foreground">
              <Scissors className="size-3" />
              {piece.cutline.shape}
            </span>
            {!piece.cutlineObjectId && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-950">
                <AlertTriangle className="size-3" />
                No cutline
              </span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <label className="grid gap-1">
              Order by
              <select
                className="h-8 min-w-0 rounded border bg-background px-2 text-sm text-foreground"
                aria-label="Order by"
                value={orderMode}
                onChange={(event) => {
                  if (event.target.value === 'target-length') {
                    onTargetLengthChange(piece.id, piece.targetLengthCm ?? 100)
                  } else {
                    onQuantityChange(piece.id, piece.quantity)
                  }
                }}
              >
                <option value="copies">Copies</option>
                <option value="target-length">Material length</option>
              </select>
            </label>
            {orderMode === 'target-length' ? (
              <label className="grid gap-1">
                Target sheet
                <select
                  className="h-8 min-w-0 rounded border bg-background px-2 text-sm text-foreground"
                  aria-label="Target sheet length"
                  value={targetLengthCm}
                  onChange={(event) => onTargetLengthChange(piece.id, Number(event.target.value))}
                >
                  {!hasPresetTargetLength && (
                    <option value={targetLengthCm}>
                      {formatLengthMeters(targetLengthCm)} custom
                    </option>
                  )}
                  {PRODUCTION_SHEET_LENGTH_PRESETS_CM.map((lengthCm) => (
                    <option key={lengthCm} value={lengthCm}>
                      {formatLengthMeters(lengthCm)}
                      {lengthCm === 100 ? ' preferred' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="grid gap-1">
                Quantity
                <input
                  className="h-8 min-w-0 rounded border bg-background px-2 text-sm text-foreground"
                  aria-label="Quantity"
                  type="number"
                  min={1}
                  step={1}
                  value={piece.quantity}
                  onChange={(event) =>
                    onQuantityChange(piece.id, Math.max(1, Math.round(Number(event.target.value))))
                  }
                />
              </label>
            )}
          </div>
          {orderMode === 'target-length' && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {piece.quantity} copies fill this target sheet.
            </p>
          )}
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

function formatLengthMeters(lengthCm: number): string {
  return `${Number((lengthCm / 100).toFixed(1))} m`
}

function getSourceLabel(piece: PiecePreset): string {
  const kind = piece.sourceKind ?? inferSourceKind(piece)

  if (kind === 'pdf-page') return `PDF p.${piece.pdfPageNumber ?? 1}`
  if (kind === 'svg') return 'SVG'
  return 'Image'
}

function getSourceIcon(piece: PiecePreset): JSX.Element {
  const kind = piece.sourceKind ?? inferSourceKind(piece)

  if (kind === 'pdf-page') return <FileText className="size-3" />
  return <Image className="size-3" />
}

function inferSourceKind(piece: PiecePreset): NonNullable<PiecePreset['sourceKind']> {
  if (/\.pdf$/i.test(piece.sourceFileName)) return 'pdf-page'
  if (/\.svg$/i.test(piece.sourceFileName)) return 'svg'
  return 'image'
}
