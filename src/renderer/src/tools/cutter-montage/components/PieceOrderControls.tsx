import { useLanguage } from '@/i18n/useLanguage'
import { Button } from '@/components/ui/button'
import { LiveNumberInput } from './LiveNumberInput'
import { MAX_CUTTER_JOB_COPIES } from '../lib/layoutLimits'
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
  const { t } = useLanguage()

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
          {t('Copies')}
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
          {t('By metre')}
        </Button>
      </div>
      {byMetre ? (
        <>
          <label className="block font-medium">
            {t('Vertical length (m)')}
            <LiveNumberInput
              aria-label={`Vertical length of ${piece.displayName} in metres`}
              key={`${piece.id}-length`}
              min={MIN_PRODUCTION_SHEET_HEIGHT_CM / 100}
              max={MAX_PRODUCTION_SHEET_HEIGHT_CM / 100}
              step={0.01}
              value={lengthMetres}
              onValueChange={(value) => onTargetLength(piece.id, Math.round(value * 10000) / 100)}
              className="mt-1 h-9 w-28 max-w-full rounded border bg-background px-2"
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
          {t('Copies')}
          <LiveNumberInput
            aria-label={`Copies of ${piece.displayName}`}
            key={`${piece.id}-copies`}
            integer
            min={1}
            max={MAX_CUTTER_JOB_COPIES}
            step={1}
            value={piece.quantity}
            onValueChange={(value) => onQuantity(piece.id, value)}
            onRejectedValue={() => onQuantity(piece.id, MAX_CUTTER_JOB_COPIES + 1)}
            className="mt-1 h-9 w-28 max-w-full rounded border bg-background px-2"
          />
        </label>
      )}
    </div>
  )
}
