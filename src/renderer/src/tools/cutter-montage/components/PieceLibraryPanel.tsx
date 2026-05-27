import { Copy, Edit3, ImagePlus, Plus, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { PiecePreset } from '../types'
import { formatCm } from '../lib/units'

interface PieceLibraryPanelProps {
  pieces: PiecePreset[]
  activePieceId: string | null
  onImport: (files: File[]) => void
  onEditPiece: (pieceId: string) => void
  onDuplicatePiece: (pieceId: string) => void
  onDeletePiece: (pieceId: string) => void
  onAddToSheet: (pieceId: string) => void
  onPieceQuantityChange: (pieceId: string, quantity: number) => void
  onPieceRotationAllowedChange: (pieceId: string, rotationAllowed: boolean) => void
}

export function PieceLibraryPanel({
  pieces,
  activePieceId,
  onImport,
  onEditPiece,
  onDuplicatePiece,
  onDeletePiece,
  onAddToSheet,
  onPieceQuantityChange,
  onPieceRotationAllowedChange
}: PieceLibraryPanelProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Piece Library</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Prepared designs with their own cutlines and quantities.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
          <ImagePlus data-icon="inline-start" />
          Import
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {pieces.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            Import a design file to create the first editable piece preset.
          </div>
        ) : (
          pieces.map((piece) => (
            <article
              key={piece.id}
              className={`rounded-md border bg-muted/20 p-3 ${
                piece.id === activePieceId ? 'border-primary ring-2 ring-primary/15' : ''
              }`}
            >
              <div className="flex gap-3">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded border bg-white">
                  <img src={piece.previewUrl} alt={piece.displayName} className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{piece.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{piece.sourceFileName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatCm(piece.widthCm)} x {formatCm(piece.heightCm)}
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
                        onPieceQuantityChange(piece.id, Math.max(1, Math.round(Number(event.target.value))))
                      }
                      />
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={piece.rotationAllowed}
                      onChange={(event) =>
                        onPieceRotationAllowedChange(piece.id, event.target.checked)
                      }
                    />
                    Allow rotation
                  </label>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => onEditPiece(piece.id)}>
                  <Edit3 data-icon="inline-start" />
                  Edit
                </Button>
                <Button type="button" size="sm" onClick={() => onAddToSheet(piece.id)}>
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onDuplicatePiece(piece.id)}>
                  <Copy data-icon="inline-start" />
                  Duplicate
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onDeletePiece(piece.id)}>
                  <Trash2 data-icon="inline-start" />
                  Delete
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
        multiple
        onChange={(event) => {
          onImport(Array.from(event.target.files ?? []))
          event.currentTarget.value = ''
        }}
      />
    </section>
  )
}
