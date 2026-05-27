import {
  AlignCenter,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalJustifyCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  Circle,
  Copy,
  Crosshair,
  Expand,
  LockKeyhole,
  Maximize,
  MousePointer2,
  Move,
  RotateCcw,
  Save,
  Square,
  UnlockKeyhole,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type {
  AlignmentCommand,
  CutlineShape,
  EditorObjectType,
  EditorTool,
  KeyObjectState,
  PiecePreset
} from '../types'
import { getPieceCutlineRect } from '../lib/cutlineGenerator'
import { syncPieceBounds } from '../lib/piecePresets'
import { formatCm } from '../lib/units'

interface PieceEditorProps {
  piece: PiecePreset | null
  selectedObjects: EditorObjectType[]
  keyObject: KeyObjectState
  onPieceChange: (piece: PiecePreset) => void
  onSelectedObjectsChange: (objects: EditorObjectType[]) => void
  onSetKeyObject: (object: EditorObjectType | null) => void
  onAlign: (command: AlignmentCommand) => void
  onCenterArtworkToCutline: () => void
  onCenterCutlineToArtwork: () => void
  onSave: () => void
  onDuplicate: () => void
}

export function PieceEditor({
  piece,
  selectedObjects,
  keyObject,
  onPieceChange,
  onSelectedObjectsChange,
  onSetKeyObject,
  onAlign,
  onCenterArtworkToCutline,
  onCenterCutlineToArtwork,
  onSave,
  onDuplicate
}: PieceEditorProps): JSX.Element {
  const [tool, setTool] = useState<EditorTool>('select')
  const [zoom, setZoom] = useState(1)
  const [lockRatio, setLockRatio] = useState(true)
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
  const cutlineRect = piece ? getPieceCutlineRect(piece.cutline) : null
  const scale = useMemo(() => (piece ? getPieceScale(piece, zoom) : 1), [piece, zoom])

  if (!piece) {
    return (
      <section className="grid min-h-[640px] place-items-center rounded-lg border bg-muted/30 p-8 text-center">
        <div className="max-w-md">
          <h3 className="text-lg font-semibold">No piece selected</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Import a design and click Edit to prepare artwork and cutline before montage.
          </p>
        </div>
      </section>
    )
  }

  const artworkSelected = selectedObjects.includes('artwork')
  const cutlineSelected = selectedObjects.includes('cutline')

  return (
    <section className="grid grid-cols-1 gap-4 rounded-lg border bg-slate-100 p-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Piece Editor</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {piece.displayName} · {formatCm(piece.widthCm)} x {formatCm(piece.heightCm)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ToolButton active={tool === 'select'} onClick={() => setTool('select')} label="Select" icon={MousePointer2} />
            <ToolButton active={tool === 'pan'} onClick={() => setTool('pan')} label="Pan" icon={Move} />
            <ToolButton active={tool === 'zoom'} onClick={() => setTool('zoom')} label="Zoom" icon={ZoomIn} />
            <Button type="button" size="sm" variant="outline" onClick={() => setZoom((value) => Math.min(value + 0.15, 2.5))}>
              <ZoomIn data-icon="inline-start" />
              Zoom
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setZoom((value) => Math.max(value - 0.15, 0.45))}>
              <ZoomOut data-icon="inline-start" />
              Zoom
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setZoom(1)}>
              <Maximize data-icon="inline-start" />
              Fit
            </Button>
          </div>
        </div>

        <div className="flex min-h-[560px] items-center justify-center overflow-visible rounded-lg border bg-[linear-gradient(0deg,rgba(148,163,184,0.20)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.20)_1px,transparent_1px)] bg-[length:24px_24px] p-8">
          <div
            className="relative bg-white shadow-md"
            style={{ width: piece.widthCm * scale, height: piece.heightCm * scale }}
          >
            <img
              src={piece.previewUrl}
              alt={piece.displayName}
              className={`absolute cursor-move object-fill ${artworkSelected ? 'ring-2 ring-primary' : 'ring-1 ring-slate-300'}`}
              style={{
                left: piece.artwork.transform.xCm * scale,
                top: piece.artwork.transform.yCm * scale,
                width: piece.artwork.transform.widthCm * scale,
                height: piece.artwork.transform.heightCm * scale,
                transform: `rotate(${piece.artwork.transform.rotation}deg)`
              }}
              draggable={false}
              onPointerDown={(event) => beginObjectDrag(event, 'artwork')}
              onPointerMove={moveObjectDrag}
              onPointerUp={endObjectDrag}
            />
            {cutlineRect && (
              <div
                className={`absolute cursor-move ${piece.cutline.shape === 'ellipse' ? 'rounded-full' : piece.cutline.shape === 'rounded-rectangle' ? 'rounded-md' : ''} ${
                  cutlineSelected ? 'ring-2 ring-primary' : ''
                }`}
                style={{
                  left: cutlineRect.xCm * scale,
                  top: cutlineRect.yCm * scale,
                  width: cutlineRect.widthCm * scale,
                  height: cutlineRect.heightCm * scale,
                  border: `1.5px solid ${piece.cutline.strokeColor}`,
                  transform: `rotate(${cutlineRect.rotation}deg)`
                }}
                onPointerDown={(event) => beginObjectDrag(event, 'cutline')}
                onPointerMove={moveObjectDrag}
                onPointerUp={endObjectDrag}
              />
            )}
            {keyObject.object && (
              <div className="pointer-events-none absolute right-2 top-2 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                Key: {keyObject.object}
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <Panel title="Selection">
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" size="sm" variant={artworkSelected && selectedObjects.length === 1 ? 'default' : 'outline'} onClick={() => onSelectedObjectsChange(['artwork'])}>
              Artwork
            </Button>
            <Button type="button" size="sm" variant={cutlineSelected && selectedObjects.length === 1 ? 'default' : 'outline'} onClick={() => onSelectedObjectsChange(['cutline'])}>
              Cutline
            </Button>
            <Button type="button" size="sm" variant={selectedObjects.length === 2 ? 'default' : 'outline'} onClick={() => onSelectedObjectsChange(['artwork', 'cutline'])}>
              Both
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant={keyObject.object === 'artwork' ? 'default' : 'outline'} onClick={() => onSetKeyObject('artwork')}>
              Key Artwork
            </Button>
            <Button type="button" size="sm" variant={keyObject.object === 'cutline' ? 'default' : 'outline'} onClick={() => onSetKeyObject('cutline')}>
              Key Cutline
            </Button>
          </div>
        </Panel>

        <Panel title="Alignment">
          <div className="grid grid-cols-3 gap-2">
            <IconButton label="Left" icon={AlignStartVertical} onClick={() => onAlign('left')} />
            <IconButton label="Center" icon={AlignCenter} onClick={() => onAlign('center-horizontal')} />
            <IconButton label="Right" icon={AlignEndVertical} onClick={() => onAlign('right')} />
            <IconButton label="Top" icon={AlignStartHorizontal} onClick={() => onAlign('top')} />
            <IconButton label="Middle" icon={AlignHorizontalJustifyCenter} onClick={() => onAlign('center-vertical')} />
            <IconButton label="Bottom" icon={AlignEndHorizontal} onClick={() => onAlign('bottom')} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onCenterArtworkToCutline}>
              <Crosshair data-icon="inline-start" />
              Center artwork to cutline
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCenterCutlineToArtwork}>
              <Crosshair data-icon="inline-start" />
              Center cutline to artwork
            </Button>
          </div>
        </Panel>

        <Panel title="Piece">
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width cm" value={piece.widthCm} step={0.1} onChange={(widthCm) => onPieceChange(resizePiece(piece, widthCm, piece.heightCm, lockRatio, 'width'))} />
            <NumberField label="Height cm" value={piece.heightCm} step={0.1} onChange={(heightCm) => onPieceChange(resizePiece(piece, piece.widthCm, heightCm, lockRatio, 'height'))} />
            <NumberField label="Qty" value={piece.quantity} step={1} onChange={(quantity) => onPieceChange({ ...piece, quantity: Math.max(1, Math.round(quantity)) })} />
            <NumberField label="Rotation" value={piece.artwork.transform.rotation} step={1} onChange={(rotation) => onPieceChange(updateArtwork(piece, { rotation }))} />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={lockRatio}
              onChange={(event) => setLockRatio(event.target.checked)}
            />
            Lock aspect ratio
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onPieceChange(resetTransforms(piece))}>
              <RotateCcw data-icon="inline-start" />
              Reset
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDuplicate}>
              <Copy data-icon="inline-start" />
              Duplicate
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onPieceChange({ ...piece, locked: !piece.locked })}>
              {piece.locked ? <LockKeyhole data-icon="inline-start" /> : <UnlockKeyhole data-icon="inline-start" />}
              {piece.locked ? 'Locked' : 'Unlocked'}
            </Button>
          </div>
        </Panel>

        <Panel title="Artwork Transform">
          <TransformFields
            x={piece.artwork.transform.xCm}
            y={piece.artwork.transform.yCm}
            width={piece.artwork.transform.widthCm}
            height={piece.artwork.transform.heightCm}
            onChange={(patch) => onPieceChange(updateArtwork(piece, patch))}
          />
        </Panel>

        <Panel title="Cutline">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant={piece.cutline.shape === 'rectangle' ? 'default' : 'outline'} onClick={() => onPieceChange(updateCutline(piece, { shape: 'rectangle' }))}>
              <Square data-icon="inline-start" />
              Rect
            </Button>
            <Button type="button" size="sm" variant={piece.cutline.shape === 'rounded-rectangle' ? 'default' : 'outline'} onClick={() => onPieceChange(updateCutline(piece, { shape: 'rounded-rectangle' }))}>
              <Expand data-icon="inline-start" />
              Rounded
            </Button>
            <Button type="button" size="sm" variant={piece.cutline.shape === 'ellipse' ? 'default' : 'outline'} onClick={() => onPieceChange(updateCutline(piece, { shape: 'ellipse' }))}>
              <Circle data-icon="inline-start" />
              Ellipse
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumberField label="X" value={piece.cutline.transform.xCm} step={0.1} onChange={(xCm) => onPieceChange(updateCutlineTransform(piece, { xCm }))} />
            <NumberField label="Y" value={piece.cutline.transform.yCm} step={0.1} onChange={(yCm) => onPieceChange(updateCutlineTransform(piece, { yCm }))} />
            <NumberField label="Width" value={piece.cutline.transform.widthCm} step={0.1} onChange={(widthCm) => onPieceChange(updateCutlineTransform(piece, { widthCm }))} />
            <NumberField label="Height" value={piece.cutline.transform.heightCm} step={0.1} onChange={(heightCm) => onPieceChange(updateCutlineTransform(piece, { heightCm }))} />
            <NumberField label="Offset mm" value={piece.cutline.transform.offsetMm} step={0.1} onChange={(offsetMm) => onPieceChange(updateCutlineTransform(piece, { offsetMm }))} />
            <NumberField label="Rotate" value={piece.cutline.transform.rotation} step={1} onChange={(rotation) => onPieceChange(updateCutlineTransform(piece, { rotation }))} />
          </div>
        </Panel>

        <Button type="button" onClick={onSave}>
          <Save data-icon="inline-start" />
          Save piece preset
        </Button>
      </aside>
    </section>
  )

  function beginObjectDrag(
    event: ReactPointerEvent<HTMLElement>,
    object: EditorObjectType
  ): void {
    if (tool !== 'select' || !piece) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onSelectedObjectsChange([object])
    const transform = object === 'artwork' ? piece.artwork.transform : piece.cutline.transform

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

    if (!piece || drag.object === null || drag.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    const nextX = drag.originX + (event.clientX - drag.startX) / scale
    const nextY = drag.originY + (event.clientY - drag.startY) / scale

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
}

function Panel({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function ToolButton({
  active,
  onClick,
  label,
  icon: Icon
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: typeof MousePointer2
}): JSX.Element {
  return (
    <Button type="button" size="sm" variant={active ? 'default' : 'outline'} onClick={onClick}>
      <Icon data-icon="inline-start" />
      {label}
    </Button>
  )
}

function IconButton({
  label,
  icon: Icon,
  onClick
}: {
  label: string
  icon: typeof AlignCenter
  onClick: () => void
}): JSX.Element {
  return (
    <Button type="button" size="icon" variant="outline" onClick={onClick} aria-label={label}>
      <Icon />
    </Button>
  )
}

function NumberField({
  label,
  value,
  step,
  onChange
}: {
  label: string
  value: number
  step: number
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        className="h-8 rounded border bg-background px-2 text-sm text-foreground"
        type="number"
        step={step}
        value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function TransformFields({
  x,
  y,
  width,
  height,
  onChange
}: {
  x: number
  y: number
  width: number
  height: number
  onChange: (patch: Partial<{ xCm: number; yCm: number; widthCm: number; heightCm: number }>) => void
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField label="X" value={x} step={0.1} onChange={(xCm) => onChange({ xCm })} />
      <NumberField label="Y" value={y} step={0.1} onChange={(yCm) => onChange({ yCm })} />
      <NumberField label="Width" value={width} step={0.1} onChange={(widthCm) => onChange({ widthCm })} />
      <NumberField label="Height" value={height} step={0.1} onChange={(heightCm) => onChange({ heightCm })} />
    </div>
  )
}

function getPieceScale(piece: PiecePreset, zoom: number): number {
  return Math.max(16, Math.min(360 / Math.max(piece.widthCm, piece.heightCm), 64)) * zoom
}

function resizePiece(
  piece: PiecePreset,
  widthCm: number,
  heightCm: number,
  lockRatio: boolean,
  sourceAxis: 'width' | 'height'
): PiecePreset {
  const nextWidth = Math.max(widthCm, 0.5)
  const nextHeight = Math.max(heightCm, 0.5)
  const ratio = piece.heightCm / piece.widthCm
  const finalWidth = lockRatio && sourceAxis === 'height' ? nextHeight / ratio : nextWidth
  const finalHeight = lockRatio && sourceAxis === 'width' ? nextWidth * ratio : nextHeight

  return syncPieceBounds(piece, finalWidth, finalHeight)
}

function updateArtwork(
  piece: PiecePreset,
  patch: Partial<PiecePreset['artwork']['transform']>
): PiecePreset {
  return {
    ...piece,
    artwork: {
      ...piece.artwork,
      transform: { ...piece.artwork.transform, ...patch }
    }
  }
}

function updateCutline(
  piece: PiecePreset,
  patch: Partial<PiecePreset['cutline']>
): PiecePreset {
  return {
    ...piece,
    cutline: { ...piece.cutline, ...patch }
  }
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

function resetTransforms(piece: PiecePreset): PiecePreset {
  return {
    ...piece,
    artwork: {
      ...piece.artwork,
      transform: {
        xCm: 0,
        yCm: 0,
        widthCm: piece.widthCm,
        heightCm: piece.heightCm,
        rotation: 0
      }
    },
    cutline: {
      ...piece.cutline,
      transform: {
        xCm: 0,
        yCm: 0,
        widthCm: piece.widthCm,
        heightCm: piece.heightCm,
        rotation: 0,
        offsetMm: piece.cutline.transform.offsetMm
      }
    }
  }
}

function moveEditorObject(
  piece: PiecePreset,
  object: EditorObjectType,
  xCm: number,
  yCm: number
): PiecePreset {
  if (object === 'artwork') {
    return updateArtwork(piece, { xCm, yCm })
  }

  return updateCutlineTransform(piece, { xCm, yCm })
}
