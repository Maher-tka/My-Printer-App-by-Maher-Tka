import type { AlignmentCommand, PiecePreset } from '../../types'

export interface PieceEditorContextMenuState {
  x: number
  y: number
}

interface PieceEditorContextMenuProps {
  state: PieceEditorContextMenuState | null
  piece: PiecePreset
  hasClipboard: boolean
  onClose: () => void
  onCopy: () => void
  onPaste: () => void
  onPasteInPlace: () => void
  onDuplicate: () => void
  onDelete: () => void
  onLock: (locked: boolean) => void
  onGroup: (linked: boolean) => void
  onMakeClippingMask: () => void
  onReleaseClippingMask: () => void
  onCreateCutlineFromMask: () => void
  onConvertToCutContour: () => void
  onDuplicateAsCutline: () => void
  onAlign: (command: AlignmentCommand) => void
  onSetKeyObject: (id?: string) => void
}

export function PieceEditorContextMenu(props: PieceEditorContextMenuProps): JSX.Element | null {
  if (!props.state) return null
  const selected = props.piece.objects.filter((object) =>
    props.piece.selectedObjectIds.includes(object.id)
  )
  const hasArtwork = selected.some((object) => object.role === 'artwork')
  const hasShape = selected.some(
    (object) => object.role === 'helper' || object.role === 'clipping-mask'
  )
  const primary = selected[0]
  return (
    <>
      <button
        className="fixed inset-0 z-40 cursor-default"
        type="button"
        onClick={props.onClose}
        aria-label="Close context menu"
      />
      <div
        className="fixed z-50 min-w-60 overflow-hidden rounded-md border bg-card py-1 text-sm shadow-xl"
        style={{ left: props.state.x, top: props.state.y }}
        role="menu"
      >
        <MenuItem label="Copy" onClick={props.onCopy} disabled={selected.length === 0} />
        <MenuItem label="Paste" onClick={props.onPaste} disabled={!props.hasClipboard} />
        <MenuItem
          label="Paste in Place (Ctrl+F)"
          onClick={props.onPasteInPlace}
          disabled={!props.hasClipboard}
        />
        <MenuItem label="Duplicate" onClick={props.onDuplicate} disabled={selected.length === 0} />
        <MenuItem label="Delete" onClick={props.onDelete} disabled={selected.length === 0} />
        <Separator />
        <MenuItem
          label="Lock"
          onClick={() => props.onLock(true)}
          disabled={selected.length === 0}
        />
        <MenuItem
          label="Unlock"
          onClick={() => props.onLock(false)}
          disabled={selected.length === 0}
        />
        <MenuItem
          label="Group / Link"
          onClick={() => props.onGroup(true)}
          disabled={selected.length < 2 || props.piece.groupLinked}
        />
        <MenuItem
          label="Ungroup / Unlink"
          onClick={() => props.onGroup(false)}
          disabled={!props.piece.groupLinked}
        />
        <Separator />
        <MenuItem
          label="Make Clipping Mask"
          onClick={props.onMakeClippingMask}
          disabled={!hasArtwork || !hasShape}
        />
        <MenuItem
          label="Release Clipping Mask"
          onClick={props.onReleaseClippingMask}
          disabled={!props.piece.clippingMaskEnabled}
        />
        <MenuItem
          label="Create Cutline from Mask"
          onClick={props.onCreateCutlineFromMask}
          disabled={!props.piece.maskObjectId}
        />
        <MenuItem
          label="Convert to CutContour"
          onClick={props.onConvertToCutContour}
          disabled={!hasShape}
        />
        <MenuItem
          label="Duplicate Shape as Cutline"
          onClick={props.onDuplicateAsCutline}
          disabled={!hasShape}
        />
        <Separator />
        <MenuItem
          label="Set as Key Object"
          onClick={() => props.onSetKeyObject(primary?.id)}
          disabled={!primary || !props.piece.selectedObjectIds.includes(primary.id)}
        />
        <MenuItem
          label="Align Left"
          onClick={() => props.onAlign('left')}
          disabled={!props.piece.keyObjectId || selected.length < 2}
        />
        <MenuItem
          label="Align Center Horizontal"
          onClick={() => props.onAlign('center-horizontal')}
          disabled={!props.piece.keyObjectId || selected.length < 2}
        />
        <MenuItem
          label="Align Right"
          onClick={() => props.onAlign('right')}
          disabled={!props.piece.keyObjectId || selected.length < 2}
        />
        <MenuItem
          label="Align Top"
          onClick={() => props.onAlign('top')}
          disabled={!props.piece.keyObjectId || selected.length < 2}
        />
        <MenuItem
          label="Align Center Vertical"
          onClick={() => props.onAlign('center-vertical')}
          disabled={!props.piece.keyObjectId || selected.length < 2}
        />
        <MenuItem
          label="Align Bottom"
          onClick={() => props.onAlign('bottom')}
          disabled={!props.piece.keyObjectId || selected.length < 2}
        />
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
      role="menuitem"
      disabled={disabled}
      className="block w-full px-3 py-1.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
function Separator(): JSX.Element {
  return <div className="my-1 border-t" />
}
