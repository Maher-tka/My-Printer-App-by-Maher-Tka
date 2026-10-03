import { Button } from '@/components/ui/button'
import {
  MAX_PRODUCTION_SHEET_HEIGHT_CM,
  MIN_PRODUCTION_SHEET_HEIGHT_CM
} from '../lib/productionSheets'
import type { PiecePreset } from '../types'

export function PieceOrderControls({
  piece,
  onQuantity,
  onTargetLength
}: {
  piece: PiecePreset
  onQuantity: (id: string, quantity: number) => void
  onTargetLength: (id: string, lengthCm: number) => boolean
}): JSX.Element {
  const byMetre = piece.orderMode === 'target-length'
  const lengthMetres = (piece.targetLengthCm ?? 100) / 100

  return (
    <div className="space-y-2 text-xs">
      <div
        role="group"
        aria-label={`Order unit for ${piece.displayName}`}
        className="flex flex-wrap gap-1"
      >
        <Button
          type="button"
          size="sm"
          variant={byMetre ? 'outline' : 'secondary'}
          aria-pressed={!byMetre}
          onClick={() => {
            if (byMetre) onQuantity(piece.id, piece.quantity)
          }}
        >
          Copies
        </Button>
        <Button
          type="button"
          size="sm"
          variant={byMetre ? 'secondary' : 'outline'}
          aria-pressed={byMetre}
          onClick={() => {
            if (!byMetre) onTargetLength(piece.id, piece.targetLengthCm ?? 100)
          }}
        >
          By metre
        </Button>
      </div>
      {byMetre ? (
        <>
          <label className="block font-medium">
            Vertical length (m)
            <input
              aria-label={`Vertical length of ${piece.displayName} in metres`}
              key={`${piece.id}-length-${piece.targetLengthCm}`}
              type="number"
              min={MIN_PRODUCTION_SHEET_HEIGHT_CM / 100}
              max={MAX_PRODUCTION_SHEET_HEIGHT_CM / 100}
              step={0.01}
              defaultValue={lengthMetres}
              className="mt-1 h-9 w-28 max-w-full rounded border bg-background px-2"
              onBlur={(event) => {
                const value = Number(event.currentTarget.value)
                const lengthCm = Math.round(value * 10000) / 100
                if (
                  Number.isFinite(value) &&
                  value >= MIN_PRODUCTION_SHEET_HEIGHT_CM / 100 &&
                  value <= MAX_PRODUCTION_SHEET_HEIGHT_CM / 100 &&
                  (lengthCm === piece.targetLengthCm || onTargetLength(piece.id, lengthCm))
                ) {
                  event.currentTarget.value = String(lengthCm / 100)
                } else {
                  event.currentTarget.value = String(lengthMetres)
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
          </label>
          <p className="text-muted-foreground">
            {piece.quantity} calculated copies · cutter margins reserved
          </p>
          <p className="text-muted-foreground">
            {MIN_PRODUCTION_SHEET_HEIGHT_CM / 100}–{MAX_PRODUCTION_SHEET_HEIGHT_CM / 100} m per
            section
          </p>
        </>
      ) : (
        <label className="block font-medium">
          Copies
          <input
            aria-label={`Copies of ${piece.displayName}`}
            key={`${piece.id}-copies-${piece.quantity}`}
            type="number"
            min={1}
            max={100000}
            step={1}
            defaultValue={piece.quantity}
            className="mt-1 h-9 w-28 max-w-full rounded border bg-background px-2"
            onBlur={(event) => {
              const value = Number(event.currentTarget.value)
              if (Number.isSafeInteger(value) && value >= 1 && value <= 100000) {
                if (value !== piece.quantity) onQuantity(piece.id, value)
              } else {
                event.currentTarget.value = String(piece.quantity)
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
        </label>
      )}
    </div>
  )
}
