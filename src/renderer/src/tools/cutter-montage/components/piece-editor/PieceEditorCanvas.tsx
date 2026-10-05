import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type {
  ArtworkTransform,
  EditorObject,
  EditorTool,
  MaskShape,
  PiecePreset
} from '../../types'
import { appendPenPoint, normalizePenPath, type PenPoint } from '../../lib/penPath'
import { syncLegacyFieldsFromObjects } from '../../lib/pieceModelSync'
import { getShapeDrawTransform, translateDraftShape } from '../../lib/shapeDraw'
import { MaskedArtwork } from '../MaskedArtwork'
import { isSelectableLayerObject } from '../../lib/editorLayers'
import { getNormalizedShapePath } from '../../lib/shapeGeometry'
import { getCutlinePreviewTransform } from '../../lib/cutlineAdjustment'
import { PieceEditorTransformBox, type TransformHandle } from './PieceEditorTransformBox'

interface PieceEditorCanvasProps {
  showTransparency?: boolean
  piece: PiecePreset
  scale: number
  zoom: number
  onZoomChange: (zoom: number) => void
  tool: EditorTool
  showGrid: boolean
  snapToGrid: boolean
  smartGuides: boolean
  onPieceChange: (piece: PiecePreset) => void
  onTransformStart: (piece: PiecePreset) => void
  onSelectObject: (id: string, additive: boolean) => void
  onSelectIds: (ids: string[]) => void
  onContextMenuOpen: (x: number, y: number) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
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
  historyCheckpointed: boolean
}

interface PanState {
  pointerId: number
  startX: number
  startY: number
  startScrollLeft: number
  startScrollTop: number
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
  showTransparency = false,
  piece,
  scale,
  zoom,
  onZoomChange,
  tool,
  showGrid,
  snapToGrid,
  smartGuides,
  onPieceChange,
  onTransformStart,
  onSelectObject,
  onSelectIds,
  onContextMenuOpen,
  onKeyDown
}: PieceEditorCanvasProps): JSX.Element {
  const artboardRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)
  const zoomAnchorRef = useRef<{
    x: number
    y: number
    fractionX: number
    fractionY: number
  } | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const panRef = useRef<PanState | null>(null)
  const frameRef = useRef<number | null>(null)
  const latestPieceRef = useRef(piece)
  latestPieceRef.current = piece
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [draftShape, setDraftShape] = useState<{
    shape: MaskShape
    transform: ArtworkTransform
  } | null>(null)
  const drawRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    shape: MaskShape
    transform: ArtworkTransform
  } | null>(null)
  const spacePressedRef = useRef(false)
  const penRef = useRef<{ pointerId: number; points: PenPoint[] } | null>(null)
  const [draftPenPoints, setDraftPenPoints] = useState<PenPoint[] | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const selectedObjects = useMemo(
    () =>
      piece.objects.filter(
        (object) =>
          piece.selectedObjectIds.includes(object.id) && isSelectableLayerObject(piece, object)
      ),
    [piece]
  )

  useLayoutEffect(() => {
    zoomRef.current = zoom
    const anchor = zoomAnchorRef.current
    const viewport = viewportRef.current
    const artboard = artboardRef.current
    if (!anchor || !viewport || !artboard) return
    zoomAnchorRef.current = null
    const bounds = artboard.getBoundingClientRect()
    viewport.scrollLeft += bounds.left + bounds.width * anchor.fractionX - anchor.x
    viewport.scrollTop += bounds.top + bounds.height * anchor.fractionY - anchor.y
  }, [zoom, scale])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey || !event.deltaY) return
      event.preventDefault()
      event.stopPropagation()
      // Keep an in-progress pointer gesture in its original coordinate system.
      if (dragRef.current || drawRef.current || panRef.current || penRef.current) return
      const artboard = artboardRef.current
      if (!artboard) return
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1)
      const next = Math.max(
        0.45,
        Math.min(2.5, zoomRef.current * Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.002))
      )
      if (next === zoomRef.current) return
      const bounds = artboard.getBoundingClientRect()
      zoomAnchorRef.current = {
        x: event.clientX,
        y: event.clientY,
        fractionX: (event.clientX - bounds.left) / bounds.width,
        fractionY: (event.clientY - bounds.top) / bounds.height
      }
      zoomRef.current = next
      onZoomChange(next)
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [onZoomChange])

  useEffect(() => {
    dragRef.current = null
    panRef.current = null
    setIsPanning(false)
    if (tool !== 'line') {
      penRef.current = null
      setDraftPenPoints(null)
    }
    if (!isShapeTool(tool)) {
      drawRef.current = null
      setDraftShape(null)
      spacePressedRef.current = false
    }
  }, [tool])

  useEffect(() => {
    const isCanvasFocused = (): boolean => {
      const viewport = viewportRef.current
      const activeElement = document.activeElement
      return Boolean(
        viewport &&
        activeElement &&
        (activeElement === viewport || viewport.contains(activeElement))
      )
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      const draw = drawRef.current
      const isShapeModifier = event.code === 'Space' || event.key === 'Alt'
      if (!isShapeModifier || !draw || !isCanvasFocused()) return
      event.preventDefault()
      event.stopPropagation()
      if (event.code === 'Space' && draw.shape === 'ellipse') spacePressedRef.current = true
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      const isShapeModifier = event.code === 'Space' || event.key === 'Alt'
      if (!isShapeModifier) return
      if (drawRef.current && isCanvasFocused()) {
        event.preventDefault()
        event.stopPropagation()
      }
      if (event.code === 'Space') spacePressedRef.current = false
    }
    const onWindowBlur = (): void => {
      spacePressedRef.current = false
      dragRef.current = null
      panRef.current = null
      setIsPanning(false)
      setMarquee(null)
      drawRef.current = null
      penRef.current = null
      setDraftShape(null)
      setDraftPenPoints(null)
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [])

  return (
    <div
      ref={viewportRef}
      dir="ltr"
      tabIndex={0}
      aria-label="Piece editor canvas"
      className={`flex min-h-0 min-w-0 flex-1 items-start justify-start overflow-auto rounded-lg border bg-slate-100 p-6 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${isPanning ? 'cursor-grabbing' : tool === 'pan' ? 'cursor-grab' : ''}`}
      style={{
        overflowAnchor: 'none',
        backgroundImage: showGrid
          ? 'linear-gradient(0deg,rgba(148,163,184,0.20)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.20)_1px,transparent_1px)'
          : undefined,
        backgroundSize: `${Math.max(scale * 0.5, 8)}px ${Math.max(scale * 0.5, 8)}px`
      }}
      onKeyDown={onKeyDown}
      onPointerDown={beginViewportPointerDown}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={cancelPointerInteraction}
    >
      <div
        ref={artboardRef}
        className="relative m-auto shrink-0 bg-white shadow-md"
        style={{
          width: piece.widthCm * scale,
          height: piece.heightCm * scale,
          ...(showTransparency
            ? {
                backgroundImage: 'conic-gradient(#e2e8f0 25%, white 0 50%, #e2e8f0 0 75%, white 0)',
                backgroundSize: '16px 16px'
              }
            : {})
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          onContextMenuOpen(event.clientX, event.clientY)
        }}
        onPointerDown={beginMarquee}
        onPointerMove={moveMarquee}
        onPointerUp={endMarquee}
        onPointerCancel={cancelPointerInteraction}
      >
        <div className="pointer-events-none absolute inset-0 isolate">
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
        </div>

        {draftShape ? (
          <ShapePreview shape={draftShape.shape} transform={draftShape.transform} scale={scale} />
        ) : null}
        {draftPenPoints ? <PenPathPreview points={draftPenPoints} scale={scale} /> : null}
        {marquee ? (
          <div
            className="pointer-events-none absolute z-50 border border-primary bg-primary/10"
            style={{
              left: marquee.x,
              top: marquee.y,
              width: marquee.width,
              height: marquee.height
            }}
          />
        ) : null}

        {tool === 'select' ? (
          <PieceEditorTransformBox
            objects={selectedObjects}
            scale={scale}
            onMovePointerDown={beginSelectionMove}
            onMovePointerMove={moveTransform}
            onMovePointerUp={endTransform}
            onHandlePointerDown={beginHandleTransform}
            onHandlePointerMove={moveTransform}
            onHandlePointerUp={endTransform}
          />
        ) : null}

        {tool === 'line' ? (
          <div
            className="absolute inset-0 z-30 touch-none cursor-crosshair"
            onPointerDown={beginPenDraw}
            onPointerMove={movePenDraw}
            onPointerUp={endPenDraw}
          />
        ) : isShapeTool(tool) ? (
          <div
            className="absolute inset-0 z-30 touch-none cursor-crosshair"
            onPointerDown={beginShapeDraw}
            onPointerMove={moveShapeDraw}
            onPointerUp={endShapeDraw}
          />
        ) : null}
      </div>
    </div>
  )

  function beginViewportPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    viewportRef.current?.focus({ preventScroll: true })
    if (tool !== 'pan' || panRef.current) return
    event.preventDefault()
    const viewport = viewportRef.current
    if (!viewport) return
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop
    }
    setIsPanning(true)
    viewport.setPointerCapture(event.pointerId)
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>): void {
    const pan = panRef.current
    const viewport = viewportRef.current
    if (!pan || !viewport || pan.pointerId !== event.pointerId) return
    event.preventDefault()
    viewport.scrollLeft = pan.startScrollLeft - (event.clientX - pan.startX)
    viewport.scrollTop = pan.startScrollTop - (event.clientY - pan.startY)
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>): void {
    if (panRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    panRef.current = null
    setIsPanning(false)
  }

  function cancelPointerInteraction(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
    panRef.current = null
    setIsPanning(false)
    setMarquee(null)
    drawRef.current = null
    penRef.current = null
    setDraftShape(null)
    setDraftPenPoints(null)
    spacePressedRef.current = false
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }

  function beginMove(event: ReactPointerEvent<HTMLElement>, object: EditorObject): void {
    if (tool !== 'select' || !isSelectableLayerObject(piece, object)) return
    viewportRef.current?.focus({ preventScroll: true })
    event.preventDefault()
    event.stopPropagation()
    const isAlreadySelected = piece.selectedObjectIds.includes(object.id)
    const groupedIds = object.groupId
      ? piece.objects
          .filter(
            (candidate) =>
              candidate.groupId === object.groupId && isSelectableLayerObject(piece, candidate)
          )
          .map((candidate) => candidate.id)
      : [object.id]
    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    if (additive && groupedIds.every((id) => piece.selectedObjectIds.includes(id))) {
      if (groupedIds.length === 1) onSelectObject(object.id, true)
      else onSelectIds(piece.selectedObjectIds.filter((id) => !groupedIds.includes(id)))
      return
    }
    const ids =
      isAlreadySelected && !additive
        ? piece.selectedObjectIds
        : additive
          ? Array.from(new Set([...piece.selectedObjectIds, ...groupedIds]))
          : groupedIds
    onSelectIds(ids)
    const objects = piece.objects.filter(
      (candidate) => ids.includes(candidate.id) && isSelectableLayerObject(piece, candidate)
    )
    const bounds = getBounds(objects)
    dragRef.current = {
      mode: 'move',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startAngle: 0,
      bounds,
      objects: objects.map(cloneObject),
      historyCheckpointed: false
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginSelectionMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (tool !== 'select') return
    viewportRef.current?.focus({ preventScroll: true })
    event.preventDefault()
    event.stopPropagation()
    const objects = getTransformObjects(piece, selectedObjects)
    if (objects.length === 0) return
    dragRef.current = {
      mode: 'move',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startAngle: 0,
      bounds: getBounds(objects),
      objects: objects.map(cloneObject),
      historyCheckpointed: false
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginHandleTransform(
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: TransformHandle,
    bounds: ArtworkTransform
  ): void {
    viewportRef.current?.focus({ preventScroll: true })
    event.preventDefault()
    event.stopPropagation()
    const objects = getTransformObjects(piece, selectedObjects).map(cloneObject)
    if (objects.length === 0) return
    const centerX = bounds.xCm * scale + (bounds.widthCm * scale) / 2
    const centerY = bounds.yCm * scale + (bounds.heightCm * scale) / 2
    const artboardRect = artboardRef.current?.getBoundingClientRect()
    const localX = event.clientX - (artboardRect?.left ?? 0)
    const localY = event.clientY - (artboardRect?.top ?? 0)
    dragRef.current = {
      mode: handle === 'rotate' ? 'rotate' : 'resize',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startAngle: Math.atan2(localY - centerY, localX - centerX),
      handle,
      bounds,
      objects,
      historyCheckpointed: false
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveTransform(event: ReactPointerEvent<HTMLElement>): void {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    const nextPiece = getTransformedPiece(event, drag)
    if (!hasTransformChanges(drag.objects, nextPiece)) return
    if (!drag.historyCheckpointed) {
      onTransformStart(latestPieceRef.current)
      drag.historyCheckpointed = true
    }
    schedulePieceChange(nextPiece)
  }

  function endTransform(event: ReactPointerEvent<HTMLElement>): void {
    if (dragRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
  }

  function getTransformedPiece(
    event: ReactPointerEvent<HTMLElement>,
    drag: DragState
  ): PiecePreset {
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
          xCm = snap(xCm, [
            0,
            (piece.widthCm - object.transform.widthCm) / 2,
            piece.widthCm - object.transform.widthCm
          ])
          yCm = snap(yCm, [
            0,
            (piece.heightCm - object.transform.heightCm) / 2,
            piece.heightCm - object.transform.heightCm
          ])
        }
        transforms.set(object.id, { ...object.transform, xCm, yCm })
      }
    } else if (drag.mode === 'rotate') {
      const rect = artboardRef.current?.getBoundingClientRect()
      const centerX = (rect?.left ?? 0) + (drag.bounds.xCm + drag.bounds.widthCm / 2) * scale
      const centerY = (rect?.top ?? 0) + (drag.bounds.yCm + drag.bounds.heightCm / 2) * scale
      const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX)
      const delta = ((angle - drag.startAngle) * 180) / Math.PI
      for (const object of drag.objects)
        transforms.set(object.id, {
          ...object.transform,
          rotation: object.transform.rotation + delta
        })
    } else {
      const resized = resizeBounds(
        drag.bounds,
        drag.handle ?? 'se',
        dx,
        dy,
        event.shiftKey,
        event.altKey
      )
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
      objects: latestPieceRef.current.objects.map((object) =>
        originals.has(object.id)
          ? { ...object, transform: transforms.get(object.id) ?? object.transform }
          : object
      )
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
    setMarquee({
      ...marquee,
      x: Math.min(marquee.startX, x),
      y: Math.min(marquee.startY, y),
      width: Math.abs(x - marquee.startX),
      height: Math.abs(y - marquee.startY)
    })
  }

  function endMarquee(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!marquee || marquee.pointerId !== event.pointerId) return
    const selection = {
      x: marquee.x / scale,
      y: marquee.y / scale,
      width: marquee.width / scale,
      height: marquee.height / scale
    }
    const ids = piece.objects
      .filter(
        (object) =>
          isSelectableLayerObject(piece, object) && intersects(selection, object.transform)
      )
      .map((object) => object.id)
    onSelectIds(event.shiftKey ? Array.from(new Set([...piece.selectedObjectIds, ...ids])) : ids)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    setMarquee(null)
  }

  function beginShapeDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!isShapeTool(tool)) return
    viewportRef.current?.focus({ preventScroll: true })
    event.preventDefault()
    const point = localPoint(event)
    const shape =
      tool === 'ellipse'
        ? 'ellipse'
        : tool === 'rounded-rectangle'
          ? 'rounded-rectangle'
          : 'rectangle'
    const transform = {
      xCm: point.xCm,
      yCm: point.yCm,
      widthCm: 0,
      heightCm: 0,
      rotation: 0
    }
    drawRef.current = {
      pointerId: event.pointerId,
      startX: point.xCm,
      startY: point.yCm,
      lastX: point.xCm,
      lastY: point.yCm,
      shape,
      transform
    }
    setDraftShape({ shape, transform })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveShapeDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    const draw = drawRef.current
    if (!draw || draw.pointerId !== event.pointerId) return
    event.preventDefault()
    const point = localPoint(event)
    if (draw.shape === 'ellipse' && spacePressedRef.current) {
      const transform = translateDraftShape(
        draw.transform,
        point.xCm - draw.lastX,
        point.yCm - draw.lastY
      )
      drawRef.current = {
        ...draw,
        startX: draw.startX + point.xCm - draw.lastX,
        startY: draw.startY + point.yCm - draw.lastY,
        lastX: point.xCm,
        lastY: point.yCm,
        transform
      }
      setDraftShape({ shape: draw.shape, transform })
      return
    }
    const transform = getShapeDrawTransform(
      draw,
      point,
      event.shiftKey,
      draw.shape === 'ellipse' && event.altKey
    )
    drawRef.current = { ...draw, lastX: point.xCm, lastY: point.yCm, transform }
    setDraftShape({
      shape: draw.shape,
      transform
    })
  }

  function endShapeDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    const draw = drawRef.current
    if (!draw || draw.pointerId !== event.pointerId) return
    event.preventDefault()
    const point = localPoint(event)
    const transform = spacePressedRef.current
      ? draw.transform
      : getShapeDrawTransform(draw, point, event.shiftKey, draw.shape === 'ellipse' && event.altKey)
    drawRef.current = null
    spacePressedRef.current = false
    setDraftShape(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (transform.widthCm < 0.1 || transform.heightCm < 0.1) return
    const id = createObjectId('helper')
    const helperNumber = piece.objects.filter((object) => object.role === 'helper').length + 1
    const shapeType =
      draw.shape === 'custom-polygon' ? 'path' : draw.shape === 'square' ? 'rectangle' : draw.shape
    const helper: EditorObject = {
      id,
      type: 'helper-shape',
      role: 'helper',
      shapeType,
      name: `Helper Shape ${helperNumber}`,
      visible: true,
      locked: false,
      transform,
      fillColor: 'rgba(139, 92, 246, 0.1)',
      strokeColor: '#8b5cf6',
      strokeWidthPt: 0.75,
      exportEnabled: false
    }
    onTransformStart(piece)
    onPieceChange(
      syncLegacyFieldsFromObjects({
        ...piece,
        objects: [...piece.objects, helper],
        helperObjectIds: [...piece.helperObjectIds, id],
        selectedObjectIds: [id],
        keyObjectId: undefined
      })
    )
  }

  function beginPenDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    if (tool !== 'line') return
    event.preventDefault()
    const points = [localPoint(event, false)]
    penRef.current = { pointerId: event.pointerId, points }
    setDraftPenPoints(points)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePenDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    const pen = penRef.current
    if (!pen || pen.pointerId !== event.pointerId) return
    event.preventDefault()
    const points = appendPenPoint(pen.points, localPoint(event, false))
    if (points === pen.points) return
    penRef.current = { ...pen, points }
    setDraftPenPoints(points)
  }

  function endPenDraw(event: ReactPointerEvent<HTMLDivElement>): void {
    const pen = penRef.current
    if (!pen || pen.pointerId !== event.pointerId) return
    event.preventDefault()
    const points = appendPenPoint(pen.points, localPoint(event, false))
    const path = normalizePenPath(points, piece.widthCm, piece.heightCm)
    penRef.current = null
    setDraftPenPoints(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!path) return

    const id = createObjectId('pen')
    const helperNumber = piece.objects.filter((object) => object.role === 'helper').length + 1
    const helper: EditorObject = {
      id,
      type: 'helper-shape',
      role: 'helper',
      shapeType: 'path',
      name: `Pen Path ${helperNumber}`,
      visible: true,
      locked: false,
      transform: path.transform,
      fillColor: 'none',
      strokeColor: '#7c3aed',
      strokeWidthPt: 1,
      pathData: path.pathData,
      exportEnabled: false
    }

    onTransformStart(piece)
    onPieceChange(
      syncLegacyFieldsFromObjects({
        ...piece,
        objects: [...piece.objects, helper],
        helperObjectIds: [...piece.helperObjectIds, id],
        selectedObjectIds: [id],
        keyObjectId: undefined
      })
    )
  }

  function localPoint(
    event: ReactPointerEvent<HTMLElement>,
    shouldSnap = snapToGrid
  ): { xCm: number; yCm: number } {
    const rect = event.currentTarget.getBoundingClientRect()
    const xCm = (event.clientX - rect.left) / scale
    const yCm = (event.clientY - rect.top) / scale
    return shouldSnap
      ? { xCm: Math.round(xCm * 10) / 10, yCm: Math.round(yCm * 10) / 10 }
      : { xCm, yCm }
  }
})

const CanvasObject = memo(function CanvasObject({
  object,
  piece,
  scale,
  selected,
  isKey,
  onPointerDown,
  onPointerMove,
  onPointerUp
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
  const transform = getCutlinePreviewTransform(object, piece)
  const commonStyle = {
    left: transform.xCm * scale,
    top: transform.yCm * scale,
    width: transform.widthCm * scale,
    height: transform.heightCm * scale,
    transform: `rotate(${transform.rotation}deg)`,
    transformOrigin: 'center'
  }
  const selectable = isSelectableLayerObject(piece, object)
  const ring = !selectable
    ? ''
    : isKey
      ? 'ring-4 ring-amber-400'
      : selected
        ? 'ring-2 ring-primary'
        : ''
  const interactionClass = selectable ? 'pointer-events-auto' : 'pointer-events-none cursor-default'
  const handlers = { onPointerDown, onPointerMove, onPointerUp }
  const activeMask = piece.clippingMaskEnabled ?? piece.mask.enabled
  if (object.shapeType === 'image') {
    if (object.role === 'artwork' && activeMask) {
      const mask = piece.objects.find(
        (item) => item.id === piece.maskObjectId || item.role === 'clipping-mask'
      )
      if (mask)
        return (
          <MaskedArtwork
            artwork={transform}
            mask={mask}
            src={piece.artwork.previewUrl || piece.previewUrl}
            width={piece.widthCm}
            height={piece.heightCm}
          />
        )
    }

    return (
      <div
        className={`absolute cursor-move ${interactionClass} ${ring}`}
        style={commonStyle}
        {...handlers}
      >
        <img
          src={piece.artwork.previewUrl || piece.previewUrl}
          alt={object.name}
          draggable={false}
          className="pointer-events-none absolute inset-0 size-full select-none object-fill"
        />
      </div>
    )
  }
  return (
    <div
      className={`pointer-events-none absolute cursor-move ${ring}`}
      style={commonStyle}
      {...handlers}
    >
      <svg
        className="pointer-events-none size-full overflow-visible"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        aria-label={object.name}
      >
        <path
          d={getNormalizedShapePath(object, transform.widthCm, transform.heightCm)}
          fill={object.role === 'helper' && object.fillColor !== 'none' ? 'transparent' : 'none'}
          stroke="transparent"
          strokeWidth={Math.max(6, ((object.strokeWidthPt ?? 0.25) * scale * 2.54) / 72)}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: selectable ? 'visiblePainted' : 'none' }}
        />
        <path
          d={getNormalizedShapePath(object, transform.widthCm, transform.heightCm)}
          fill={object.role === 'helper' ? (object.fillColor ?? 'rgba(139,92,246,0.1)') : 'none'}
          stroke={object.strokeColor ?? '#8b5cf6'}
          strokeWidth={Math.max(0.5, ((object.strokeWidthPt ?? 0.25) * scale * 2.54) / 72)}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
})

function ShapePreview({
  shape,
  transform,
  scale
}: {
  shape: MaskShape
  transform: ArtworkTransform
  scale: number
}): JSX.Element {
  const editorShape = shape === 'custom-polygon' ? 'path' : shape === 'square' ? 'rectangle' : shape
  return (
    <div
      className={`pointer-events-none absolute z-30 border-2 border-dashed border-primary bg-primary/10 ${shapeClass(editorShape)}`}
      style={{
        left: transform.xCm * scale,
        top: transform.yCm * scale,
        width: transform.widthCm * scale,
        height: transform.heightCm * scale
      }}
    />
  )
}

function PenPathPreview({ points, scale }: { points: PenPoint[]; scale: number }): JSX.Element {
  return (
    <svg className="pointer-events-none absolute inset-0 z-40 size-full overflow-visible">
      <polyline
        points={points.map((point) => `${point.xCm * scale},${point.yCm * scale}`).join(' ')}
        fill="none"
        stroke="#7c3aed"
        strokeWidth="0.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function resizeBounds(
  bounds: ArtworkTransform,
  handle: TransformHandle,
  dx: number,
  dy: number,
  keepRatio: boolean,
  fromCenter: boolean
): ArtworkTransform {
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

function getBounds(objects: EditorObject[]): ArtworkTransform {
  if (objects.length === 0) return { xCm: 0, yCm: 0, widthCm: 0, heightCm: 0, rotation: 0 }
  const left = Math.min(...objects.map((object) => object.transform.xCm))
  const top = Math.min(...objects.map((object) => object.transform.yCm))
  const right = Math.max(
    ...objects.map((object) => object.transform.xCm + object.transform.widthCm)
  )
  const bottom = Math.max(
    ...objects.map((object) => object.transform.yCm + object.transform.heightCm)
  )
  return { xCm: left, yCm: top, widthCm: right - left, heightCm: bottom - top, rotation: 0 }
}

function getTransformObjects(piece: PiecePreset, selectedObjects: EditorObject[]): EditorObject[] {
  const selectedIds = new Set(selectedObjects.map((object) => object.id))
  const selectedGroupIds = new Set(
    selectedObjects
      .map((object) => object.groupId)
      .filter((groupId): groupId is string => Boolean(groupId))
  )
  return piece.objects.filter(
    (object) =>
      isSelectableLayerObject(piece, object) &&
      (selectedIds.has(object.id) ||
        Boolean(
          !piece.maskEditingEnabled && object.groupId && selectedGroupIds.has(object.groupId)
        ))
  )
}

function hasTransformChanges(objects: EditorObject[], piece: PiecePreset): boolean {
  const nextById = new Map(piece.objects.map((object) => [object.id, object]))
  return objects.some((object) => {
    const next = nextById.get(object.id)
    if (!next) return false
    return (
      Math.abs(next.transform.xCm - object.transform.xCm) > 0.0001 ||
      Math.abs(next.transform.yCm - object.transform.yCm) > 0.0001 ||
      Math.abs(next.transform.widthCm - object.transform.widthCm) > 0.0001 ||
      Math.abs(next.transform.heightCm - object.transform.heightCm) > 0.0001 ||
      Math.abs(next.transform.rotation - object.transform.rotation) > 0.0001
    )
  })
}

function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: ArtworkTransform
): boolean {
  return (
    a.x <= b.xCm + b.widthCm &&
    a.x + a.width >= b.xCm &&
    a.y <= b.yCm + b.heightCm &&
    a.y + a.height >= b.yCm
  )
}
function snap(value: number, targets: number[]): number {
  return targets.find((target) => Math.abs(value - target) <= 0.12) ?? value
}
function shapeClass(shape: string): string {
  return shape === 'ellipse' ? 'rounded-full' : shape === 'rounded-rectangle' ? 'rounded-md' : ''
}
function cloneObject(object: EditorObject): EditorObject {
  return { ...object, transform: { ...object.transform } }
}
function isShapeTool(tool: EditorTool): boolean {
  return tool === 'rectangle' || tool === 'rounded-rectangle' || tool === 'ellipse'
}
function createObjectId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
