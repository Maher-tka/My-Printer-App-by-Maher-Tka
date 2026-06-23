import {
  Copy,
  Circle,
  LockKeyhole,
  Maximize,
  MousePointer2,
  Move,
  RectangleHorizontal,
  RotateCcw,
  Save,
  Square,
  UnlockKeyhole,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from 'react'
import { Button } from '@/components/ui/button'
import type {
  ArtworkTransform,
  CutlineShape,
  EditorObjectType,
  EditorTool,
  KeyObjectState,
  MaskShape,
  PiecePreset
} from '../types'
import {
  alignPieceObjects,
  centerArtworkToCutline,
  centerCutlineToArtwork
} from '../lib/alignmentUtils'
import {
  createCutlineFromHelper,
  createCutlineFromMask,
  createHelperShape,
  makeClippingMaskFromHelper,
  matchCutlineToMask,
  matchMaskToCutline,
  releaseClippingMaskToHelper,
  toggleArtworkCutlineGroup
} from '../lib/maskUtils'
import { syncPieceBounds } from '../lib/piecePresets'
import { formatCm } from '../lib/units'
import { AlignmentToolbar } from './AlignmentToolbar'
import { CutlineToolsPanel } from './CutlineToolsPanel'
import { MaskToolsPanel } from './MaskToolsPanel'
import { ObjectLayerPanel } from './ObjectLayerPanel'
import {
  PieceEditorContextMenu,
  type PieceEditorContextMenuState
} from './PieceEditorContextMenu'
import { PieceEditorCanvas } from './PieceEditorCanvas'

interface PieceEditorProps {
  piece: PiecePreset | null
  selectedObjects: EditorObjectType[]
  keyObject: KeyObjectState
  onPieceChange: (piece: PiecePreset) => void
  onSelectedObjectsChange: (objects: EditorObjectType[]) => void
  onSetKeyObject: (object: EditorObjectType | null) => void
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
  onSave,
  onDuplicate
}: PieceEditorProps): JSX.Element {
  const [tool, setTool] = useState<EditorTool>('select')
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [smartGuides, setSmartGuides] = useState(true)
  const [contextMenu, setContextMenu] = useState<PieceEditorContextMenuState | null>(null)
  const [clipboard, setClipboard] = useState<ClipboardObject | null>(null)
  const [past, setPast] = useState<PiecePreset[]>([])
  const [future, setFuture] = useState<PiecePreset[]>([])
  const currentPieceId = piece?.id ?? null
  const lastPieceIdRef = useRef<string | null>(currentPieceId)
  const scale = useMemo(() => (piece ? getPieceScale(piece, zoom) : 1), [piece, zoom])

  useEffect(() => {
    if (currentPieceId !== lastPieceIdRef.current) {
      lastPieceIdRef.current = currentPieceId
      setPast([])
      setFuture([])
      setContextMenu(null)
    }
  }, [currentPieceId])

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

  const activePiece = piece

  return (
    <section
      className="grid grid-cols-1 gap-4 rounded-lg border bg-slate-100 p-4 outline-none xl:grid-cols-[minmax(0,1fr)_340px]"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Piece Editor</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activePiece.displayName} · {formatCm(activePiece.widthCm)} x {formatCm(activePiece.heightCm)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ToolButton active={tool === 'select'} onClick={() => setTool('select')} label="Select" icon={MousePointer2} />
            <ToolButton active={tool === 'pan'} onClick={() => setTool('pan')} label="Pan" icon={Move} />
            <ToolButton active={tool === 'zoom'} onClick={() => setTool('zoom')} label="Zoom" icon={ZoomIn} />
            <ToolButton active={tool === 'rectangle'} onClick={() => setTool('rectangle')} label="Rect" icon={RectangleHorizontal} />
            <ToolButton active={tool === 'rounded-rectangle'} onClick={() => setTool('rounded-rectangle')} label="Round" icon={Square} />
            <ToolButton active={tool === 'ellipse'} onClick={() => setTool('ellipse')} label="Ellipse" icon={Circle} />
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
            <Toggle label="Grid" checked={showGrid} onChange={setShowGrid} />
            <Toggle label="Snap" checked={snapToGrid} onChange={setSnapToGrid} />
            <Toggle label="Smart" checked={smartGuides} onChange={setSmartGuides} />
          </div>
        </div>

        <PieceEditorCanvas
          piece={activePiece}
          scale={scale}
          tool={tool}
          selectedObjects={selectedObjects}
          keyObject={keyObject}
          showGrid={showGrid}
          snapToGrid={snapToGrid}
          smartGuides={smartGuides}
          onPieceChange={commitPiece}
          onSelectedObjectsChange={onSelectedObjectsChange}
          onContextMenuOpen={(x, y) => setContextMenu({ x, y })}
        />
      </div>

      <aside className="flex flex-col gap-4">
        <ObjectLayerPanel
          piece={activePiece}
          selectedObjects={selectedObjects}
          keyObject={keyObject}
          onPieceChange={commitPiece}
          onSelectedObjectsChange={onSelectedObjectsChange}
        />

        <AlignmentToolbar
          selectedObjects={selectedObjects}
          keyObject={keyObject}
          onSelectedObjectsChange={onSelectedObjectsChange}
          onSetKeyObject={onSetKeyObject}
          onAlign={(command) => commitPiece(alignPieceObjects(activePiece, selectedObjects, keyObject, command))}
          onCenterArtworkToCutline={() => commitPiece(centerArtworkToCutline(activePiece))}
          onCenterCutlineToArtwork={() => commitPiece(centerCutlineToArtwork(activePiece))}
          onMatchCutlineToMask={() => commitPiece(matchCutlineToMask(activePiece))}
          onMatchMaskToCutline={() => commitPiece(matchMaskToCutline(activePiece))}
        />

        <Panel title="Piece">
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width cm" value={activePiece.widthCm} step={0.1} onChange={(widthCm) => commitPiece(resizePiece(activePiece, widthCm, activePiece.heightCm, activePiece.lockAspectRatio, 'width'))} />
            <NumberField label="Height cm" value={activePiece.heightCm} step={0.1} onChange={(heightCm) => commitPiece(resizePiece(activePiece, activePiece.widthCm, heightCm, activePiece.lockAspectRatio, 'height'))} />
            <NumberField label="Qty" value={activePiece.quantity} step={1} onChange={(quantity) => commitPiece({ ...activePiece, quantity: Math.max(1, Math.round(quantity)) })} />
            <NumberField label="Rotation" value={activePiece.artwork.transform.rotation} step={1} onChange={(rotation) => commitPiece(updateArtwork(activePiece, { rotation }))} />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={activePiece.lockAspectRatio}
              onChange={(event) => commitPiece({ ...activePiece, lockAspectRatio: event.target.checked })}
            />
            Lock aspect ratio
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => commitPiece(resetTransforms(activePiece))}>
              <RotateCcw data-icon="inline-start" />
              Reset
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDuplicate}>
              <Copy data-icon="inline-start" />
              Duplicate
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => commitPiece({ ...activePiece, locked: !activePiece.locked })}>
              {activePiece.locked ? <LockKeyhole data-icon="inline-start" /> : <UnlockKeyhole data-icon="inline-start" />}
              {activePiece.locked ? 'Locked' : 'Unlocked'}
            </Button>
            <Button type="button" size="sm" variant={activePiece.artworkCutlineGrouped ? 'default' : 'outline'} onClick={() => commitPiece(toggleArtworkCutlineGroup(activePiece))}>
              {activePiece.artworkCutlineGrouped ? 'Linked transforms' : 'Edit independently'}
            </Button>
          </div>
        </Panel>

        <Panel title="Artwork Transform">
          <TransformFields
            x={activePiece.artwork.transform.xCm}
            y={activePiece.artwork.transform.yCm}
            width={activePiece.artwork.transform.widthCm}
            height={activePiece.artwork.transform.heightCm}
            onChange={(patch) => commitPiece(updateArtwork(activePiece, patch))}
          />
        </Panel>

        <MaskToolsPanel
          piece={activePiece}
          onPieceChange={commitPiece}
          onCreateCutlineFromMask={() => commitPiece(createCutlineFromMask(activePiece))}
        />

        <CutlineToolsPanel
          piece={activePiece}
          onPieceChange={commitPiece}
          onDuplicateShapeAsCutline={() => duplicateAsCutline()}
        />

        <Button type="button" onClick={onSave}>
          <Save data-icon="inline-start" />
          Save piece preset
        </Button>
      </aside>
      <PieceEditorContextMenu
        state={contextMenu}
        piece={activePiece}
        selectedObjects={selectedObjects}
        onClose={() => setContextMenu(null)}
        onCopy={() => runMenuAction(copySelection)}
        onPaste={() => runMenuAction(() => pasteSelection(false))}
        onPasteInPlace={() => runMenuAction(() => pasteSelection(true))}
        onDuplicate={() => runMenuAction(duplicateSelection)}
        onDelete={() => runMenuAction(deleteSelection)}
        onLock={() => runMenuAction(() => setSelectedLock(true))}
        onUnlock={() => runMenuAction(() => setSelectedLock(false))}
        onGroup={() => runMenuAction(() => commitPiece({ ...activePiece, artworkCutlineGrouped: true }))}
        onUngroup={() => runMenuAction(() => commitPiece({ ...activePiece, artworkCutlineGrouped: false }))}
        onMakeClippingMask={() => runMenuAction(makeClippingMask)}
        onReleaseClippingMask={() => runMenuAction(releaseClippingMask)}
        onCreateCutlineFromMask={() => runMenuAction(() => commitPiece(createCutlineFromMask(activePiece)))}
        onConvertToCutContour={() => runMenuAction(convertHelperToCutContour)}
        onDuplicateAsCutline={() => runMenuAction(duplicateAsCutline)}
        onCenterCutlineToArtwork={() => runMenuAction(() => commitPiece(centerCutlineToArtwork(activePiece)))}
        onCenterArtworkToCutline={() => runMenuAction(() => commitPiece(centerArtworkToCutline(activePiece)))}
        onAlign={(command) => runMenuAction(() => commitPiece(alignPieceObjects(activePiece, selectedObjects, keyObject, command)))}
        onSetKeyObject={(object) => runMenuAction(() => onSetKeyObject(object))}
      />
    </section>
  )

  function commitPiece(nextPiece: PiecePreset): void {
    setPast((current) => [...current.slice(-49), activePiece])
    setFuture([])
    onPieceChange(nextPiece)
  }

  function runMenuAction(action: () => void): void {
    action()
    setContextMenu(null)
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    const ctrl = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()

    if (!ctrl && key === 'v') {
      setTool('select')
      return
    }

    if (!ctrl && key === 'h') {
      setTool('pan')
      return
    }

    if (key === 'escape') {
      onSelectedObjectsChange([])
      setTool('select')
      setContextMenu(null)
      return
    }

    if (key === 'delete' || key === 'backspace') {
      event.preventDefault()
      deleteSelection()
      return
    }

    if (key.startsWith('arrow')) {
      event.preventDefault()
      nudgeSelection(event.shiftKey ? 0.5 : 0.1, key)
      return
    }

    if (!ctrl) {
      return
    }

    if (key === 'c' && event.shiftKey) {
      event.preventDefault()
      duplicateAsCutline()
    } else if (key === 'c') {
      event.preventDefault()
      copySelection()
    } else if (key === 'v') {
      event.preventDefault()
      pasteSelection(false)
    } else if (key === 'f') {
      event.preventDefault()
      pasteSelection(true)
    } else if (key === 'd') {
      event.preventDefault()
      duplicateSelection()
    } else if (key === 'g' && event.shiftKey) {
      event.preventDefault()
      commitPiece({ ...activePiece, artworkCutlineGrouped: false })
    } else if (key === 'g') {
      event.preventDefault()
      commitPiece({ ...activePiece, artworkCutlineGrouped: true })
    } else if (key === 'a') {
      event.preventDefault()
      onSelectedObjectsChange(['artwork', 'mask', 'cutline', ...(activePiece.helperShape ? ['helper-shape' as const] : [])])
    } else if (key === 'z' && event.shiftKey) {
      event.preventDefault()
      redo()
    } else if (key === 'z') {
      event.preventDefault()
      undo()
    } else if (key === 'y') {
      event.preventDefault()
      redo()
    } else if (key === '7' && event.altKey) {
      event.preventDefault()
      releaseClippingMask()
    } else if (key === '7') {
      event.preventDefault()
      makeClippingMask()
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      setZoom((value) => Math.min(value + 0.15, 2.5))
    } else if (event.key === '-') {
      event.preventDefault()
      setZoom((value) => Math.max(value - 0.15, 0.45))
    } else if (key === '0') {
      event.preventDefault()
      setZoom(1)
    } else if (key === '1') {
      event.preventDefault()
      setZoom(1)
    }
  }

  function copySelection(): void {
    const object = selectedObjects[0]

    if (!object) {
      return
    }

    setClipboard(getClipboardObject(activePiece, object))
  }

  function pasteSelection(inPlace: boolean): void {
    if (!clipboard) {
      return
    }

    const offset = inPlace ? 0 : 0.4
    const transform = {
      ...clipboard.transform,
      xCm: clipboard.transform.xCm + offset,
      yCm: clipboard.transform.yCm + offset
    }

    if (clipboard.object === 'artwork') {
      commitPiece(updateArtwork(activePiece, transform))
      onSelectedObjectsChange(['artwork'])
      return
    }

    commitPiece({
      ...activePiece,
      helperShape: createHelperShape(clipboard.shape ?? 'rectangle', transform)
    })
    onSelectedObjectsChange(['helper-shape'])
  }

  function duplicateSelection(): void {
    copySelection()
    const object = selectedObjects[0]
    const copied = object ? getClipboardObject(activePiece, object) : clipboard

    if (!copied) {
      return
    }

    setClipboard(copied)
    const transform = {
      ...copied.transform,
      xCm: copied.transform.xCm + 0.4,
      yCm: copied.transform.yCm + 0.4
    }

    if (copied.object === 'artwork') {
      commitPiece(updateArtwork(activePiece, transform))
      onSelectedObjectsChange(['artwork'])
      return
    }

    commitPiece({
      ...activePiece,
      helperShape: createHelperShape(copied.shape ?? 'rectangle', transform)
    })
    onSelectedObjectsChange(['helper-shape'])
  }

  function deleteSelection(): void {
    const object = selectedObjects[0]

    if (object === 'helper-shape') {
      commitPiece({ ...activePiece, helperShape: undefined })
      onSelectedObjectsChange([])
    } else if (object === 'mask') {
      commitPiece({ ...activePiece, mask: { ...activePiece.mask, enabled: false } })
      onSelectedObjectsChange(['artwork'])
    } else if (object === 'cutline') {
      commitPiece({
        ...activePiece,
        objectVisibility: { ...activePiece.objectVisibility, cutline: false }
      })
      onSelectedObjectsChange(['artwork'])
    }
  }

  function setSelectedLock(locked: boolean): void {
    const object = selectedObjects[0]

    if (!object) {
      return
    }

    commitPiece({
      ...activePiece,
      objectLocks: {
        ...activePiece.objectLocks,
        [object === 'helper-shape' ? 'helper' : object]: locked
      },
      helperShape:
        object === 'helper-shape' && activePiece.helperShape
          ? { ...activePiece.helperShape, locked }
          : activePiece.helperShape
    })
  }

  function makeClippingMask(): void {
    commitPiece(makeClippingMaskFromHelper(activePiece))
    onSelectedObjectsChange(['mask'])
  }

  function releaseClippingMask(): void {
    commitPiece(releaseClippingMaskToHelper(activePiece))
    onSelectedObjectsChange(['helper-shape'])
  }

  function convertHelperToCutContour(): void {
    if (!activePiece.helperShape) {
      return
    }

    commitPiece(createCutlineFromHelper(activePiece))
    onSelectedObjectsChange(['cutline'])
  }

  function duplicateAsCutline(): void {
    if (selectedObjects.includes('helper-shape')) {
      convertHelperToCutContour()
      return
    }

    if (selectedObjects.includes('mask') || activePiece.mask.enabled) {
      commitPiece(createCutlineFromMask(activePiece))
      onSelectedObjectsChange(['cutline'])
    }
  }

  function nudgeSelection(step: number, key: string): void {
    const object = selectedObjects[0]

    if (!object) {
      return
    }

    const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0
    const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0
    commitPiece(moveObject(activePiece, object, dx, dy))
  }

  function undo(): void {
    const previous = past[past.length - 1]

    if (!previous) {
      return
    }

    setPast((current) => current.slice(0, -1))
    setFuture((current) => [activePiece, ...current].slice(0, 50))
    onPieceChange(previous)
  }

  function redo(): void {
    const next = future[0]

    if (!next) {
      return
    }

    setFuture((current) => current.slice(1))
    setPast((current) => [...current.slice(-49), activePiece])
    onPieceChange(next)
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

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): JSX.Element {
  return (
    <label className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium text-muted-foreground">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
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

interface ClipboardObject {
  object: EditorObjectType
  transform: ArtworkTransform
  shape?: MaskShape
}

function getClipboardObject(piece: PiecePreset, object: EditorObjectType): ClipboardObject {
  if (object === 'artwork') {
    return {
      object,
      transform: { ...piece.artwork.transform }
    }
  }

  if (object === 'mask') {
    return {
      object,
      shape: piece.mask.shape,
      transform: { ...piece.mask.transform }
    }
  }

  if (object === 'helper-shape' && piece.helperShape) {
    return {
      object,
      shape: piece.helperShape.shape,
      transform: { ...piece.helperShape.transform }
    }
  }

  return {
    object: 'cutline',
    shape: cutlineShapeToMaskShape(piece.cutline.shape),
    transform: {
      xCm: piece.cutline.transform.xCm,
      yCm: piece.cutline.transform.yCm,
      widthCm: piece.cutline.transform.widthCm,
      heightCm: piece.cutline.transform.heightCm,
      rotation: piece.cutline.transform.rotation
    }
  }
}

function moveObject(
  piece: PiecePreset,
  object: EditorObjectType,
  dxCm: number,
  dyCm: number
): PiecePreset {
  if (object === 'artwork') {
    return updateArtwork(piece, {
      xCm: piece.artwork.transform.xCm + dxCm,
      yCm: piece.artwork.transform.yCm + dyCm
    })
  }

  if (object === 'mask') {
    return {
      ...piece,
      mask: {
        ...piece.mask,
        transform: {
          ...piece.mask.transform,
          xCm: piece.mask.transform.xCm + dxCm,
          yCm: piece.mask.transform.yCm + dyCm
        }
      }
    }
  }

  if (object === 'helper-shape' && piece.helperShape) {
    return {
      ...piece,
      helperShape: {
        ...piece.helperShape,
        transform: {
          ...piece.helperShape.transform,
          xCm: piece.helperShape.transform.xCm + dxCm,
          yCm: piece.helperShape.transform.yCm + dyCm
        }
      }
    }
  }

  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      transform: {
        ...piece.cutline.transform,
        xCm: piece.cutline.transform.xCm + dxCm,
        yCm: piece.cutline.transform.yCm + dyCm
      }
    }
  }
}

function cutlineShapeToMaskShape(shape: CutlineShape): MaskShape {
  if (shape === 'ellipse') {
    return 'ellipse'
  }

  if (shape === 'rounded-rectangle') {
    return 'rounded-rectangle'
  }

  return 'rectangle'
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
    mask: {
      ...piece.mask,
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
