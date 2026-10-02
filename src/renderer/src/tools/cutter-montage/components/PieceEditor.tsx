import { ArtworkBackgroundTools } from './ArtworkBackgroundTools'
import type { ArtworkEditResult } from '../lib/applyArtworkEdit'
import {
  createCutlineFromArtworkBounds,
  createCutlineFromMaskBounds
} from '../lib/cutlineValidation'
import { CutlineInspector } from './CutlineInspector'
import { reorderLayerObject, renameLayerObject, setMaskEditing } from '../lib/editorLayers'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Maximize2, Minimize2, Redo2, Save, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { AlignmentCommand, EditorObject, PiecePreset } from '../types'
import {
  alignEditorObjects,
  canMakeClippingMaskFromSelection,
  centerObjectInside,
  convertObjectToCutline,
  deleteEditorObjects,
  duplicateObjectAsCutline,
  getMaskSourceFromSelection,
  makeClippingMaskAndCutlineFromSelection,
  makeClippingMaskFromSelection,
  matchObjectGeometry,
  releaseClippingMask,
  setObjectGroup
} from '../lib/editorObjects'
import { syncLegacyFieldsFromObjects } from '../lib/pieceModelSync'
import { resizePiecePreset } from '../lib/piecePresets'
import { formatCm } from '../lib/units'
import { usePieceEditorClipboard } from '../hooks/usePieceEditorClipboard'
import { usePieceEditorHistory } from '../hooks/usePieceEditorHistory'
import { usePieceEditorSelection } from '../hooks/usePieceEditorSelection'
import { usePieceEditorShortcuts } from '../hooks/usePieceEditorShortcuts'
import { usePieceEditorState } from '../hooks/usePieceEditorState'
import { usePieceEditorTransforms } from '../hooks/usePieceEditorTransforms'
import { useCanvasFullscreen } from '../hooks/useCanvasFullscreen'
import { AlignmentToolbar } from './AlignmentToolbar'
import { ObjectLayerPanel } from './ObjectLayerPanel'
import { PieceEditorCanvas } from './PieceEditorCanvas'
import { PieceEditorContextMenu, type PieceEditorContextMenuState } from './PieceEditorContextMenu'
import { PieceEditorPropertiesPanel } from './piece-editor/PieceEditorPropertiesPanel'
import { PieceEditorShortcuts } from './piece-editor/PieceEditorShortcuts'
import { PieceEditorStatusBar } from './piece-editor/PieceEditorStatusBar'
import { PieceEditorToolbar } from './piece-editor/PieceEditorToolbar'

interface PieceEditorProps {
  inspectorHidden?: boolean
  stage?: 'prepare' | 'cut'
  onBackgroundApply?: (pieceId: string, result: ArtworkEditResult) => void
  piece: PiecePreset | null
  onPieceChange: (piece: PiecePreset) => void
  onSave: () => void
  onDuplicate: () => void
}

export function PieceEditor(props: PieceEditorProps): JSX.Element {
  if (!props.piece) {
    return (
      <section className="grid h-full min-h-64 place-items-center rounded-[var(--ui-radius-lg)] border border-dashed bg-muted/25 p-8 text-center">
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
  onSave,
  onDuplicate,
  stage = 'cut',
  inspectorHidden = false,
  onBackgroundApply
}: PieceEditorProps & { piece: PiecePreset }): JSX.Element {
  const [inspector, setInspector] = useState('mask')
  const [preparationTool, setPreparationTool] = useState<'mask' | 'background'>('mask')
  const fullscreen = useCanvasFullscreen<HTMLElement>()
  useEffect(() => setInspector('mask'), [stage])
  const editorState = usePieceEditorState()
  const history = usePieceEditorHistory(piece, onPieceChange)
  const clipboard = usePieceEditorClipboard()
  const transforms = usePieceEditorTransforms()
  const selection = usePieceEditorSelection(piece, onPieceChange)
  const canvasHost = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 })
  useEffect(() => {
    const element = canvasHost.current
    if (!element) return
    const observer = new ResizeObserver(() =>
      setCanvasSize({ width: element.clientWidth, height: element.clientHeight })
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const scale =
    Math.max(
      0.1,
      Math.min(
        (canvasSize.width - 80) / Math.max(piece.widthCm, 0.1),
        (canvasSize.height - 80) / Math.max(piece.heightCm, 0.1)
      )
    ) * editorState.zoom
  const selectedObjects = useMemo(
    () => piece.objects.filter((object) => piece.selectedObjectIds.includes(object.id)),
    [piece.objects, piece.selectedObjectIds]
  )
  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : undefined
  const selectedShape = getMaskSourceFromSelection(piece)

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
    resetZoom: () => editorState.setZoom(1),
    setTool: editorState.setTool
  })
  return (
    <section
      ref={fullscreen.containerRef}
      className={`h-full min-h-0 min-w-0 gap-3 overflow-hidden outline-none ${fullscreen.isExpanded ? 'flex flex-col bg-card p-3' : `grid grid-cols-1 ${inspectorHidden ? '' : 'lg:grid-cols-[minmax(0,1fr)_260px]'}`}`}
      aria-label="Artwork editing workspace"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-sm font-semibold">
              {stage === 'prepare' ? 'Prepare artwork' : 'Cut lines'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {piece.displayName} · {formatCm(piece.widthCm)} x {formatCm(piece.heightCm)}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              ref={fullscreen.buttonRef}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={fullscreen.isExpanded}
              onClick={() => void fullscreen.toggleExpanded()}
              title={
                fullscreen.isExpanded ? 'Restore workspace (Esc)' : 'Use the screen for the canvas'
              }
            >
              {fullscreen.isExpanded ? <Minimize2 /> : <Maximize2 />}
              {fullscreen.isExpanded ? 'Restore workspace' : 'Expand canvas'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Undo"
              disabled={!history.canUndo}
              onClick={history.undo}
            >
              <Undo2 data-icon="inline-start" />
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Redo"
              disabled={!history.canRedo}
              onClick={history.redo}
            >
              <Redo2 data-icon="inline-start" />
              Redo
            </Button>
          </div>
        </div>
        {fullscreen.error && (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {fullscreen.error}
          </p>
        )}

        <PieceEditorToolbar
          tool={editorState.tool}
          zoom={editorState.zoom}
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
        <div ref={canvasHost} className="flex min-h-64 min-w-0 flex-1 lg:min-h-0">
          <PieceEditorCanvas
            showTransparency={stage === 'prepare'}
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
            onKeyDown={(event) => handleKeyDown(event.nativeEvent)}
          />
        </div>
        <PieceEditorStatusBar piece={piece} tool={editorState.tool} zoom={editorState.zoom} />
        <details className="shrink-0 text-xs text-muted-foreground">
          <summary className="cursor-pointer py-1">Keyboard shortcuts</summary>
          <PieceEditorShortcuts tool={editorState.tool} />
        </details>
      </div>

      <aside
        className={`${inspectorHidden || fullscreen.isExpanded ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--ui-radius-lg)] border bg-card/80`}
        aria-label="Artwork properties"
      >
        <Tabs
          value={inspector}
          onValueChange={setInspector}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="m-2 grid shrink-0 grid-cols-4" aria-label="Piece inspector">
            <TabsTrigger value="layers" className="px-1 text-xs">
              Layers
            </TabsTrigger>
            <TabsTrigger value="properties" className="px-1 text-xs">
              Properties
            </TabsTrigger>
            <TabsTrigger value="mask" className="px-1 text-xs">
              {stage === 'prepare' ? 'Prepare' : 'Cut tools'}
            </TabsTrigger>
            <TabsTrigger value="align" className="px-1 text-xs">
              Align
            </TabsTrigger>
          </TabsList>
          <TabsContent value="layers" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
            <ObjectLayerPanel
              piece={piece}
              onMaskEditingChange={(enabled) => {
                editorState.setTool('select')
                history.commit((current) => setMaskEditing(current, enabled))
              }}
              onRenameObject={(id, name) =>
                history.commit((current) => renameLayerObject(current, id, name))
              }
              onReorderObject={(id, index) =>
                history.commit((current) => reorderLayerObject(current, id, index))
              }
              onSelectObject={(id, additive) => {
                editorState.setTool('select')
                selection.toggleId(id, additive)
              }}
              onToggleVisibility={toggleVisibility}
              onToggleLock={toggleLock}
              onSetKeyObject={selection.setKeyObjectId}
              onDeleteObject={(objectId) => deleteObjects([objectId])}
            />
          </TabsContent>
          <TabsContent value="align" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
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
          </TabsContent>
          <TabsContent value="mask" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
            {stage === 'prepare' ? (
              <div className="space-y-3">
                <section className="rounded-lg border p-3">
                  <h4 className="text-sm font-semibold">Mask / trim</h4>
                  <p className="my-2 text-xs text-muted-foreground">
                    Draw around the part you want to keep, then apply the mask. The original image
                    stays intact.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editorState.setTool('rectangle')}
                    >
                      Trim rectangle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editorState.setTool('ellipse')}
                    >
                      Oval mask
                    </Button>
                  </div>
                  <Button
                    className="mt-2 w-full"
                    size="sm"
                    disabled={!selectedShape || !piece.artworkObjectId}
                    onClick={() => {
                      if (selectedShape && piece.artworkObjectId) {
                        history.commit(
                          makeClippingMaskFromSelection(piece, [
                            piece.artworkObjectId,
                            selectedShape.id
                          ])
                        )
                        editorState.setTool('select')
                      }
                    }}
                  >
                    Apply mask / trim
                  </Button>
                  <Button
                    className="mt-2 w-full"
                    variant="ghost"
                    size="sm"
                    disabled={!piece.clippingMaskEnabled}
                    onClick={releaseMask}
                  >
                    Release mask
                  </Button>
                </section>
                {onBackgroundApply && (
                  <ArtworkBackgroundTools
                    piece={piece}
                    onApply={(id, result) => {
                      history.checkpoint(piece)
                      onBackgroundApply(id, result)
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <section className="space-y-2 rounded-lg border p-3">
                  <h4 className="text-sm font-semibold">Create cut line</h4>
                  <p className="text-xs text-muted-foreground">
                    Use the prepared mask, artwork bounds, or draw a shape on the canvas.
                  </p>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={!piece.clippingMaskEnabled}
                    onClick={() => history.commit(createCutlineFromMaskBounds(piece))}
                  >
                    Cut around mask
                  </Button>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    onClick={() => history.commit(createCutlineFromArtworkBounds(piece))}
                  >
                    Cut around artwork
                  </Button>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    disabled={!selectedShape}
                    onClick={duplicateAsCutline}
                  >
                    Use selected shape
                  </Button>
                </section>
                <CutlineInspector piece={piece} onPieceChange={(next) => history.commit(next)} />
              </div>
            )}
          </TabsContent>
          <TabsContent value="properties" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
            <PieceEditorPropertiesPanel
              hideQuantity
              piece={piece}
              selectedObject={selectedObject}
              onPieceSizeChange={(widthCm, heightCm, source) =>
                history.commit((currentPiece) =>
                  resizePiecePreset(currentPiece, widthCm, heightCm, source)
                )
              }
              onQuantityChange={(quantity) =>
                history.commit((currentPiece) => ({
                  ...currentPiece,
                  quantity: Math.max(1, Math.round(quantity))
                }))
              }
              onAspectLockChange={(lockAspectRatio) =>
                history.commit((currentPiece) => ({ ...currentPiece, lockAspectRatio }))
              }
              onObjectTransformChange={(objectId, patch) =>
                history.commit((currentPiece) =>
                  transforms.updateTransform(currentPiece, objectId, patch)
                )
              }
              onReset={() => history.commit((currentPiece) => resetTransforms(currentPiece))}
              onDuplicatePiece={onDuplicate}
              onPieceLockChange={(locked) =>
                history.commit((currentPiece) => ({ ...currentPiece, locked }))
              }
              onGroupChange={setGroup}
            />
          </TabsContent>
        </Tabs>
        <Button className="m-2 shrink-0" type="button" onClick={onSave}>
          <Save data-icon="inline-start" />
          Save piece preset
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
    const editableIds = ids.filter((id) => !isActiveMaskPairObject(piece, id))
    if (editableIds.length === 0) return
    const next = deleteEditorObjects(piece, editableIds)
    if (next !== piece) history.commit(next)
  }

  function toggleVisibility(objectId: string): void {
    if (isActiveMaskPairObject(piece, objectId)) return
    history.commit(
      syncLegacyFieldsFromObjects({
        ...piece,
        selectedObjectIds: piece.selectedObjectIds.filter((id) => id !== objectId),
        keyObjectId: piece.keyObjectId === objectId ? undefined : piece.keyObjectId,
        objects: piece.objects.map((object) =>
          object.id === objectId ? { ...object, visible: !object.visible } : object
        )
      })
    )
  }

  function toggleLock(objectId: string): void {
    if (isActiveMaskPairObject(piece, objectId)) return
    history.commit(
      syncLegacyFieldsFromObjects({
        ...piece,
        selectedObjectIds: piece.selectedObjectIds.filter((id) => id !== objectId),
        keyObjectId: piece.keyObjectId === objectId ? undefined : piece.keyObjectId,
        objects: piece.objects.map((object) =>
          object.id === objectId ? { ...object, locked: !object.locked } : object
        )
      })
    )
  }

  function setSelectionLock(locked: boolean): void {
    history.commit(transforms.setSelectionLock(piece, locked))
  }

  function makeClippingMask(): void {
    const next = makeClippingMaskFromSelection(piece)
    if (next !== piece) history.commit(next)
  }

  function makeMaskAndCutline(): void {
    const next = makeClippingMaskAndCutlineFromSelection(piece)
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
    if (piece.selectedObjectIds.some((objectId) => isActiveMaskPairObject(piece, objectId))) return
    history.commit(
      syncLegacyFieldsFromObjects({
        ...piece,
        objects: alignEditorObjects(
          piece.objects,
          piece.selectedObjectIds,
          piece.keyObjectId,
          command
        )
      })
    )
  }

  function center(targetId: string | undefined, containerId: string | undefined): void {
    if (targetId && isActiveMaskPairObject(piece, targetId)) return
    const next = centerObjectInside(piece, targetId, containerId)
    if (next !== piece) history.commit(next)
  }

  function match(targetId: string | undefined, sourceId: string | undefined): void {
    if (targetId && isActiveMaskPairObject(piece, targetId)) return
    const next = matchObjectGeometry(piece, targetId, sourceId)
    if (next !== piece) history.commit(next)
  }

  function setGroup(grouped: boolean): void {
    if (piece.selectedObjectIds.some((objectId) => isActiveMaskPairObject(piece, objectId))) return
    const next = setObjectGroup(piece, piece.selectedObjectIds, grouped)
    if (next !== piece) history.commit(next)
  }

  function nudgeSelection(dxCm: number, dyCm: number): void {
    if (piece.selectedObjectIds.length === 0) return
    history.commit(transforms.moveSelection(piece, dxCm, dyCm))
  }
}

function isActiveMaskPairObject(piece: PiecePreset, objectId: string): boolean {
  return (
    piece.clippingMaskEnabled &&
    !piece.maskEditingEnabled &&
    (piece.maskObjectId === objectId || piece.artworkObjectId === objectId)
  )
}

function resetTransforms(piece: PiecePreset): PiecePreset {
  const primaryIds = new Set([piece.artworkObjectId, piece.maskObjectId, piece.cutlineObjectId])
  return syncLegacyFieldsFromObjects({
    ...piece,
    objects: piece.objects.map((object) =>
      primaryIds.has(object.id) && !object.locked && !isActiveMaskPairObject(piece, object.id)
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
        : object
    )
  })
}
