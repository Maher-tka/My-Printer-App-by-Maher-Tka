import { useLanguage } from '@/i18n/useLanguage'
import type { AlignmentCommand, PiecePreset } from '../../types'
import {
  canMakeClippingMaskFromSelection,
  getMaskSourceFromSelection
} from '../../lib/editorObjects'

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
  const { t } = useLanguage()

  if (!props.state) return null
  const selected = props.piece.objects.filter((object) =>
    props.piece.selectedObjectIds.includes(object.id)
  )
  const hasShape = Boolean(getMaskSourceFromSelection(props.piece))
  const canMakeMask = canMakeClippingMaskFromSelection(props.piece)
  const primary = selected[0]
  const editableSelected = selected.filter(
    (object) => !(props.piece.clippingMaskEnabled && props.piece.maskObjectId === object.id)
  )
  const canDeleteSelection = editableSelected.length > 0
  const canLockSelection = editableSelected.some((object) => !object.locked)
  const canUnlockSelection = editableSelected.some((object) => object.locked)
  const canChangeGrouping =
    editableSelected.length === selected.length && editableSelected.length > 0
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
        <MenuItem label={t('Copy')} onClick={props.onCopy} disabled={selected.length === 0} />
        <MenuItem label={t('Paste')} onClick={props.onPaste} disabled={!props.hasClipboard} />
        <MenuItem
          label="Paste in Place (Ctrl+F)"
          onClick={props.onPasteInPlace}
          disabled={!props.hasClipboard}
        />
        <MenuItem
          label={t('Duplicate')}
          onClick={props.onDuplicate}
          disabled={selected.length === 0}
        />
        <MenuItem label={t('Delete')} onClick={props.onDelete} disabled={!canDeleteSelection} />
        <Separator />
        <MenuItem
          label={t('Lock')}
          onClick={() => props.onLock(true)}
          disabled={!canLockSelection}
        />
        <MenuItem
          label={t('Unlock')}
          onClick={() => props.onLock(false)}
          disabled={!canUnlockSelection}
        />
        <MenuItem
          label={t('Group / Link')}
          onClick={() => props.onGroup(true)}
          disabled={!canChangeGrouping || selected.length < 2 || props.piece.groupLinked}
        />
        <MenuItem
          label={t('Ungroup / Unlink')}
          onClick={() => props.onGroup(false)}
          disabled={!canChangeGrouping || !props.piece.groupLinked}
        />
        <Separator />
        <MenuItem
          label={t('Make Clipping Mask')}
          onClick={props.onMakeClippingMask}
          disabled={!canMakeMask}
        />
        <MenuItem
          label={t('Release Clipping Mask')}
          onClick={props.onReleaseClippingMask}
          disabled={!props.piece.clippingMaskEnabled}
        />
        <MenuItem
          label={t('Create Cutline from Mask')}
          onClick={props.onCreateCutlineFromMask}
          disabled={!props.piece.maskObjectId}
        />
        <MenuItem
          label={t('Convert to CutContour')}
          onClick={props.onConvertToCutContour}
          disabled={!hasShape}
        />
        <MenuItem
          label={t('Duplicate Shape as Cutline')}
          onClick={props.onDuplicateAsCutline}
          disabled={!hasShape}
        />
        <Separator />
        <MenuItem
          label={t('Set as Key Object')}
          onClick={() => props.onSetKeyObject(primary?.id)}
          disabled={!primary || !props.piece.selectedObjectIds.includes(primary.id)}
        />
        <MenuItem
          label={t('Align Left')}
          onClick={() => props.onAlign('left')}
          disabled={!props.piece.keyObjectId || selected.length < 2}
        />
        <MenuItem
          label={t('Align Center Horizontal')}
          onClick={() => props.onAlign('center-horizontal')}
          disabled={!props.piece.keyObjectId || selected.length < 2}
        />
        <MenuItem
          label={t('Align Right')}
          onClick={() => props.onAlign('right')}
          disabled={!props.piece.keyObjectId || selected.length < 2}
        />
        <MenuItem
          label={t('Align Top')}
          onClick={() => props.onAlign('top')}
          disabled={!props.piece.keyObjectId || selected.length < 2}
        />
        <MenuItem
          label={t('Align Center Vertical')}
          onClick={() => props.onAlign('center-vertical')}
          disabled={!props.piece.keyObjectId || selected.length < 2}
        />
        <MenuItem
          label={t('Align Bottom')}
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
  const { t } = useLanguage()

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className="block w-full px-3 py-1.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
    >
      {t(label)}
    </button>
  )
}
function Separator(): JSX.Element {
  return <div className="my-1 border-t" />
}
