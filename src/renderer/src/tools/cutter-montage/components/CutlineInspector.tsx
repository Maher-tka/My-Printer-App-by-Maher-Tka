import { useLanguage } from '@/i18n/useLanguage'
import { CheckCircle2, Scissors, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CutlinePrecisionPanel } from './CutlinePrecisionPanel'
import type { PiecePreset } from '../types'
import {
  createCutlineFromArtworkBounds,
  createCutlineFromMaskBounds,
  fixPieceCutlineForMimaki,
  getCutlineInspectorState
} from '../lib/cutlineValidation'

export function CutlineInspector({
  piece,
  onPieceChange
}: {
  piece: PiecePreset | null
  onPieceChange: (piece: PiecePreset) => void
}): JSX.Element {
  const { t } = useLanguage()

  if (!piece) {
    return (
      <section className="space-y-3">
        <h3 className="font-semibold">{t('Cutline Inspector')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('Select a piece to inspect CutContour.')}
        </p>
      </section>
    )
  }

  const state = getCutlineInspectorState(piece)

  return (
    <section className="space-y-3">
      <CutlinePrecisionPanel piece={piece} onPieceChange={onPieceChange} />
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{t('Cutline Inspector')}</h3>
        <Scissors className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Metric label={t('Shape')} value={state.shape} />
        <Metric label="Spot" value={state.strokeName} />
        <Metric label={t('Stroke')} value={`${state.strokeWidthPt} pt`} />
        <Metric label={t('Offset')} value={`${state.offsetMm} mm`} />
      </div>
      <div
        className={`mt-3 flex items-center gap-2 rounded-md border p-2 text-xs ${
          state.vectorSafe
            ? 'border-emerald-300 bg-emerald-50 text-success-foreground'
            : 'border-destructive/30 bg-destructive/10 text-destructive'
        }`}
      >
        <CheckCircle2 className="size-4" />
        {state.vectorSafe ? 'Vector-safe CutContour' : 'Cutline needs review'}
      </div>
      {state.issues.length > 0 && (
        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
          {state.issues.slice(0, 3).map((issue) => (
            <div key={`${issue.id}-${issue.message}`}>{issue.message}</div>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPieceChange(fixPieceCutlineForMimaki(piece))}
        >
          <Wrench data-icon="inline-start" />
          Fix stroke to CutContour
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPieceChange(createCutlineFromArtworkBounds(piece))}
        >
          {t('Create from artwork bounds')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!piece.mask.enabled && !piece.maskObjectId}
          onClick={() => onPieceChange(createCutlineFromMaskBounds(piece))}
        >
          {t('Create from mask')}
        </Button>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  const { t } = useLanguage()

  return (
    <span className="rounded bg-muted p-2">
      <b className="block truncate text-sm text-foreground">{value}</b>
      {t(label)}
    </span>
  )
}
