import { MaskedArtwork } from './MaskedArtwork'
import { getNormalizedShapePath } from '../lib/shapeGeometry'
import { Copy, LockKeyhole, RotateCw, Trash2, UnlockKeyhole } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CutterLayerVisibility, PiecePreset, PlacedPiece } from '../types'
import { getPlacedTransformScale } from '../lib/cutlineGenerator'
import { roundToStep } from '../lib/units'

interface PlacedPieceItemProps {
  piece: PiecePreset
  placed: PlacedPiece
  scale: number
  selected: boolean
  warning?: 'out-of-bounds' | 'overlap'
  layers: CutterLayerVisibility
  sheetWidthCm: number
  sheetHeightCm: number
  snapStepCm: number
  simplifiedPreview?: boolean
  cleanArtworkPreview?: boolean
  onSelect: (pieceId: string, additive: boolean) => void
  onMove: (pieceId: string, xCm: number, yCm: number) => void
  onDuplicate: (pieceId: string) => void
  onDelete: (pieceId: string) => void
  onRotate: (pieceId: string) => void
  onToggleLock: (pieceId: string) => void
}

export const PlacedPieceItem = memo(function PlacedPieceItem({
  piece,
  placed,
  scale,
  selected,
  warning,
  layers,
  sheetWidthCm,
  sheetHeightCm,
  snapStepCm,
  simplifiedPreview = false,
  cleanArtworkPreview = false,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onRotate,
  onToggleLock
}: PlacedPieceItemProps): JSX.Element {
  const itemRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const latestPositionRef = useRef({ xCm: placed.xCm, yCm: placed.yCm })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: placed.xCm,
    originY: placed.yCm
  })
  const {
    scaleX: pieceScaleX,
    scaleY: pieceScaleY,
    sceneWidthCm,
    sceneHeightCm
  } = useMemo(() => getPlacedTransformScale(placed, piece), [piece, placed])
  const artworkVisible = layers.artwork && piece.objectVisibility.artwork
  const maskObject = piece.objects.find(
    (object) => object.id === piece.maskObjectId || object.role === 'clipping-mask'
  )
  const activeMask = (piece.clippingMaskEnabled ?? piece.mask.enabled) && maskObject
  const artworkPreviewUrl = piece.artwork.previewUrl || piece.previewUrl
  const artworkTransform = placed.artworkTransform

  useEffect(() => {
    latestPositionRef.current = { xCm: placed.xCm, yCm: placed.yCm }

    if (!dragRef.current.active) {
      setTransform(placed.xCm, placed.yCm)
    }
  }, [placed.xCm, placed.yCm, scale])

  return (
    <div
      ref={itemRef}
      className={`group absolute touch-none select-none rounded-sm ${
        !cleanArtworkPreview && warning === 'out-of-bounds'
          ? 'ring-2 ring-destructive'
          : !cleanArtworkPreview && warning === 'overlap'
            ? 'ring-2 ring-amber-500'
            : !cleanArtworkPreview && selected
              ? 'ring-2 ring-primary'
              : ''
      } ${dragging ? 'z-30 cursor-grabbing' : placed.locked ? 'z-10 cursor-not-allowed' : 'z-10 cursor-grab'}`}
      style={{
        width: placed.widthCm * scale,
        height: placed.heightCm * scale,
        transform: `translate3d(${placed.xCm * scale}px, ${placed.yCm * scale}px, 0)`,
        willChange: 'transform'
      }}
      onPointerDown={(event) => {
        if (
          event.button !== 0 ||
          (event.target instanceof HTMLElement && event.target.closest('[data-no-drag="true"]'))
        ) {
          return
        }

        event.preventDefault()
        onSelect(placed.id, event.shiftKey || event.ctrlKey || event.metaKey)

        if (placed.locked) {
          return
        }

        dragRef.current = {
          active: true,
          moved: false,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: placed.xCm,
          originY: placed.yCm
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current

        if (!drag.active || drag.pointerId !== event.pointerId) {
          return
        }

        event.preventDefault()
        const deltaX = (event.clientX - drag.startX) / scale
        const deltaY = (event.clientY - drag.startY) / scale
        const xCm = clamp(
          roundToStep(drag.originX + deltaX, snapStepCm),
          0,
          Math.max(sheetWidthCm - placed.widthCm, 0)
        )
        const yCm = clamp(
          roundToStep(drag.originY + deltaY, snapStepCm),
          0,
          Math.max(sheetHeightCm - placed.heightCm, 0)
        )

        if (Math.abs(deltaX) + Math.abs(deltaY) > 0.2) {
          drag.moved = true
        }

        latestPositionRef.current = { xCm, yCm }
        scheduleTransform()
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current

        if (drag.pointerId !== event.pointerId) {
          return
        }

        dragRef.current = { ...drag, active: false, pointerId: -1 }
        setDragging(false)
        cancelScheduledTransform()

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }

        if (!drag.moved) {
          setTransform(placed.xCm, placed.yCm)
          onSelect(placed.id, event.shiftKey || event.ctrlKey || event.metaKey)
          return
        }

        onMove(placed.id, latestPositionRef.current.xCm, latestPositionRef.current.yCm)
      }}
    >
      {!cleanArtworkPreview && simplifiedPreview && dragging ? (
        <div className="absolute inset-0 bg-primary/15" aria-label="Simplified drag preview" />
      ) : (
        <div
          className="absolute"
          style={{
            left: ((placed.widthCm - sceneWidthCm) / 2) * scale,
            top: ((placed.heightCm - sceneHeightCm) / 2) * scale,
            width: sceneWidthCm * scale,
            height: sceneHeightCm * scale,
            transform: `rotate(${placed.rotation}deg)`,
            transformOrigin: 'center'
          }}
        >
          {artworkVisible && activeMask ? (
            <MaskedArtwork
              artwork={artworkTransform}
              mask={{ ...maskObject!, transform: placed.maskTransform }}
              src={artworkPreviewUrl}
              width={sceneWidthCm / pieceScaleX}
              height={sceneHeightCm / pieceScaleY}
            />
          ) : artworkVisible ? (
            <img
              src={artworkPreviewUrl}
              alt={piece.displayName}
              className="absolute object-fill"
              style={{
                left: artworkTransform.xCm * pieceScaleX * scale,
                top: artworkTransform.yCm * pieceScaleY * scale,
                width: artworkTransform.widthCm * pieceScaleX * scale,
                height: artworkTransform.heightCm * pieceScaleY * scale,
                transform: `rotate(${artworkTransform.rotation}deg)`,
                transformOrigin: 'center'
              }}
              draggable={false}
            />
          ) : null}
          {!cleanArtworkPreview &&
            layers.cutlines &&
            piece.objects
              .filter((object) => object.role === 'cutline' && object.visible)
              .map((object) => {
                const t = object.transform,
                  offset = (object.offsetMm ?? 0) / 10
                return (
                  <svg
                    key={object.id}
                    className="pointer-events-none absolute overflow-visible"
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                    style={{
                      left: (t.xCm * pieceScaleX - offset) * scale,
                      top: (t.yCm * pieceScaleY - offset) * scale,
                      width: (t.widthCm * pieceScaleX + 2 * offset) * scale,
                      height: (t.heightCm * pieceScaleY + 2 * offset) * scale,
                      transform: `rotate(${t.rotation}deg)`,
                      transformOrigin: 'center'
                    }}
                  >
                    <path
                      d={getNormalizedShapePath(object, t.widthCm, t.heightCm)}
                      fill="none"
                      stroke={object.strokeColor ?? '#ff00ff'}
                      strokeWidth={Math.max(
                        0.5,
                        ((object.strokeWidthPt ?? 0.25) * scale * 2.54) / 72
                      )}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )
              })}
        </div>
      )}
      {!cleanArtworkPreview && (
        <div className="pointer-events-none absolute left-1 top-1 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          {placed.displayName}
          {warning ? ` · ${warning}` : ''}
        </div>
      )}
      {selected && !cleanArtworkPreview && (
        <div
          className="absolute -right-2 -top-10 z-40 flex gap-1 rounded-md border bg-card p-1 shadow-sm"
          data-no-drag="true"
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => onDuplicate(placed.id)}
            aria-label="Duplicate placed piece"
          >
            <Copy />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => onRotate(placed.id)}
            aria-label="Rotate placed piece"
          >
            <RotateCw />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => onToggleLock(placed.id)}
            aria-label={placed.locked ? 'Unlock placed piece' : 'Lock placed piece'}
          >
            {placed.locked ? <LockKeyhole /> : <UnlockKeyhole />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => onDelete(placed.id)}
            aria-label="Delete placed piece"
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </div>
  )

  function scheduleTransform(): void {
    if (animationFrameRef.current !== null) {
      return
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null
      setTransform(latestPositionRef.current.xCm, latestPositionRef.current.yCm)
    })
  }

  function cancelScheduledTransform(): void {
    if (animationFrameRef.current === null) {
      return
    }

    window.cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
  }

  function setTransform(xCm: number, yCm: number): void {
    if (itemRef.current) {
      itemRef.current.style.transform = `translate3d(${xCm * scale}px, ${yCm * scale}px, 0)`
    }
  }
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
