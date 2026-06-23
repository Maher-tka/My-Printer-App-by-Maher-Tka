import type { AlignmentCommand, EditorObjectType, PiecePreset } from '../types'

export interface PieceEditorContextMenuState {
  x: number
  y: number
}

interface PieceEditorContextMenuProps {
  state: PieceEditorContextMenuState | null
  piece: PiecePreset
  selectedObjects: EditorObjectType[]
  onClose: () => void
  onCopy: () => void
  onPaste: () => void
  onPasteInPlace: () => void
  onDuplicate: () => void
  onDelete: () => void
  onLock: () => void
  onUnlock: () => void
  onGroup: () => void
  onUngroup: () => void
  onMakeClippingMask: () => void
  onReleaseClippingMask: () => void
  onCreateCutlineFromMask: () => void
  onConvertToCutContour: () => void
  onDuplicateAsCutline: () => void
  onCenterCutlineToArtwork: () => void
  onCenterArtworkToCutline: () => void
  onAlign: (command: AlignmentCommand) => void
  onSetKeyObject: (object: EditorObjectType) => void
}

export function PieceEditorContextMenu({
  state,
  piece,
  selectedObjects,
  onClose,
  onCopy,
  onPaste,
  onPasteInPlace,
  onDuplicate,
  onDelete,
  onLock,
  onUnlock,
  onGroup,
  onUngroup,
  onMakeClippingMask,
  onReleaseClippingMask,
  onCreateCutlineFromMask,
  onConvertToCutContour,
  onDuplicateAsCutline,
  onCenterCutlineToArtwork,
  onCenterArtworkToCutline,
  onAlign,
  onSetKeyObject
}: PieceEditorContextMenuProps): JSX.Element | null {
  if (!state) {
    return null
  }

  const hasMask = selectedObjects.includes('mask')
  const hasHelper = selectedObjects.includes('helper-shape')
  const hasCutline = selectedObjects.includes('cutline')
  const hasArtwork = selectedObjects.includes('artwork')
  const canMakeMask = hasArtwork && (hasHelper || hasMask)
  const selectedObject = selectedObjects[0]

  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default" type="button" onClick={onClose} aria-label="Close context menu" />
      <div
        className="fixed z-50 min-w-56 overflow-hidden rounded-md border bg-card py-1 text-sm shadow-xl"
        style={{ left: state.x, top: state.y }}
        role="menu"
      >
        <MenuItem label="Copy" onClick={onCopy} />
        <MenuItem label="Paste" onClick={onPaste} />
        <MenuItem label="Paste in Place" onClick={onPasteInPlace} />
        <MenuItem label="Duplicate" onClick={onDuplicate} />
        <MenuItem label="Delete" onClick={onDelete} />
        <Separator />
        <MenuItem label="Lock" onClick={onLock} />
        <MenuItem label="Unlock" onClick={onUnlock} />
        <MenuItem label="Group" onClick={onGroup} disabled={piece.artworkCutlineGrouped} />
        <MenuItem label="Ungroup" onClick={onUngroup} disabled={!piece.artworkCutlineGrouped} />
        {(canMakeMask || piece.mask.enabled || hasMask) && (
          <>
            <Separator />
            {canMakeMask && <MenuItem label="Make Clipping Mask" onClick={onMakeClippingMask} />}
            {piece.mask.enabled && <MenuItem label="Release Clipping Mask" onClick={onReleaseClippingMask} />}
            {(hasMask || piece.mask.enabled) && <MenuItem label="Edit Mask" onClick={() => onSetKeyObject('mask')} />}
            {(hasMask || piece.mask.enabled) && <MenuItem label="Create Cutline from Mask" onClick={onCreateCutlineFromMask} />}
          </>
        )}
        {(hasCutline || hasHelper || piece.helperShape) && (
          <>
            <Separator />
            <MenuItem label="Convert to CutContour" onClick={onConvertToCutContour} disabled={!hasHelper} />
            <MenuItem label="Duplicate as Cutline" onClick={onDuplicateAsCutline} disabled={!hasMask && !hasHelper} />
            <MenuItem label="Center Cutline to Artwork" onClick={onCenterCutlineToArtwork} />
            <MenuItem label="Center Artwork to Cutline" onClick={onCenterArtworkToCutline} />
          </>
        )}
        <Separator />
        <MenuItem label="Align Left" onClick={() => onAlign('left')} />
        <MenuItem label="Align Center Horizontal" onClick={() => onAlign('center-horizontal')} />
        <MenuItem label="Align Right" onClick={() => onAlign('right')} />
        <MenuItem label="Align Top" onClick={() => onAlign('top')} />
        <MenuItem label="Align Center Vertical" onClick={() => onAlign('center-vertical')} />
        <MenuItem label="Align Bottom" onClick={() => onAlign('bottom')} />
        {selectedObject && (
          <MenuItem label="Set as Key Object" onClick={() => onSetKeyObject(selectedObject)} />
        )}
      </div>
    </>
  )
}

function MenuItem({
  label,
  onClick,
  disabled = false
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      className="block w-full px-3 py-1.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
    >
      {label}
    </button>
  )
}

function Separator(): JSX.Element {
  return <div className="my-1 border-t" />
}
