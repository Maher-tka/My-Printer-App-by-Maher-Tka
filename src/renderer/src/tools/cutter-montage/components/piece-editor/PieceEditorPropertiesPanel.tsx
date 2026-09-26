import { Copy, LockKeyhole, RotateCcw, UnlockKeyhole } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  CUTTER_PIECE_MAX_DIMENSION_CM,
  CUTTER_PIECE_MIN_DIMENSION_CM,
  resizePiecePreset
} from '../../lib/piecePresets'
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
  const activeMaskPairLocked = piece.clippingMaskEnabled
  const selectedTransformLocked = Boolean(
    selectedObject &&
    (selectedObject.locked ||
      (activeMaskPairLocked &&
        (selectedObject.id === piece.artworkObjectId || selectedObject.id === piece.maskObjectId)))
  )

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Piece">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Width cm"
            value={piece.widthCm}
            step={0.1}
            min={CUTTER_PIECE_MIN_DIMENSION_CM}
            max={CUTTER_PIECE_MAX_DIMENSION_CM}
            onChange={(value) => {
              const normalizedValue = clampPieceDimension(value)
              const acceptedPiece = resizePiecePreset(
                piece,
                normalizedValue,
                piece.heightCm,
                'width'
              )
              onPieceSizeChange(normalizedValue, piece.heightCm, 'width')
              return acceptedPiece.widthCm
            }}
          />
          <NumberField
            label="Height cm"
            value={piece.heightCm}
            step={0.1}
            min={CUTTER_PIECE_MIN_DIMENSION_CM}
            max={CUTTER_PIECE_MAX_DIMENSION_CM}
            onChange={(value) => {
              const normalizedValue = clampPieceDimension(value)
              const acceptedPiece = resizePiecePreset(
                piece,
                piece.widthCm,
                normalizedValue,
                'height'
              )
              onPieceSizeChange(piece.widthCm, normalizedValue, 'height')
              return acceptedPiece.heightCm
            }}
          />
          {!hideQuantity && (
            <NumberField
              label="Quantity"
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
            Mask contents are locked. Piece size resizes the complete sticker.
          </p>
        ) : null}
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={piece.lockAspectRatio}
            onChange={(event) => onAspectLockChange(event.target.checked)}
          />
          Lock aspect ratio
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
            Reset
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDuplicatePiece}>
            <Copy data-icon="inline-start" />
            Duplicate preset
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
            variant={piece.groupLinked ? 'default' : 'outline'}
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
                label="Width"
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
                label="Height"
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
                label="Rotation"
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
          <p className="text-xs text-muted-foreground">Select one object to edit exact geometry.</p>
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
  const canonicalValue = formatNumberFieldValue(value)
  const [draft, setDraft] = useState(canonicalValue)
  const isEditingRef = useRef(false)
  const skipNextBlurCommitRef = useRef(false)

  useEffect(() => {
    if (!isEditingRef.current || disabled) {
      setDraft(formatNumberFieldValue(value))
    }
  }, [disabled, value])

  function restoreCanonicalValue(): void {
    setDraft(formatNumberFieldValue(value))
  }

  function commitDraft(): void {
    const parsed = Number(draft)
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      restoreCanonicalValue()
      return
    }

    if (parsed === value) {
      restoreCanonicalValue()
      return
    }

    const acceptedValue = onChange(parsed)
    setDraft(formatNumberFieldValue(Number.isFinite(acceptedValue) ? acceptedValue : value))
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        className="h-8 rounded border bg-background px-2 text-sm text-foreground"
        type="number"
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        value={draft}
        onFocus={() => {
          isEditingRef.current = true
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          isEditingRef.current = false
          if (disabled) {
            skipNextBlurCommitRef.current = false
            restoreCanonicalValue()
            return
          }
          if (skipNextBlurCommitRef.current) {
            skipNextBlurCommitRef.current = false
            return
          }
          commitDraft()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commitDraft()
            skipNextBlurCommitRef.current = true
            event.currentTarget.blur()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            restoreCanonicalValue()
            skipNextBlurCommitRef.current = true
            event.currentTarget.blur()
          }
        }}
      />
    </label>
  )
}

function formatNumberFieldValue(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(3))) : '0'
}

function clampPieceDimension(value: number): number {
  return Math.min(Math.max(value, CUTTER_PIECE_MIN_DIMENSION_CM), CUTTER_PIECE_MAX_DIMENSION_CM)
}
