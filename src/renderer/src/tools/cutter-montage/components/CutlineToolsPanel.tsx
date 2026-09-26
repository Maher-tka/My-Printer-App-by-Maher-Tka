import { Circle, Copy, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CutlineShape, PiecePreset } from '../types'

interface CutlineToolsPanelProps {
  piece: PiecePreset
  onPieceChange: (piece: PiecePreset) => void
  onDuplicateShapeAsCutline: () => void
}

export function CutlineToolsPanel({
  piece,
  onPieceChange,
  onDuplicateShapeAsCutline
}: CutlineToolsPanelProps): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-3">
      <h4 className="text-sm font-semibold">Cutline</h4>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ShapeButton
          piece={piece}
          shape="rectangle"
          label="Rect"
          icon={Square}
          onPieceChange={onPieceChange}
        />
        <ShapeButton
          piece={piece}
          shape="rounded-rectangle"
          label="Rounded"
          icon={Square}
          onPieceChange={onPieceChange}
        />
        <ShapeButton
          piece={piece}
          shape="ellipse"
          label="Ellipse"
          icon={Circle}
          onPieceChange={onPieceChange}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPieceChange(createCutlineFromArtwork(piece))}
        >
          From Artwork
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPieceChange(createCutlineFromMask(piece))}
          disabled={!piece.mask.enabled}
        >
          From Mask
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onDuplicateShapeAsCutline}
          disabled={!piece.mask.enabled && !piece.helperShape}
        >
          <Copy data-icon="inline-start" />
          From Shape
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberField
          label="X"
          value={piece.cutline.transform.xCm}
          onChange={(xCm) => onPieceChange(updateCutlineTransform(piece, { xCm }))}
        />
        <NumberField
          label="Y"
          value={piece.cutline.transform.yCm}
          onChange={(yCm) => onPieceChange(updateCutlineTransform(piece, { yCm }))}
        />
        <NumberField
          label="Width"
          value={piece.cutline.transform.widthCm}
          onChange={(widthCm) =>
            onPieceChange(updateCutlineTransform(piece, { widthCm: Math.max(widthCm, 0.2) }))
          }
        />
        <NumberField
          label="Height"
          value={piece.cutline.transform.heightCm}
          onChange={(heightCm) =>
            onPieceChange(updateCutlineTransform(piece, { heightCm: Math.max(heightCm, 0.2) }))
          }
        />
        {piece.stickerMakerOffsetMm === undefined ? (
          <NumberField
            label="Offset mm"
            value={piece.cutline.transform.offsetMm}
            onChange={(offsetMm) => onPieceChange(updateCutlineTransform(piece, { offsetMm }))}
          />
        ) : (
          <div className="rounded border bg-muted/40 p-2 text-xs">
            Cut offset: {piece.stickerMakerOffsetMm} mm, built into path
          </div>
        )}
        <NumberField
          label="Rotate"
          value={piece.cutline.transform.rotation}
          onChange={(rotation) => onPieceChange(updateCutlineTransform(piece, { rotation }))}
        />
      </div>
      <label className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
        Spot name
        <span className="flex h-9 items-center overflow-hidden rounded border bg-background">
          <input
            className="min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none"
            value={piece.cutline.strokeName}
            onChange={(event) =>
              onPieceChange({
                ...piece,
                cutline: { ...piece.cutline, strokeName: event.target.value || 'CutContour' }
              })
            }
          />
          <span className="mr-2 size-4 rounded-full border" style={{ background: '#ff00ff' }} />
        </span>
      </label>
    </section>
  )
}

function ShapeButton({
  piece,
  shape,
  label,
  icon: Icon,
  onPieceChange
}: {
  piece: PiecePreset
  shape: CutlineShape
  label: string
  icon: typeof Square
  onPieceChange: (piece: PiecePreset) => void
}): JSX.Element {
  return (
    <Button
      type="button"
      size="sm"
      variant={piece.cutline.shape === shape ? 'default' : 'outline'}
      onClick={() => onPieceChange({ ...piece, cutline: { ...piece.cutline, shape } })}
    >
      <Icon data-icon="inline-start" />
      {label}
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
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
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

function updateCutlineTransform(
  piece: PiecePreset,
  patch: Partial<PiecePreset['cutline']['transform']>
): PiecePreset {
  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      transform: { ...piece.cutline.transform, ...patch }
    }
  }
}

function createCutlineFromArtwork(piece: PiecePreset): PiecePreset {
  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      shape: 'rectangle',
      transform: {
        ...piece.artwork.transform,
        offsetMm: piece.cutline.transform.offsetMm
      }
    }
  }
}

function createCutlineFromMask(piece: PiecePreset): PiecePreset {
  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      shape: getCutlineShapeFromMask(piece.mask.shape),
      transform: {
        ...piece.mask.transform,
        offsetMm: piece.cutline.transform.offsetMm
      }
    }
  }
}

function getCutlineShapeFromMask(shape: PiecePreset['mask']['shape']): CutlineShape {
  if (shape === 'ellipse') return 'ellipse'
  if (shape === 'rounded-rectangle') return 'rounded-rectangle'
  if (shape === 'custom-polygon') return 'custom-path'
  return 'rectangle'
}
