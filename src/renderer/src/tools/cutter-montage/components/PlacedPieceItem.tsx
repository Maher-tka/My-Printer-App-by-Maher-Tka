import { Copy, LockKeyhole, RotateCw, Trash2, UnlockKeyhole } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CutterLayerVisibility, PiecePreset, PlacedPiece } from '../types'
import { getPlacedArtworkRect, getPlacedCutlineRect } from '../lib/cutlineGenerator'
import { getMaskClipPath, getPlacedMaskRect } from '../lib/maskUtils'
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
  const artworkRect = useMemo(() => getPlacedArtworkRect(placed, piece), [piece, placed])
  const maskRect = useMemo(() => getPlacedMaskRect(placed, piece), [piece, placed])
  const cutlineRect = useMemo(() => getPlacedCutlineRect(placed, piece), [piece, placed])

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
        warning === 'out-of-bounds'
          ? 'ring-2 ring-destructive'
          : warning === 'overlap'
            ? 'ring-2 ring-amber-500'
            : selected
              ? 'ring-2 ring-primary'
              : 'ring-1 ring-slate-300/60'
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
      {simplifiedPreview && dragging ? (
        <div className="absolute inset-0 bg-primary/15" aria-label="Simplified drag preview" />
      ) : layers.artwork &&
        piece.objectVisibility.artwork &&
        (piece.clippingMaskEnabled ?? piece.mask.enabled) ? (
        <div
          className="absolute overflow-hidden"
          style={{
            left: (maskRect.xCm - placed.xCm) * scale,
            top: (maskRect.yCm - placed.yCm) * scale,
            width: maskRect.widthCm * scale,
            height: maskRect.heightCm * scale,
            clipPath: getMaskClipPath(piece.mask),
            transform: `rotate(${maskRect.rotation - placed.rotation}deg)`,
            transformOrigin: 'center'
          }}
        >
          <img
            src={piece.previewUrl}
            alt={piece.displayName}
            className="absolute object-fill"
            style={{
              left: (artworkRect.xCm - maskRect.xCm) * scale,
              top: (artworkRect.yCm - maskRect.yCm) * scale,
              width: artworkRect.widthCm * scale,
              height: artworkRect.heightCm * scale,
              transform: `rotate(${artworkRect.rotation - maskRect.rotation}deg)`,
              transformOrigin: 'center'
            }}
            draggable={false}
          />
        </div>
      ) : layers.artwork && piece.objectVisibility.artwork ? (
        <img
          src={piece.previewUrl}
          alt={piece.displayName}
          className="absolute object-fill"
          style={{
            left: (artworkRect.xCm - placed.xCm) * scale,
            top: (artworkRect.yCm - placed.yCm) * scale,
            width: artworkRect.widthCm * scale,
            height: artworkRect.heightCm * scale,
            transform: `rotate(${artworkRect.rotation - placed.rotation}deg)`,
            transformOrigin: 'center'
          }}
          draggable={false}
        />
      ) : null}
      {layers.cutlines && piece.objectVisibility.cutline && (
        <div
          className={`pointer-events-none absolute ${
            piece.cutline.shape === 'ellipse'
              ? 'rounded-full'
              : piece.cutline.shape === 'rounded-rectangle'
                ? 'rounded-md'
                : ''
          }`}
          style={{
            left: (cutlineRect.xCm - placed.xCm) * scale,
            top: (cutlineRect.yCm - placed.yCm) * scale,
            width: cutlineRect.widthCm * scale,
            height: cutlineRect.heightCm * scale,
            border: `1px solid ${piece.cutline.strokeColor}`,
            transform: `rotate(${cutlineRect.rotation - placed.rotation}deg)`,
            transformOrigin: 'center'
          }}
        />
      )}
      <div className="pointer-events-none absolute left-1 top-1 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
        {placed.displayName}
        {warning ? ` · ${warning}` : ''}
      </div>
      {selected && (
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
