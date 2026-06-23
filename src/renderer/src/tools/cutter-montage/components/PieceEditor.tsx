import { Save, Scissors } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import type {
  AlignmentCommand,
  EditorObject,
  EditorObjectType,
  KeyObjectState,
  PiecePreset
} from '../types'
import {
  alignEditorObjects,
  centerObjectInside,
  convertObjectToCutline,
  duplicateObjectAsCutline,
  makeClippingMaskFromSelection,
  matchObjectGeometry,
  releaseClippingMask,
  setObjectGroup
} from '../lib/editorObjects'
import { syncLegacyFieldsFromObjects } from '../lib/pieceModelSync'
import { syncPieceBounds } from '../lib/piecePresets'
import { formatCm } from '../lib/units'
import { usePieceEditorClipboard } from '../hooks/usePieceEditorClipboard'
import { usePieceEditorHistory } from '../hooks/usePieceEditorHistory'
import { usePieceEditorSelection } from '../hooks/usePieceEditorSelection'
import { usePieceEditorShortcuts } from '../hooks/usePieceEditorShortcuts'
import { usePieceEditorState } from '../hooks/usePieceEditorState'
import { usePieceEditorTransforms } from '../hooks/usePieceEditorTransforms'
import { AlignmentToolbar } from './AlignmentToolbar'
import { ObjectLayerPanel } from './ObjectLayerPanel'
import { PieceEditorCanvas } from './PieceEditorCanvas'
import {
  PieceEditorContextMenu,
  type PieceEditorContextMenuState
} from './PieceEditorContextMenu'
import { PieceEditorPropertiesPanel } from './piece-editor/PieceEditorPropertiesPanel'
import { PieceEditorShortcuts } from './piece-editor/PieceEditorShortcuts'
import { PieceEditorStatusBar } from './piece-editor/PieceEditorStatusBar'
import { PieceEditorToolbar } from './piece-editor/PieceEditorToolbar'

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

export function PieceEditor(props: PieceEditorProps): JSX.Element {
  if (!props.piece) {
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

  return <ActivePieceEditor {...props} piece={props.piece} />
}

function ActivePieceEditor({
  piece,
  onPieceChange,
  onSelectedObjectsChange,
  onSetKeyObject,
  onSave,
  onDuplicate
}: PieceEditorProps & { piece: PiecePreset }): JSX.Element {
  const editorState = usePieceEditorState()
  const history = usePieceEditorHistory(piece, onPieceChange)
  const clipboard = usePieceEditorClipboard()
  const transforms = usePieceEditorTransforms()
  const selection = usePieceEditorSelection(
    piece,
    onPieceChange,
    onSelectedObjectsChange,
    onSetKeyObject
  )
  const scale = useMemo(() => getPieceScale(piece, editorState.zoom), [editorState.zoom, piece])
  const selectedObjects = useMemo(
    () => piece.objects.filter((object) => piece.selectedObjectIds.includes(object.id)),
    [piece.objects, piece.selectedObjectIds]
  )
  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : undefined
  const selectedShape = [...selectedObjects].reverse().find(
    (object) => object.shapeType !== 'image' &&
      (object.role === 'helper' || object.role === 'clipping-mask')
  )

  const handleKeyDown = usePieceEditorShortcuts({
    clearSelection: () => {
      selection.selectIds([])
      editorState.setTool('select')
      editorState.setContextMenu(null)
    },
    selectAll: () => selection.selectIds(piece.objects.map((object) => object.id)),
    copy: copySelection,
    paste: pasteSelection,
    duplicate: duplicateSelection,
    duplicateAsCutline,
    deleteSelection,
    nudge: nudgeSelection,
    group: setGroup,
    makeClippingMask,
    releaseClippingMask: releaseMask,
    undo: history.undo,
    redo: history.redo,
    setZoom: editorState.setZoom,
    resetZoom: () => editorState.setZoom(1)
  })

  return (
    <section
      className="grid grid-cols-1 gap-4 rounded-lg border bg-slate-100 p-4 outline-none xl:grid-cols-[minmax(0,1fr)_360px]"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Piece Editor</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {piece.displayName} · {formatCm(piece.widthCm)} x {formatCm(piece.heightCm)}
            </p>
          </div>
          <PieceEditorToolbar
            tool={editorState.tool}
            showGrid={editorState.showGrid}
            snapToGrid={editorState.snapToGrid}
            smartGuides={editorState.smartGuides}
            onToolChange={editorState.setTool}
            onZoomIn={() => editorState.setZoom((value) => Math.min(value + 0.15, 2.5))}
            onZoomOut={() => editorState.setZoom((value) => Math.max(value - 0.15, 0.45))}
            onFit={() => editorState.setZoom(1)}
            onShowGridChange={editorState.setShowGrid}
            onSnapToGridChange={editorState.setSnapToGrid}
            onSmartGuidesChange={editorState.setSmartGuides}
          />
        </div>

        <PieceEditorCanvas
          piece={piece}
          scale={scale}
          tool={editorState.tool}
          showGrid={editorState.showGrid}
          snapToGrid={editorState.snapToGrid}
          smartGuides={editorState.smartGuides}
          onPieceChange={onPieceChange}
          onTransformStart={history.checkpoint}
          onSelectObject={selection.toggleId}
          onSelectIds={selection.selectIds}
          onContextMenuOpen={(x, y) => editorState.setContextMenu({ x, y })}
        />
        <PieceEditorStatusBar piece={piece} />
        <div className="mt-2 flex items-center justify-between gap-3">
          <PieceEditorShortcuts />
          <span className="text-[11px] text-muted-foreground">
            {history.canUndo ? 'Undo ready' : 'No undo'} · {history.canRedo ? 'Redo ready' : 'No redo'}
          </span>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <ObjectLayerPanel
          piece={piece}
          onSelectObject={selection.toggleId}
          onToggleVisibility={toggleVisibility}
          onToggleLock={toggleLock}
          onSetKeyObject={selection.setKeyObjectId}
          onDeleteObject={(objectId) => deleteObjects([objectId])}
        />

        <AlignmentToolbar
          piece={piece}
          onSelectIds={selection.selectIds}
          onSetKeyObject={selection.setKeyObjectId}
          onAlign={alignSelection}
          onCenterArtworkToMask={() => center(piece.artworkObjectId, piece.maskObjectId)}
          onCenterArtworkToCutline={() => center(piece.artworkObjectId, piece.cutlineObjectId)}
          onCenterCutlineToMask={() => center(piece.cutlineObjectId, piece.maskObjectId)}
          onMatchCutlineToMask={() => match(piece.cutlineObjectId, piece.maskObjectId)}
          onMatchMaskToCutline={() => match(piece.maskObjectId, piece.cutlineObjectId)}
        />

        <WorkflowPanel
          piece={piece}
          selectedShape={selectedShape}
          onMakeMask={makeClippingMask}
          onReleaseMask={releaseMask}
          onConvertToCutline={convertToCutline}
          onDuplicateAsCutline={duplicateAsCutline}
          onGroup={() => setGroup(true)}
          onUngroup={() => setGroup(false)}
        />

        <PieceEditorPropertiesPanel
          piece={piece}
          selectedObject={selectedObject}
          onPieceSizeChange={(widthCm, heightCm, source) =>
            history.commit(resizePiece(piece, widthCm, heightCm, source))
          }
          onQuantityChange={(quantity) => history.commit({
            ...piece,
            quantity: Math.max(1, Math.round(quantity))
          })}
          onAspectLockChange={(lockAspectRatio) => history.commit({ ...piece, lockAspectRatio })}
          onObjectTransformChange={(objectId, patch) =>
            history.commit(transforms.updateTransform(piece, objectId, patch))
          }
          onReset={() => history.commit(resetTransforms(piece))}
          onDuplicatePiece={onDuplicate}
          onPieceLockChange={(locked) => history.commit({ ...piece, locked })}
          onGroupChange={setGroup}
        />

        <Button type="button" onClick={onSave}>
          <Save data-icon="inline-start" />Save piece preset
        </Button>
      </aside>

      <PieceEditorContextMenu
        state={editorState.contextMenu as PieceEditorContextMenuState | null}
        piece={piece}
        hasClipboard={clipboard.hasClipboard}
        onClose={() => editorState.setContextMenu(null)}
        onCopy={() => runMenuAction(copySelection)}
        onPaste={() => runMenuAction(() => pasteSelection(false))}
        onPasteInPlace={() => runMenuAction(() => pasteSelection(true))}
        onDuplicate={() => runMenuAction(duplicateSelection)}
        onDelete={() => runMenuAction(deleteSelection)}
        onLock={(locked) => runMenuAction(() => setSelectionLock(locked))}
        onGroup={(grouped) => runMenuAction(() => setGroup(grouped))}
        onMakeClippingMask={() => runMenuAction(makeClippingMask)}
        onReleaseClippingMask={() => runMenuAction(releaseMask)}
        onCreateCutlineFromMask={() => runMenuAction(duplicateMaskAsCutline)}
        onConvertToCutContour={() => runMenuAction(convertToCutline)}
        onDuplicateAsCutline={() => runMenuAction(duplicateAsCutline)}
        onAlign={(command) => runMenuAction(() => alignSelection(command))}
        onSetKeyObject={(objectId) => runMenuAction(() => selection.setKeyObjectId(objectId))}
      />
    </section>
  )

  function runMenuAction(action: () => void): void {
    action()
    editorState.setContextMenu(null)
  }

  function copySelection(): void {
    clipboard.copy(piece)
  }

  function pasteSelection(inPlace: boolean): void {
    const next = clipboard.paste(piece, inPlace)
    if (next) history.commit(next)
  }

  function duplicateSelection(): void {
    const next = clipboard.duplicate(piece)
    if (next) history.commit(next)
  }

  function deleteSelection(): void {
    deleteObjects(piece.selectedObjectIds)
  }

  function deleteObjects(ids: string[]): void {
    const deleting = new Set(ids)
    const objects = piece.objects.filter(
      (object) => !deleting.has(object.id) || object.role === 'artwork'
    )
    if (objects.length === piece.objects.length) return
    const nextCutline = objects.find((object) => object.role === 'cutline')
    const maskDeleted = Boolean(piece.maskObjectId && deleting.has(piece.maskObjectId))
    history.commit(syncLegacyFieldsFromObjects({
      ...piece,
      objects,
      maskObjectId: maskDeleted ? undefined : piece.maskObjectId,
      clippingMaskEnabled: maskDeleted ? false : piece.clippingMaskEnabled,
      cutlineObjectId: piece.cutlineObjectId && deleting.has(piece.cutlineObjectId)
        ? nextCutline?.id
        : piece.cutlineObjectId,
      selectedObjectIds: piece.selectedObjectIds.filter((id) => !deleting.has(id)),
      keyObjectId: piece.keyObjectId && deleting.has(piece.keyObjectId)
        ? undefined
        : piece.keyObjectId
    }))
  }

  function toggleVisibility(objectId: string): void {
    history.commit(syncLegacyFieldsFromObjects({
      ...piece,
      objects: piece.objects.map((object) => object.id === objectId
        ? { ...object, visible: !object.visible }
        : object)
    }))
  }

  function toggleLock(objectId: string): void {
    history.commit(syncLegacyFieldsFromObjects({
      ...piece,
      objects: piece.objects.map((object) => object.id === objectId
        ? { ...object, locked: !object.locked }
        : object)
    }))
  }

  function setSelectionLock(locked: boolean): void {
    history.commit(transforms.setSelectionLock(piece, locked))
  }

  function makeClippingMask(): void {
    const next = makeClippingMaskFromSelection(piece)
    if (next !== piece) history.commit(next)
  }

  function releaseMask(): void {
    const next = releaseClippingMask(piece)
    if (next !== piece) history.commit(next)
  }

  function duplicateMaskAsCutline(): void {
    if (!piece.maskObjectId) return
    history.commit(duplicateObjectAsCutline(piece, piece.maskObjectId))
  }

  function duplicateAsCutline(): void {
    if (!selectedShape) return
    history.commit(duplicateObjectAsCutline(piece, selectedShape.id))
  }

  function convertToCutline(): void {
    if (!selectedShape) return
    history.commit(convertObjectToCutline(piece, selectedShape.id))
  }

  function alignSelection(command: AlignmentCommand): void {
    if (!piece.keyObjectId || piece.selectedObjectIds.length < 2) return
    history.commit(syncLegacyFieldsFromObjects({
      ...piece,
      objects: alignEditorObjects(
        piece.objects,
        piece.selectedObjectIds,
        piece.keyObjectId,
        command
      )
    }))
  }

  function center(targetId: string | undefined, containerId: string | undefined): void {
    const next = centerObjectInside(piece, targetId, containerId)
    if (next !== piece) history.commit(next)
  }

  function match(targetId: string | undefined, sourceId: string | undefined): void {
    const next = matchObjectGeometry(piece, targetId, sourceId)
    if (next !== piece) history.commit(next)
  }

  function setGroup(grouped: boolean): void {
    const next = setObjectGroup(piece, piece.selectedObjectIds, grouped)
    if (next !== piece) history.commit(next)
  }

  function nudgeSelection(dxCm: number, dyCm: number): void {
    if (piece.selectedObjectIds.length === 0) return
    history.commit(transforms.moveSelection(piece, dxCm, dyCm))
  }
}

function WorkflowPanel({
  piece,
  selectedShape,
  onMakeMask,
  onReleaseMask,
  onConvertToCutline,
  onDuplicateAsCutline,
  onGroup,
  onUngroup
}: {
  piece: PiecePreset
  selectedShape?: EditorObject
  onMakeMask: () => void
  onReleaseMask: () => void
  onConvertToCutline: () => void
  onDuplicateAsCutline: () => void
  onGroup: () => void
  onUngroup: () => void
}): JSX.Element {
  const selected = piece.objects.filter((object) => piece.selectedObjectIds.includes(object.id))
  const canMakeMask = selected.some((object) => object.role === 'artwork') && Boolean(selectedShape)
  return (
    <section className="rounded-lg border bg-card p-3">
      <h4 className="text-sm font-semibold">Object workflow</h4>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!canMakeMask} onClick={onMakeMask}>Make Clipping Mask</Button>
        <Button type="button" size="sm" variant="outline" disabled={!piece.clippingMaskEnabled} onClick={onReleaseMask}>Release Clipping Mask</Button>
        <Button type="button" size="sm" variant="outline" disabled={!selectedShape} onClick={onDuplicateAsCutline}>
          <Scissors data-icon="inline-start" />Duplicate Shape as Cutline
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!selectedShape} onClick={onConvertToCutline}>Convert to CutContour</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" size="sm" variant="outline" disabled={piece.selectedObjectIds.length < 2} onClick={onGroup}>Group / link</Button>
          <Button type="button" size="sm" variant="outline" disabled={!selected.some((object) => object.groupId)} onClick={onUngroup}>Ungroup</Button>
        </div>
      </div>
    </section>
  )
}

function getPieceScale(piece: PiecePreset, zoom: number): number {
  return Math.max(16, Math.min(360 / Math.max(piece.widthCm, piece.heightCm), 64)) * zoom
}

function resizePiece(
  piece: PiecePreset,
  widthCm: number,
  heightCm: number,
  sourceAxis: 'width' | 'height'
): PiecePreset {
  const nextWidth = Math.max(widthCm, 0.5)
  const nextHeight = Math.max(heightCm, 0.5)
  const ratio = piece.heightCm / piece.widthCm
  const finalWidth = piece.lockAspectRatio && sourceAxis === 'height' ? nextHeight / ratio : nextWidth
  const finalHeight = piece.lockAspectRatio && sourceAxis === 'width' ? nextWidth * ratio : nextHeight
  return syncPieceBounds(piece, finalWidth, finalHeight)
}

function resetTransforms(piece: PiecePreset): PiecePreset {
  const primaryIds = new Set([piece.artworkObjectId, piece.maskObjectId, piece.cutlineObjectId])
  return syncLegacyFieldsFromObjects({
    ...piece,
    objects: piece.objects.map((object) => primaryIds.has(object.id)
      ? {
          ...object,
          transform: {
            ...object.transform,
            xCm: 0,
            yCm: 0,
            widthCm: piece.widthCm,
            heightCm: piece.heightCm,
            rotation: 0
          }
        }
      : object)
  })
}
