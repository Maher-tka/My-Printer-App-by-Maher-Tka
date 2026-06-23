import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type {
  ArtworkTransform,
  EditorObjectType,
  EditorTool,
  KeyObjectState,
  MaskShape,
  PiecePreset
} from '../types'
import { getPieceCutlineRect } from '../lib/cutlineGenerator'
import {
  getPieceMaskRect,
  getShapeClipPath,
  updateHelperTransform,
  updateMaskTransform
} from '../lib/maskUtils'

interface PieceEditorCanvasProps {
  piece: PiecePreset
  scale: number
  tool: EditorTool
  selectedObjects: EditorObjectType[]
  keyObject: KeyObjectState
  showGrid: boolean
  snapToGrid: boolean
  smartGuides: boolean
  onPieceChange: (piece: PiecePreset) => void
  onSelectedObjectsChange: (objects: EditorObjectType[]) => void
  onContextMenuOpen: (x: number, y: number) => void
}

export function PieceEditorCanvas({
  piece,
  scale,
  tool,
  selectedObjects,
  keyObject,
  showGrid,
  snapToGrid,
  smartGuides,
  onPieceChange,
  onSelectedObjectsChange,
  onContextMenuOpen
}: PieceEditorCanvasProps): JSX.Element {
  const dragRef = useRef<{
    object: EditorObjectType | null
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  }>({
    object: null,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  })
  const resizeRef = useRef<{
    object: EditorObjectType | null
    pointerId: number
    startX: number
    startY: number
    widthCm: number
    heightCm: number
  }>({
    object: null,
    pointerId: -1,
    startX: 0,
    startY: 0,
    widthCm: 0,
    heightCm: 0
  })
  const [draftShape, setDraftShape] = useState<{
    shape: MaskShape
    transform: ArtworkTransform
  } | null>(null)
  const drawRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    shape: MaskShape
  } | null>(null)
  const maskRect = useMemo(() => getPieceMaskRect(piece.mask), [piece.mask])
  const cutlineRect = useMemo(() => getPieceCutlineRect(piece.cutline), [piece.cutline])
  const artworkSelected = selectedObjects.includes('artwork')
  const maskSelected = selectedObjects.includes('mask')
  const cutlineSelected = selectedObjects.includes('cutline')
  const helperSelected = selectedObjects.includes('helper-shape')
  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : null
  const selectedTransform = selectedObject ? getObjectFullTransform(piece, selectedObject) : null
  const selectedLocked = selectedObject
    ? piece.objectLocks[selectedObject === 'helper-shape' ? 'helper' : selectedObject]
    : true

  return (
    <div
      className="flex min-h-[560px] items-center justify-center overflow-visible rounded-lg border bg-slate-100 p-8"
      style={{
        backgroundImage: showGrid
          ? 'linear-gradient(0deg,rgba(148,163,184,0.20)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.20)_1px,transparent_1px)'
          : undefined,
        backgroundSize: `${Math.max(scale * 0.5, 8)}px ${Math.max(scale * 0.5, 8)}px`
      }}
    >
      <div
        className="relative bg-white shadow-md"
        style={{ width: piece.widthCm * scale, height: piece.heightCm * scale }}
        onContextMenu={(event) => {
          event.preventDefault()
          onContextMenuOpen(event.clientX, event.clientY)
        }}
      >
        {piece.objectVisibility.artwork && (piece.clippingMaskEnabled ?? piece.mask.enabled) ? (
          <img
            src={piece.previewUrl}
            alt={piece.displayName}
            className={`absolute cursor-move object-fill ${keyObject.object === 'artwork' ? 'ring-4 ring-amber-400' : artworkSelected ? 'ring-2 ring-primary' : ''}`}
            style={{
              left: piece.artwork.transform.xCm * scale,
              top: piece.artwork.transform.yCm * scale,
              width: piece.artwork.transform.widthCm * scale,
              height: piece.artwork.transform.heightCm * scale,
              clipPath: getArtworkClipPath(piece, scale),
              transform: `rotate(${piece.artwork.transform.rotation}deg)`,
              transformOrigin: 'center'
            }}
            draggable={false}
            onPointerDown={(event) => beginObjectDrag(event, 'artwork')}
            onPointerMove={moveObjectDrag}
            onPointerUp={endObjectDrag}
          />
        ) : piece.objectVisibility.artwork ? (
          <img
            src={piece.previewUrl}
            alt={piece.displayName}
            className={`absolute cursor-move object-fill ${keyObject.object === 'artwork' ? 'ring-4 ring-amber-400' : artworkSelected ? 'ring-2 ring-primary' : 'ring-1 ring-slate-300'}`}
            style={{
              left: piece.artwork.transform.xCm * scale,
              top: piece.artwork.transform.yCm * scale,
              width: piece.artwork.transform.widthCm * scale,
              height: piece.artwork.transform.heightCm * scale,
              transform: `rotate(${piece.artwork.transform.rotation}deg)`,
              transformOrigin: 'center'
            }}
            draggable={false}
            onPointerDown={(event) => beginObjectDrag(event, 'artwork')}
            onPointerMove={moveObjectDrag}
            onPointerUp={endObjectDrag}
          />
        ) : null}

        {piece.mask.enabled && piece.objectVisibility.mask && (
          <div
            className={`absolute cursor-move border border-dashed border-sky-500 ${
              piece.mask.shape === 'ellipse' ? 'rounded-full' : piece.mask.shape === 'rounded-rectangle' ? 'rounded-md' : ''
            } ${keyObject.object === 'mask' ? 'ring-4 ring-amber-400' : maskSelected ? 'ring-2 ring-primary' : ''}`}
            style={{
              left: maskRect.xCm * scale,
              top: maskRect.yCm * scale,
              width: maskRect.widthCm * scale,
              height: maskRect.heightCm * scale,
              transform: `rotate(${maskRect.rotation}deg)`,
              transformOrigin: 'center',
              pointerEvents: artworkSelected && !maskSelected ? 'none' : 'auto'
            }}
            onPointerDown={(event) => beginObjectDrag(event, 'mask')}
            onPointerMove={moveObjectDrag}
            onPointerUp={endObjectDrag}
          />
        )}

        {piece.helperShape && piece.objectVisibility.helper && (
          <div
            className={`absolute cursor-move border-2 border-dashed border-violet-500 bg-violet-500/10 ${
              piece.helperShape.shape === 'ellipse' ? 'rounded-full' : piece.helperShape.shape === 'rounded-rectangle' ? 'rounded-md' : ''
            } ${keyObject.object === 'helper-shape' ? 'ring-4 ring-amber-400' : helperSelected ? 'ring-2 ring-primary' : ''}`}
            style={{
              left: piece.helperShape.transform.xCm * scale,
              top: piece.helperShape.transform.yCm * scale,
              width: piece.helperShape.transform.widthCm * scale,
              height: piece.helperShape.transform.heightCm * scale,
              clipPath: getShapeClipPath(piece.helperShape.shape),
              transform: `rotate(${piece.helperShape.transform.rotation}deg)`,
              transformOrigin: 'center'
            }}
            onPointerDown={(event) => beginObjectDrag(event, 'helper-shape')}
            onPointerMove={moveObjectDrag}
            onPointerUp={endObjectDrag}
          />
        )}

        {piece.objectVisibility.cutline && (
          <div
            className={`absolute cursor-move ${piece.cutline.shape === 'ellipse' ? 'rounded-full' : piece.cutline.shape === 'rounded-rectangle' ? 'rounded-md' : ''} ${
              keyObject.object === 'cutline' ? 'ring-4 ring-amber-400' : cutlineSelected ? 'ring-2 ring-primary' : ''
            }`}
            style={{
              left: cutlineRect.xCm * scale,
              top: cutlineRect.yCm * scale,
              width: cutlineRect.widthCm * scale,
              height: cutlineRect.heightCm * scale,
              border: `1.5px solid ${piece.cutline.strokeColor}`,
              transform: `rotate(${cutlineRect.rotation}deg)`,
              transformOrigin: 'center'
            }}
            onPointerDown={(event) => beginObjectDrag(event, 'cutline')}
            onPointerMove={moveObjectDrag}
            onPointerUp={endObjectDrag}
          />
        )}

        {draftShape && (
          <div
            className={`pointer-events-none absolute border-2 border-dashed border-primary bg-primary/10 ${
              draftShape.shape === 'ellipse' ? 'rounded-full' : draftShape.shape === 'rounded-rectangle' ? 'rounded-md' : ''
            }`}
            style={{
              left: draftShape.transform.xCm * scale,
              top: draftShape.transform.yCm * scale,
              width: draftShape.transform.widthCm * scale,
              height: draftShape.transform.heightCm * scale,
              clipPath: getShapeClipPath(draftShape.shape)
            }}
          />
        )}

        {tool === 'select' && selectedObject && selectedTransform && !selectedLocked && (
          <button
            type="button"
            className="absolute z-40 size-3 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-sm border border-white bg-primary shadow"
            style={{
              left: (selectedTransform.xCm + selectedTransform.widthCm) * scale,
              top: (selectedTransform.yCm + selectedTransform.heightCm) * scale
            }}
            onPointerDown={(event) => beginResize(event, selectedObject, selectedTransform)}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            aria-label={`Resize ${selectedObject}`}
          />
        )}

        {keyObject.object && (
          <div className="pointer-events-none absolute right-2 top-2 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
            Key: {keyObject.object}
          </div>
        )}
        {isShapeTool(tool) && (
          <div
            className="absolute inset-0 z-30 cursor-crosshair"
            onPointerDown={beginShapeDraw}
            onPointerMove={moveShapeDraw}
            onPointerUp={endShapeDraw}
          />
        )}
      </div>
    </div>
  )

  function beginObjectDrag(
    event: ReactPointerEvent<HTMLElement>,
    object: EditorObjectType
  ): void {
    if (tool !== 'select' || piece.objectLocks[object === 'helper-shape' ? 'helper' : object]) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    if (event.shiftKey) {
      onSelectedObjectsChange(
        selectedObjects.includes(object)
          ? selectedObjects.filter((selected) => selected !== object)
          : [...selectedObjects, object]
      )
    } else {
      onSelectedObjectsChange([object])
    }
    const transform = getObjectTransform(piece, object)

    dragRef.current = {
      object,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.xCm,
      originY: transform.yCm
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveObjectDrag(event: ReactPointerEvent<HTMLElement>): void {
    const drag = dragRef.current

    if (drag.object === null || drag.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    const transform = getObjectFullTransform(piece, drag.object)
    let nextX = drag.originX + (event.clientX - drag.startX) / scale
    let nextY = drag.originY + (event.clientY - drag.startY) / scale

    if (snapToGrid) {
      nextX = Math.round(nextX * 10) / 10
      nextY = Math.round(nextY * 10) / 10
    }

    if (smartGuides) {
      nextX = snapToTargets(nextX, [0, (piece.widthCm - transform.widthCm) / 2, piece.widthCm - transform.widthCm])
      nextY = snapToTargets(nextY, [0, (piece.heightCm - transform.heightCm) / 2, piece.heightCm - transform.heightCm])
    }
    onPieceChange(moveEditorObject(piece, drag.object, nextX, nextY))
  }

  function endObjectDrag(event: ReactPointerEvent<HTMLElement>): void {
    if (dragRef.current.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    dragRef.current = {
      object: null,
      pointerId: -1,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0
    }
  }

  function beginResize(
    event: ReactPointerEvent<HTMLButtonElement>,
    object: EditorObjectType,
    transform: ArtworkTransform
  ): void {
    event.preventDefault()
    event.stopPropagation()
    resizeRef.current = {
      object,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      widthCm: transform.widthCm,
      heightCm: transform.heightCm
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveResize(event: ReactPointerEvent<HTMLButtonElement>): void {
    const resize = resizeRef.current

    if (!resize.object || resize.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    const deltaX = (event.clientX - resize.startX) / scale
    const deltaY = (event.clientY - resize.startY) / scale
    let widthCm = Math.max(resize.widthCm + deltaX, 0.2)
    let heightCm = Math.max(resize.heightCm + deltaY, 0.2)

    if (event.shiftKey || piece.lockAspectRatio) {
      const ratio = resize.heightCm / Math.max(resize.widthCm, 0.01)

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        widthCm = Math.max(heightCm / ratio, 0.2)
      } else {
        heightCm = Math.max(widthCm * ratio, 0.2)
      }
    }

    onPieceChange(resizeEditorObject(piece, resize.object, widthCm, heightCm))
  }

  function endResize(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (resizeRef.current.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    resizeRef.current = {
      object: null,
      pointerId: -1,
      startX: 0,
      startY: 0,
      widthCm: 0,
      heightCm: 0
    }
  }

  function beginShapeDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!isShapeTool(tool)) {
      return
    }

    event.preventDefault()
    const point = getLocalPoint(event)
    const shape = getMaskShapeFromTool(tool)

    drawRef.current = {
      pointerId: event.pointerId,
      startX: point.xCm,
      startY: point.yCm,
      shape
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraftShape({
      shape,
      transform: {
        xCm: point.xCm,
        yCm: point.yCm,
        widthCm: 0,
        heightCm: 0,
        rotation: 0
      }
    })
  }

  function moveShapeDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    const draw = drawRef.current

    if (!draw || draw.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    setDraftShape({
      shape: draw.shape,
      transform: getDrawTransform(draw, getLocalPoint(event), event.shiftKey)
    })
  }

  function endShapeDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    const draw = drawRef.current

    if (!draw || draw.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const transform = getDrawTransform(draw, getLocalPoint(event), event.shiftKey)

    drawRef.current = null
    setDraftShape(null)

    if (transform.widthCm < 0.1 || transform.heightCm < 0.1) {
      return
    }

    onPieceChange({
      ...piece,
      helperShape: {
        id: `shape-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'helper',
        shape: draw.shape,
        transform,
        visible: true,
        locked: false
      }
    })
    onSelectedObjectsChange(['helper-shape'])
  }

  function getLocalPoint(event: ReactPointerEvent<HTMLElement>): { xCm: number; yCm: number } {
    const rect = event.currentTarget.getBoundingClientRect()

    const xCm = (event.clientX - rect.left) / scale
    const yCm = (event.clientY - rect.top) / scale

    return snapToGrid
      ? { xCm: Math.round(xCm * 10) / 10, yCm: Math.round(yCm * 10) / 10 }
      : { xCm, yCm }
  }
}

function snapToTargets(value: number, targets: number[]): number {
  for (const target of targets) {
    if (Math.abs(value - target) <= 0.12) {
      return target
    }
  }

  return value
}

function getArtworkClipPath(piece: PiecePreset, scale: number): string {
  const artwork = piece.artwork.transform
  const mask = piece.mask.transform
  const left = (mask.xCm - artwork.xCm) * scale
  const top = (mask.yCm - artwork.yCm) * scale
  const width = mask.widthCm * scale
  const height = mask.heightCm * scale

  if (piece.mask.shape === 'ellipse') {
    return `ellipse(${width / 2}px ${height / 2}px at ${left + width / 2}px ${top + height / 2}px)`
  }

  if (piece.mask.shape === 'custom-polygon') {
    return `polygon(${left + width / 2}px ${top}px, ${left + width}px ${top + height / 2}px, ${left + width / 2}px ${top + height}px, ${left}px ${top + height / 2}px)`
  }

  const right = Math.max(artwork.widthCm * scale - left - width, 0)
  const bottom = Math.max(artwork.heightCm * scale - top - height, 0)
  const radius = piece.mask.shape === 'rounded-rectangle' ? `${Math.min(width, height) * 0.08}px` : '0'

  return `inset(${Math.max(top, 0)}px ${right}px ${bottom}px ${Math.max(left, 0)}px round ${radius})`
}

function getObjectTransform(piece: PiecePreset, object: EditorObjectType): { xCm: number; yCm: number } {
  return getObjectFullTransform(piece, object)
}

function getObjectFullTransform(piece: PiecePreset, object: EditorObjectType): ArtworkTransform {
  if (object === 'artwork') {
    return piece.artwork.transform
  }

  if (object === 'mask') {
    return piece.mask.transform
  }

  if (object === 'helper-shape') {
    return piece.helperShape?.transform ?? piece.mask.transform
  }

  return piece.cutline.transform
}

function resizeEditorObject(
  piece: PiecePreset,
  object: EditorObjectType,
  widthCm: number,
  heightCm: number
): PiecePreset {
  if (object === 'artwork') {
    return {
      ...piece,
      artwork: {
        ...piece.artwork,
        transform: { ...piece.artwork.transform, widthCm, heightCm }
      }
    }
  }

  if (object === 'mask') {
    return updateMaskTransform(piece, { widthCm, heightCm })
  }

  if (object === 'helper-shape') {
    return updateHelperTransform(piece, { widthCm, heightCm })
  }

  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      transform: { ...piece.cutline.transform, widthCm, heightCm }
    }
  }
}

function moveEditorObject(
  piece: PiecePreset,
  object: EditorObjectType,
  xCm: number,
  yCm: number
): PiecePreset {
  if (piece.artworkCutlineGrouped) {
    const artworkDelta = {
      xCm: xCm - getObjectTransform(piece, object).xCm,
      yCm: yCm - getObjectTransform(piece, object).yCm
    }

    return {
      ...piece,
      artwork: {
        ...piece.artwork,
        transform: {
          ...piece.artwork.transform,
          xCm: piece.artwork.transform.xCm + artworkDelta.xCm,
          yCm: piece.artwork.transform.yCm + artworkDelta.yCm
        }
      },
      mask: {
        ...piece.mask,
        transform: {
          ...piece.mask.transform,
          xCm: piece.mask.transform.xCm + artworkDelta.xCm,
          yCm: piece.mask.transform.yCm + artworkDelta.yCm
        }
      },
      cutline: {
        ...piece.cutline,
        transform: {
          ...piece.cutline.transform,
          xCm: piece.cutline.transform.xCm + artworkDelta.xCm,
          yCm: piece.cutline.transform.yCm + artworkDelta.yCm
        }
      }
    }
  }

  if (object === 'artwork') {
    return {
      ...piece,
      artwork: {
        ...piece.artwork,
        transform: { ...piece.artwork.transform, xCm, yCm }
      }
    }
  }

  if (object === 'mask') {
    return updateMaskTransform(piece, { xCm, yCm })
  }

  if (object === 'helper-shape') {
    return updateHelperTransform(piece, { xCm, yCm })
  }

  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      transform: { ...piece.cutline.transform, xCm, yCm }
    }
  }
}

function isShapeTool(tool: EditorTool): boolean {
  return tool === 'rectangle' || tool === 'rounded-rectangle' || tool === 'ellipse'
}

function getMaskShapeFromTool(tool: EditorTool): MaskShape {
  if (tool === 'ellipse') {
    return 'ellipse'
  }

  if (tool === 'rounded-rectangle') {
    return 'rounded-rectangle'
  }

  return 'rectangle'
}

function getDrawTransform(
  draw: { startX: number; startY: number },
  point: { xCm: number; yCm: number },
  lockRatio: boolean
): ArtworkTransform {
  let width = point.xCm - draw.startX
  let height = point.yCm - draw.startY

  if (lockRatio) {
    const size = Math.max(Math.abs(width), Math.abs(height))
    width = width < 0 ? -size : size
    height = height < 0 ? -size : size
  }

  return {
    xCm: Math.min(draw.startX, draw.startX + width),
    yCm: Math.min(draw.startY, draw.startY + height),
    widthCm: Math.abs(width),
    heightCm: Math.abs(height),
    rotation: 0
  }
}
