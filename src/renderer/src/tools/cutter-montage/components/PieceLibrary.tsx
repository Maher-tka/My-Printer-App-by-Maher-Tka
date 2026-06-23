import { ImagePlus } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { PiecePreset } from '../types'
import { PieceCard } from './PieceCard'

interface PieceLibraryProps {
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

export function PieceLibrary({
  pieces,
  activePieceId,
  onImport,
  onEditPiece,
  onDuplicatePiece,
  onDeletePiece,
  onAddToSheet,
  onPieceQuantityChange,
  onPieceRotationAllowedChange
}: PieceLibraryProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Piece Library</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Prepared designs with their own mask, cutline, size, and quantity.
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
            <PieceCard
              key={piece.id}
              piece={piece}
              active={piece.id === activePieceId}
              onEdit={onEditPiece}
              onDuplicate={onDuplicatePiece}
              onDelete={onDeletePiece}
              onAddToSheet={onAddToSheet}
              onQuantityChange={onPieceQuantityChange}
              onRotationAllowedChange={onPieceRotationAllowedChange}
            />
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
