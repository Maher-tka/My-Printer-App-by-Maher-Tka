import { useLanguage } from '@/i18n/useLanguage'
import { Copy, LockKeyhole, RotateCcw, UnlockKeyhole } from 'lucide-react'
import { LiveNumberInput } from '../LiveNumberInput'
import { Button } from '@/components/ui/button'
import {
  CUTTER_PIECE_MAX_DIMENSION_CM,
  CUTTER_PIECE_MIN_DIMENSION_CM
} from '../../lib/piecePresets'
import { getPieceSize, resizePieceToSize } from '../../lib/pieceSize'
import type { ArtworkTransform, EditorObject, PiecePreset } from '../../types'

interface PieceEditorPropertiesPanelProps {
  hideQuantity?: boolean
  piece: PiecePreset
  selectedObject?: EditorObject
  onPieceSizeChange: (widthCm: number, heightCm: number, source: 'width' | 'height') => void
  onQuantityChange: (quantity: number) => void
  onAspectLockChange: (locked: boolean) => void
  onObjectTransformChange: (objectId: string, patch: Partial<ArtworkTransform>) => void
  onReset: () => void
  onDuplicatePiece: () => void
  onPieceLockChange: (locked: boolean) => void
  onGroupChange: (linked: boolean) => void
}

export function PieceEditorPropertiesPanel({
  piece,
  selectedObject,
  onPieceSizeChange,
  onQuantityChange,
  hideQuantity = false,
  onAspectLockChange,
  onObjectTransformChange,
  onReset,
  onDuplicatePiece,
  onPieceLockChange,
  onGroupChange
}: PieceEditorPropertiesPanelProps): JSX.Element {
  const { t } = useLanguage()

  const activeMaskPairLocked = piece.clippingMaskEnabled
  const pieceSize = getPieceSize(piece)
  const selectedTransformLocked = Boolean(
    selectedObject &&
    (selectedObject.locked ||
      (activeMaskPairLocked &&
        (selectedObject.id === piece.artworkObjectId || selectedObject.id === piece.maskObjectId)))
  )

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t('Piece size')}>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={t('Width cm')}
            value={pieceSize.widthCm}
            step={0.1}
            min={CUTTER_PIECE_MIN_DIMENSION_CM}
            max={CUTTER_PIECE_MAX_DIMENSION_CM}
            onChange={(value) => {
              const normalizedValue = clampPieceDimension(value)
              const acceptedPiece = resizePieceToSize(
                piece,
                normalizedValue,
                pieceSize.heightCm,
                'width'
              )
              onPieceSizeChange(normalizedValue, pieceSize.heightCm, 'width')
              return getPieceSize(acceptedPiece).widthCm
            }}
          />
          <NumberField
            label={t('Height cm')}
            value={pieceSize.heightCm}
            step={0.1}
            min={CUTTER_PIECE_MIN_DIMENSION_CM}
            max={CUTTER_PIECE_MAX_DIMENSION_CM}
            onChange={(value) => {
              const normalizedValue = clampPieceDimension(value)
              const acceptedPiece = resizePieceToSize(
                piece,
                pieceSize.widthCm,
                normalizedValue,
                'height'
              )
              onPieceSizeChange(pieceSize.widthCm, normalizedValue, 'height')
              return getPieceSize(acceptedPiece).heightCm
            }}
          />
          {!hideQuantity && (
            <NumberField
              label={t('Quantity')}
              value={piece.quantity}
              step={1}
              onChange={(value) => {
                const normalizedValue = Math.max(1, Math.round(value))
                onQuantityChange(normalizedValue)
                return normalizedValue
              }}
            />
          )}
        </div>
        {activeMaskPairLocked ? (
          <p className="mt-2 rounded-md bg-sky-50 px-2 py-1.5 text-xs text-sky-800">
            Size is measured from the mask, excluding cropped artwork and the cut margin. Resizing
            keeps the artwork, mask and cut lines together.
          </p>
        ) : null}
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={piece.lockAspectRatio}
            onChange={(event) => onAspectLockChange(event.target.checked)}
          />
          {t('Lock aspect ratio')}
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={activeMaskPairLocked}
            onClick={onReset}
          >
            <RotateCcw data-icon="inline-start" />
            {t('Reset')}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDuplicatePiece}>
            <Copy data-icon="inline-start" />
            {t('Duplicate preset')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            title={
              piece.locked
                ? 'New arranged copies will start locked. Click to make them unlocked by default.'
                : 'New arranged copies will start unlocked. Click to make them locked by default.'
            }
            onClick={() => onPieceLockChange(!piece.locked)}
          >
            {piece.locked ? (
              <LockKeyhole data-icon="inline-start" />
            ) : (
              <UnlockKeyhole data-icon="inline-start" />
            )}
            {piece.locked ? 'New copies locked' : 'New copies unlocked'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={piece.groupLinked ? 'selected' : 'outline'}
            disabled={activeMaskPairLocked}
            onClick={() => onGroupChange(!piece.groupLinked)}
          >
            {piece.groupLinked ? 'Linked transforms' : 'Edit independently'}
          </Button>
        </div>
      </Panel>
      <Panel title={selectedObject ? `${selectedObject.name} Transform` : 'Transform'}>
        {selectedObject ? (
          <>
            {selectedTransformLocked ? (
              <p className="mb-3 rounded-md bg-sky-50 px-2 py-1.5 text-xs text-sky-800">
                {activeMaskPairLocked &&
                (selectedObject.id === piece.artworkObjectId ||
                  selectedObject.id === piece.maskObjectId)
                  ? 'Artwork and mask are locked while the clipping mask is active. Release the mask to edit them.'
                  : 'This object is locked. Unlock it to edit its geometry.'}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="X"
                value={selectedObject.transform.xCm}
                step={0.1}
                disabled={selectedTransformLocked}
                onChange={(xCm) => {
                  onObjectTransformChange(selectedObject.id, { xCm })
                  return xCm
                }}
              />
              <NumberField
                label="Y"
                value={selectedObject.transform.yCm}
                step={0.1}
                disabled={selectedTransformLocked}
                onChange={(yCm) => {
                  onObjectTransformChange(selectedObject.id, { yCm })
                  return yCm
                }}
              />
              <NumberField
                label={t('Width')}
                value={selectedObject.transform.widthCm}
                step={0.1}
                disabled={selectedTransformLocked}
                onChange={(widthCm) => {
                  const normalizedValue = Math.max(widthCm, 0.2)
                  onObjectTransformChange(selectedObject.id, { widthCm: normalizedValue })
                  return normalizedValue
                }}
              />
              <NumberField
                label={t('Height')}
                value={selectedObject.transform.heightCm}
                step={0.1}
                disabled={selectedTransformLocked}
                onChange={(heightCm) => {
                  const normalizedValue = Math.max(heightCm, 0.2)
                  onObjectTransformChange(selectedObject.id, { heightCm: normalizedValue })
                  return normalizedValue
                }}
              />
              <NumberField
                label={t('Rotation')}
                value={selectedObject.transform.rotation}
                step={1}
                disabled={selectedTransformLocked}
                onChange={(rotation) => {
                  onObjectTransformChange(selectedObject.id, { rotation })
                  return rotation
                }}
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('Select one object to edit exact geometry.')}
          </p>
        )}
      </Panel>
    </div>
  )
}

export function Panel({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function NumberField({
  label,
  value,
  step,
  min,
  max,
  disabled = false,
  onChange
}: {
  label: string
  value: number
  step: number
  min?: number
  max?: number
  disabled?: boolean
  onChange: (value: number) => number
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {t(label)}
      <LiveNumberInput
        className="h-8 rounded border bg-background px-2 text-sm text-foreground"
        value={value}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        integer={label === 'Quantity'}
        onValueChange={onChange}
      />
    </label>
  )
}
function clampPieceDimension(value: number): number {
  return Math.min(Math.max(value, CUTTER_PIECE_MIN_DIMENSION_CM), CUTTER_PIECE_MAX_DIMENSION_CM)
}
