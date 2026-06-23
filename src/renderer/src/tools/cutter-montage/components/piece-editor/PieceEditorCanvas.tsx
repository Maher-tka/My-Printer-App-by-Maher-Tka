import {
  memo,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type { ArtworkTransform, EditorObject, EditorTool, MaskShape, PiecePreset } from '../../types'
import { syncLegacyFieldsFromObjects } from '../../lib/pieceModelSync'
import { PieceEditorTransformBox, type TransformHandle } from './PieceEditorTransformBox'

interface PieceEditorCanvasProps {
  piece: PiecePreset
  scale: number
  tool: EditorTool
  showGrid: boolean
  snapToGrid: boolean
  smartGuides: boolean
  onPieceChange: (piece: PiecePreset) => void
  onTransformStart: (piece: PiecePreset) => void
  onSelectObject: (id: string, additive: boolean) => void
  onSelectIds: (ids: string[]) => void
  onContextMenuOpen: (x: number, y: number) => void
}

interface DragState {
  mode: 'move' | 'resize' | 'rotate'
  pointerId: number
  startX: number
  startY: number
  startAngle: number
  handle?: TransformHandle
  bounds: ArtworkTransform
  objects: EditorObject[]
}

interface MarqueeState {
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
  width: number
  height: number
}

export const PieceEditorCanvas = memo(function PieceEditorCanvas({
  piece,
  scale,
  tool,
  showGrid,
  snapToGrid,
  smartGuides,
  onPieceChange,
  onTransformStart,
  onSelectObject,
  onSelectIds,
  onContextMenuOpen
}: PieceEditorCanvasProps): JSX.Element {
  const artboardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const frameRef = useRef<number | null>(null)
  const latestPieceRef = useRef(piece)
  latestPieceRef.current = piece
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [draftShape, setDraftShape] = useState<{ shape: MaskShape; transform: ArtworkTransform } | null>(null)
  const drawRef = useRef<{ pointerId: number; startX: number; startY: number; shape: MaskShape } | null>(null)
  const selectedObjects = useMemo(
    () => piece.objects.filter((object) => piece.selectedObjectIds.includes(object.id)),
    [piece.objects, piece.selectedObjectIds]
  )

  return (
    <div
      className="flex min-h-[560px] items-center justify-center overflow-auto rounded-lg border bg-slate-100 p-12"
      style={{
        backgroundImage: showGrid
          ? 'linear-gradient(0deg,rgba(148,163,184,0.20)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.20)_1px,transparent_1px)'
          : undefined,
        backgroundSize: `${Math.max(scale * 0.5, 8)}px ${Math.max(scale * 0.5, 8)}px`
      }}
    >
      <div
        ref={artboardRef}
        className="relative shrink-0 bg-white shadow-md"
        style={{ width: piece.widthCm * scale, height: piece.heightCm * scale }}
        onContextMenu={(event) => {
          event.preventDefault()
          onContextMenuOpen(event.clientX, event.clientY)
        }}
        onPointerDown={beginMarquee}
        onPointerMove={moveMarquee}
        onPointerUp={endMarquee}
      >
        {piece.objects.map((object) => (
          <CanvasObject
            key={object.id}
            object={object}
            piece={piece}
            scale={scale}
            selected={piece.selectedObjectIds.includes(object.id)}
            isKey={piece.keyObjectId === object.id}
            onPointerDown={(event) => beginMove(event, object)}
            onPointerMove={moveTransform}
            onPointerUp={endTransform}
          />
        ))}

        {draftShape ? <ShapePreview shape={draftShape.shape} transform={draftShape.transform} scale={scale} /> : null}
        {marquee ? (
          <div
            className="pointer-events-none absolute z-50 border border-primary bg-primary/10"
            style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }}
          />
        ) : null}

        {tool === 'select' ? (
          <PieceEditorTransformBox
            objects={selectedObjects}
            scale={scale}
            onHandlePointerDown={beginHandleTransform}
            onHandlePointerMove={moveTransform}
            onHandlePointerUp={endTransform}
          />
        ) : null}

        {isShapeTool(tool) ? (
          <div
            className="absolute inset-0 z-30 cursor-crosshair"
            onPointerDown={beginShapeDraw}
            onPointerMove={moveShapeDraw}
            onPointerUp={endShapeDraw}
          />
        ) : null}
      </div>
    </div>
  )

  function beginMove(event: ReactPointerEvent<HTMLElement>, object: EditorObject): void {
    if (tool !== 'select' || object.locked) return
    event.preventDefault()
    event.stopPropagation()
    const isAlreadySelected = piece.selectedObjectIds.includes(object.id)
    if (event.shiftKey && isAlreadySelected) {
      onSelectObject(object.id, true)
      return
    }
    const groupedIds = object.groupId
      ? piece.objects.filter((candidate) => candidate.groupId === object.groupId).map((candidate) => candidate.id)
      : [object.id]
    const ids = isAlreadySelected && !event.shiftKey
      ? piece.selectedObjectIds
      : event.shiftKey
        ? Array.from(new Set([...piece.selectedObjectIds, ...groupedIds]))
        : groupedIds
    onSelectIds(ids)
    const objects = piece.objects.filter((candidate) => ids.includes(candidate.id) && !candidate.locked)
    const bounds = getBounds(objects)
    onTransformStart(piece)
    dragRef.current = {
      mode: 'move', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      startAngle: 0, bounds, objects: objects.map(cloneObject)
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginHandleTransform(
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: TransformHandle,
    bounds: ArtworkTransform
  ): void {
    event.preventDefault()
    event.stopPropagation()
    const objects = selectedObjects.filter((object) => !object.locked).map(cloneObject)
    if (objects.length === 0) return
    onTransformStart(piece)
    const centerX = bounds.xCm * scale + bounds.widthCm * scale / 2
    const centerY = bounds.yCm * scale + bounds.heightCm * scale / 2
    const artboardRect = artboardRef.current?.getBoundingClientRect()
    const localX = event.clientX - (artboardRect?.left ?? 0)
    const localY = event.clientY - (artboardRect?.top ?? 0)
    dragRef.current = {
      mode: handle === 'rotate' ? 'rotate' : 'resize', pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY,
      startAngle: Math.atan2(localY - centerY, localX - centerX), handle, bounds, objects
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveTransform(event: ReactPointerEvent<HTMLElement>): void {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    schedulePieceChange(getTransformedPiece(event, drag))
  }

  function endTransform(event: ReactPointerEvent<HTMLElement>): void {
    if (dragRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
  }

  function getTransformedPiece(event: ReactPointerEvent<HTMLElement>, drag: DragState): PiecePreset {
    const dx = (event.clientX - drag.startX) / scale
    const dy = (event.clientY - drag.startY) / scale
    const originals = new Map(drag.objects.map((object) => [object.id, object]))
    let transforms = new Map<string, ArtworkTransform>()

    if (drag.mode === 'move') {
      for (const object of drag.objects) {
        let xCm = object.transform.xCm + dx
        let yCm = object.transform.yCm + dy
        if (snapToGrid) {
          xCm = Math.round(xCm * 10) / 10
          yCm = Math.round(yCm * 10) / 10
        }
        if (smartGuides) {
          xCm = snap(xCm, [0, (piece.widthCm - object.transform.widthCm) / 2, piece.widthCm - object.transform.widthCm])
          yCm = snap(yCm, [0, (piece.heightCm - object.transform.heightCm) / 2, piece.heightCm - object.transform.heightCm])
        }
        transforms.set(object.id, { ...object.transform, xCm, yCm })
      }
    } else if (drag.mode === 'rotate') {
      const rect = artboardRef.current?.getBoundingClientRect()
      const centerX = (rect?.left ?? 0) + (drag.bounds.xCm + drag.bounds.widthCm / 2) * scale
      const centerY = (rect?.top ?? 0) + (drag.bounds.yCm + drag.bounds.heightCm / 2) * scale
      const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX)
      const delta = (angle - drag.startAngle) * 180 / Math.PI
      for (const object of drag.objects) transforms.set(object.id, { ...object.transform, rotation: object.transform.rotation + delta })
    } else {
      const resized = resizeBounds(drag.bounds, drag.handle ?? 'se', dx, dy, event.shiftKey, event.altKey)
      const scaleX = resized.widthCm / Math.max(drag.bounds.widthCm, 0.01)
      const scaleY = resized.heightCm / Math.max(drag.bounds.heightCm, 0.01)
      for (const object of drag.objects) {
        transforms.set(object.id, {
          ...object.transform,
          xCm: resized.xCm + (object.transform.xCm - drag.bounds.xCm) * scaleX,
          yCm: resized.yCm + (object.transform.yCm - drag.bounds.yCm) * scaleY,
          widthCm: Math.max(object.transform.widthCm * scaleX, 0.2),
          heightCm: Math.max(object.transform.heightCm * scaleY, 0.2)
        })
      }
    }

    return syncLegacyFieldsFromObjects({
      ...latestPieceRef.current,
      objects: latestPieceRef.current.objects.map((object) => originals.has(object.id)
        ? { ...object, transform: transforms.get(object.id) ?? object.transform }
        : object)
    })
  }

  function schedulePieceChange(next: PiecePreset): void {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      onPieceChange(next)
    })
  }

  function beginMarquee(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.target !== event.currentTarget || tool !== 'select') return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    setMarquee({ pointerId: event.pointerId, startX: x, startY: y, x, y, width: 0, height: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
    if (!event.shiftKey) onSelectIds([])
  }

  function moveMarquee(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!marquee || marquee.pointerId !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    setMarquee({ ...marquee, x: Math.min(marquee.startX, x), y: Math.min(marquee.startY, y), width: Math.abs(x - marquee.startX), height: Math.abs(y - marquee.startY) })
  }

  function endMarquee(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!marquee || marquee.pointerId !== event.pointerId) return
    const selection = { x: marquee.x / scale, y: marquee.y / scale, width: marquee.width / scale, height: marquee.height / scale }
    const ids = piece.objects.filter((object) => object.visible && intersects(selection, object.transform)).map((object) => object.id)
    onSelectIds(event.shiftKey ? Array.from(new Set([...piece.selectedObjectIds, ...ids])) : ids)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setMarquee(null)
  }

  function beginShapeDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!isShapeTool(tool)) return
    const point = localPoint(event)
    const shape = tool === 'ellipse' ? 'ellipse' : tool === 'rounded-rectangle' ? 'rounded-rectangle' : 'rectangle'
    drawRef.current = { pointerId: event.pointerId, startX: point.xCm, startY: point.yCm, shape }
    setDraftShape({ shape, transform: { xCm: point.xCm, yCm: point.yCm, widthCm: 0, heightCm: 0, rotation: 0 } })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveShapeDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    const draw = drawRef.current
    if (!draw || draw.pointerId !== event.pointerId) return
    setDraftShape({ shape: draw.shape, transform: drawTransform(draw, localPoint(event), event.shiftKey) })
  }

  function endShapeDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    const draw = drawRef.current
    if (!draw || draw.pointerId !== event.pointerId) return
    const transform = drawTransform(draw, localPoint(event), event.shiftKey)
    drawRef.current = null
    setDraftShape(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (transform.widthCm < 0.1 || transform.heightCm < 0.1) return
    const id = createObjectId('helper')
    const helperNumber = piece.objects.filter((object) => object.role === 'helper').length + 1
    const shapeType = draw.shape === 'custom-polygon'
      ? 'path'
      : draw.shape === 'square'
        ? 'rectangle'
        : draw.shape
    const helper: EditorObject = {
      id, type: 'helper-shape', role: 'helper', shapeType,
      name: `Helper Shape ${helperNumber}`, visible: true, locked: false, transform,
      fillColor: 'rgba(139, 92, 246, 0.1)', strokeColor: '#8b5cf6', strokeWidthPt: 0.75,
      exportEnabled: false
    }
    onTransformStart(piece)
    onPieceChange(syncLegacyFieldsFromObjects({
      ...piece,
      objects: [...piece.objects, helper],
      helperObjectIds: [...piece.helperObjectIds, id],
      selectedObjectIds: [id],
      keyObjectId: undefined
    }))
  }

  function localPoint(event: ReactPointerEvent<HTMLElement>): { xCm: number; yCm: number } {
    const rect = event.currentTarget.getBoundingClientRect()
    const xCm = (event.clientX - rect.left) / scale
    const yCm = (event.clientY - rect.top) / scale
    return snapToGrid ? { xCm: Math.round(xCm * 10) / 10, yCm: Math.round(yCm * 10) / 10 } : { xCm, yCm }
  }
})

const CanvasObject = memo(function CanvasObject({
  object, piece, scale, selected, isKey, onPointerDown, onPointerMove, onPointerUp
}: {
  object: EditorObject
  piece: PiecePreset
  scale: number
  selected: boolean
  isKey: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
}): JSX.Element | null {
  if (!object.visible) return null
  const transform = object.transform
  const commonStyle = {
    left: transform.xCm * scale,
    top: transform.yCm * scale,
    width: transform.widthCm * scale,
    height: transform.heightCm * scale,
    transform: `rotate(${transform.rotation}deg)`,
    transformOrigin: 'center',
    zIndex: object.role === 'cutline' ? 20 : object.role === 'helper' || object.role === 'clipping-mask' ? 10 : 1
  }
  const ring = isKey ? 'ring-4 ring-amber-400' : selected ? 'ring-2 ring-primary' : ''
  const handlers = { onPointerDown, onPointerMove, onPointerUp }
  if (object.shapeType === 'image') {
    return (
      <img
        src={piece.previewUrl}
        alt={object.name}
        draggable={false}
        className={`absolute cursor-move select-none object-fill ${ring}`}
        style={{ ...commonStyle, clipPath: object.role === 'artwork' && piece.clippingMaskEnabled ? getArtworkClipPath(piece, scale) : undefined }}
        {...handlers}
      />
    )
  }
  return (
    <div
      className={`absolute cursor-move ${shapeClass(object.shapeType)} ${ring}`}
      style={{
        ...commonStyle,
        border: object.role === 'cutline'
          ? `1.5px solid ${object.strokeColor ?? '#ff00ff'}`
          : `1.5px dashed ${object.role === 'clipping-mask' ? '#0ea5e9' : '#8b5cf6'}`,
        background: object.role === 'helper' ? 'rgba(139,92,246,0.1)' : 'transparent',
        clipPath: object.shapeType === 'path' ? 'polygon(50% 0,100% 50%,50% 100%,0 50%)' : undefined
      }}
      {...handlers}
    />
  )
})

function ShapePreview({ shape, transform, scale }: { shape: MaskShape; transform: ArtworkTransform; scale: number }): JSX.Element {
  const editorShape = shape === 'custom-polygon' ? 'path' : shape === 'square' ? 'rectangle' : shape
  return <div className={`pointer-events-none absolute z-30 border-2 border-dashed border-primary bg-primary/10 ${shapeClass(editorShape)}`} style={{ left: transform.xCm * scale, top: transform.yCm * scale, width: transform.widthCm * scale, height: transform.heightCm * scale }} />
}

function getArtworkClipPath(piece: PiecePreset, scale: number): string {
  const artwork = piece.artwork.transform
  const mask = piece.mask.transform
  const left = (mask.xCm - artwork.xCm) * scale
  const top = (mask.yCm - artwork.yCm) * scale
  const width = mask.widthCm * scale
  const height = mask.heightCm * scale
  if (piece.mask.shape === 'ellipse') return `ellipse(${width / 2}px ${height / 2}px at ${left + width / 2}px ${top + height / 2}px)`
  if (piece.mask.shape === 'custom-polygon') return `polygon(${left + width / 2}px ${top}px,${left + width}px ${top + height / 2}px,${left + width / 2}px ${top + height}px,${left}px ${top + height / 2}px)`
  const right = Math.max(artwork.widthCm * scale - left - width, 0)
  const bottom = Math.max(artwork.heightCm * scale - top - height, 0)
  return `inset(${Math.max(top, 0)}px ${right}px ${bottom}px ${Math.max(left, 0)}px round ${piece.mask.shape === 'rounded-rectangle' ? `${Math.min(width, height) * 0.08}px` : '0'})`
}

function resizeBounds(bounds: ArtworkTransform, handle: TransformHandle, dx: number, dy: number, keepRatio: boolean, fromCenter: boolean): ArtworkTransform {
  let left = bounds.xCm
  let top = bounds.yCm
  let right = bounds.xCm + bounds.widthCm
  let bottom = bounds.yCm + bounds.heightCm
  if (handle.includes('w')) left += dx
  if (handle.includes('e')) right += dx
  if (handle.includes('n')) top += dy
  if (handle.includes('s')) bottom += dy
  if (fromCenter) {
    if (handle.includes('w')) right -= dx
    if (handle.includes('e')) left -= dx
    if (handle.includes('n')) bottom -= dy
    if (handle.includes('s')) top -= dy
  }
  let width = Math.max(right - left, 0.2)
  let height = Math.max(bottom - top, 0.2)
  if (keepRatio) {
    const ratio = bounds.widthCm / Math.max(bounds.heightCm, 0.01)
    if (Math.abs(dx) >= Math.abs(dy)) height = width / ratio
    else width = height * ratio
    if (handle.includes('w')) left = right - width
    if (handle.includes('n')) top = bottom - height
  }
  return { xCm: left, yCm: top, widthCm: width, heightCm: height, rotation: 0 }
}

function drawTransform(draw: { startX: number; startY: number }, point: { xCm: number; yCm: number }, square: boolean): ArtworkTransform {
  let width = Math.abs(point.xCm - draw.startX)
  let height = Math.abs(point.yCm - draw.startY)
  if (square) width = height = Math.max(width, height)
  return { xCm: point.xCm < draw.startX ? draw.startX - width : draw.startX, yCm: point.yCm < draw.startY ? draw.startY - height : draw.startY, widthCm: width, heightCm: height, rotation: 0 }
}

function getBounds(objects: EditorObject[]): ArtworkTransform {
  if (objects.length === 0) return { xCm: 0, yCm: 0, widthCm: 0, heightCm: 0, rotation: 0 }
  const left = Math.min(...objects.map((object) => object.transform.xCm))
  const top = Math.min(...objects.map((object) => object.transform.yCm))
  const right = Math.max(...objects.map((object) => object.transform.xCm + object.transform.widthCm))
  const bottom = Math.max(...objects.map((object) => object.transform.yCm + object.transform.heightCm))
  return { xCm: left, yCm: top, widthCm: right - left, heightCm: bottom - top, rotation: 0 }
}

function intersects(a: { x: number; y: number; width: number; height: number }, b: ArtworkTransform): boolean {
  return a.x <= b.xCm + b.widthCm && a.x + a.width >= b.xCm && a.y <= b.yCm + b.heightCm && a.y + a.height >= b.yCm
}
function snap(value: number, targets: number[]): number { return targets.find((target) => Math.abs(value - target) <= 0.12) ?? value }
function shapeClass(shape: string): string { return shape === 'ellipse' ? 'rounded-full' : shape === 'rounded-rectangle' ? 'rounded-md' : '' }
function cloneObject(object: EditorObject): EditorObject { return { ...object, transform: { ...object.transform } } }
function isShapeTool(tool: EditorTool): boolean { return tool === 'rectangle' || tool === 'rounded-rectangle' || tool === 'ellipse' }
function createObjectId(prefix: string): string { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` }
