import { useLanguage } from '@/i18n/useLanguage'
import { Circle, Pentagon, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MaskShape, PiecePreset } from '../types'
import { createMaskForPiece, updateMaskTransform } from '../lib/maskUtils'

interface MaskToolsPanelProps {
  piece: PiecePreset
  onPieceChange: (piece: PiecePreset) => void
  onCreateCutlineFromMask: () => void
}

export function MaskToolsPanel({
  piece,
  onPieceChange,
  onCreateCutlineFromMask
}: MaskToolsPanelProps): JSX.Element {
  const { t } = useLanguage()

  return (
    <section className="rounded-lg border bg-card p-3">
      <h4 className="text-sm font-semibold">{t('Mask / Crop')}</h4>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MaskButton
          piece={piece}
          shape="rectangle"
          label="Rect"
          icon={Square}
          onPieceChange={onPieceChange}
        />
        <MaskButton
          piece={piece}
          shape="square"
          label={t('Square')}
          icon={Square}
          onPieceChange={onPieceChange}
        />
        <MaskButton
          piece={piece}
          shape="rounded-rectangle"
          label={t('Rounded')}
          icon={Square}
          onPieceChange={onPieceChange}
        />
        <MaskButton
          piece={piece}
          shape="ellipse"
          label={t('Circle')}
          icon={Circle}
          onPieceChange={onPieceChange}
        />
        <MaskButton
          piece={piece}
          shape="custom-polygon"
          label="Polygon later"
          icon={Pentagon}
          onPieceChange={onPieceChange}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberField
          label="Mask X"
          value={piece.mask.transform.xCm}
          onChange={(xCm) => onPieceChange(updateMaskTransform(piece, { xCm }))}
        />
        <NumberField
          label="Mask Y"
          value={piece.mask.transform.yCm}
          onChange={(yCm) => onPieceChange(updateMaskTransform(piece, { yCm }))}
        />
        <NumberField
          label="Mask W"
          value={piece.mask.transform.widthCm}
          onChange={(widthCm) =>
            onPieceChange(updateMaskTransform(piece, { widthCm: Math.max(widthCm, 0.2) }))
          }
        />
        <NumberField
          label="Mask H"
          value={piece.mask.transform.heightCm}
          onChange={(heightCm) =>
            onPieceChange(updateMaskTransform(piece, { heightCm: Math.max(heightCm, 0.2) }))
          }
        />
        <NumberField
          label={t('Rotate')}
          value={piece.mask.transform.rotation}
          onChange={(rotation) => onPieceChange(updateMaskTransform(piece, { rotation }))}
        />
      </div>
      <div className="mt-3 grid gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onCreateCutlineFromMask}
          disabled={!piece.mask.enabled}
        >
          {t('Create Cutline from Mask')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onPieceChange({ ...piece, mask: { ...piece.mask, enabled: !piece.mask.enabled } })
          }
        >
          {piece.mask.enabled ? 'Disable mask' : 'Enable mask'}
        </Button>
      </div>
    </section>
  )
}

function MaskButton({
  piece,
  shape,
  label,
  icon: Icon,
  onPieceChange
}: {
  piece: PiecePreset
  shape: MaskShape
  label: string
  icon: typeof Square
  onPieceChange: (piece: PiecePreset) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <Button
      type="button"
      size="sm"
      variant={piece.mask.enabled && piece.mask.shape === shape ? 'default' : 'outline'}
      onClick={() => onPieceChange(createMaskForPiece(piece, shape))}
    >
      <Icon data-icon="inline-start" />
      {t(label)}
    </Button>
  )
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (value: number) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {t(label)}
      <input
        className="h-8 rounded border bg-background px-2 text-sm text-foreground"
        type="number"
        step={0.1}
        value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
