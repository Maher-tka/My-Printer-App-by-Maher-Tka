import { useLanguage } from '@/i18n/useLanguage'
import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  KeyRound,
  LockKeyhole,
  Pencil,
  Trash2,
  UnlockKeyhole
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EditorObject, PiecePreset } from '../types'
import { isSelectableLayerObject } from '../lib/editorLayers'

interface ObjectLayerPanelProps {
  piece: PiecePreset
  onSelectObject: (objectId: string, additive: boolean) => void
  onToggleVisibility: (objectId: string) => void
  onToggleLock: (objectId: string) => void
  onSetKeyObject: (objectId?: string) => void
  onDeleteObject: (objectId: string) => void
  onMaskEditingChange: (enabled: boolean) => void
  onRenameObject: (objectId: string, name: string) => void
  onReorderObject: (objectId: string, targetIndex: number) => void
}

export function ObjectLayerPanel({
  piece,
  onSelectObject,
  onToggleVisibility,
  onToggleLock,
  onSetKeyObject,
  onDeleteObject,
  onMaskEditingChange,
  onRenameObject,
  onReorderObject
}: ObjectLayerPanelProps): JSX.Element {
  const { t } = useLanguage()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)
  const selected = piece.objects.filter(
    (object) =>
      piece.selectedObjectIds.includes(object.id) && isSelectableLayerObject(piece, object)
  )
  const active = selected.length === 1 ? selected[0] : undefined
  const activeIndex = active ? piece.objects.indexOf(active) : -1
  function startRename(object: EditorObject): void {
    setEditingId(object.id)
    setDraftName(object.name)
  }
  function finishRename(): void {
    if (editingId && draftName.trim()) onRenameObject(editingId, draftName)
    setEditingId(null)
  }
  return (
    <section className="flex min-h-0 flex-col" aria-label="Layers and objects">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h4 className="text-sm font-semibold">{t('Layers')}</h4>
        <span className="text-[11px] text-muted-foreground">
          {piece.objects.length} objects · top first
        </span>
      </div>
      {piece.clippingMaskEnabled && (
        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 p-2 text-xs">
          <span>{piece.maskEditingEnabled ? 'Editing clipping group' : 'Clipping group'}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onMaskEditingChange(!piece.maskEditingEnabled)}
          >
            {piece.maskEditingEnabled ? 'Done' : 'Edit contents'}
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {[...piece.objects].reverse().map((object) => {
          const isSelected = selected.some((item) => item.id === object.id)
          const isKey = piece.keyObjectId === object.id
          const protectedMask =
            piece.clippingMaskEnabled &&
            !piece.maskEditingEnabled &&
            (piece.maskObjectId === object.id || piece.artworkObjectId === object.id)
          const editable = !object.locked && !protectedMask
          return (
            <div
              key={object.id}
              className={`group flex items-center gap-0.5 rounded-md px-1 py-2 text-sm ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'} ${dropId === object.id ? 'border-t-2 border-t-primary' : ''}`}
              onDragOver={(event) => {
                if (dragId && dragId !== object.id) {
                  event.preventDefault()
                  setDropId(object.id)
                }
              }}
              onDragLeave={() => setDropId(null)}
              onDrop={(event) => {
                event.preventDefault()
                if (dragId) onReorderObject(dragId, piece.objects.indexOf(object))
                setDragId(null)
                setDropId(null)
              }}
            >
              <LayerButton
                label={
                  protectedMask
                    ? 'Choose Edit contents to change visibility'
                    : `${object.visible ? 'Hide' : 'Show'} ${object.name}`
                }
                disabled={protectedMask}
                onClick={() => onToggleVisibility(object.id)}
              >
                {object.visible ? <Eye /> : <EyeOff />}
              </LayerButton>
              <LayerButton
                label={
                  protectedMask
                    ? 'Choose Edit contents to unlock'
                    : `${object.locked ? 'Unlock' : 'Lock'} ${object.name}`
                }
                disabled={protectedMask}
                onClick={() => onToggleLock(object.id)}
              >
                {object.locked || protectedMask ? (
                  <LockKeyhole />
                ) : (
                  <UnlockKeyhole className="text-muted-foreground/50" />
                )}
              </LayerButton>
              <span
                className={`ml-1 h-7 w-0.5 shrink-0 rounded ${object.role === 'cutline' ? 'bg-rose-400/70' : object.role === 'artwork' ? 'bg-primary/70' : 'bg-muted-foreground/40'}`}
              />
              {editingId === object.id ? (
                <input
                  autoFocus
                  aria-label={`Rename ${object.name}`}
                  className="mx-1 min-w-0 flex-1 rounded border bg-background px-1 py-1 text-xs"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(event) => {
                    event.stopPropagation()
                    if (event.key === 'Enter') finishRename()
                    if (event.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={`min-w-0 flex-1 px-1 text-left ${!object.visible ? 'opacity-50' : ''}`}
                  aria-pressed={isSelected}
                  disabled={!isSelectableLayerObject(piece, object)}
                  onClick={(event) =>
                    onSelectObject(object.id, event.shiftKey || event.ctrlKey || event.metaKey)
                  }
                  onDoubleClick={() => {
                    if (editable) startRename(object)
                  }}
                  title={
                    protectedMask
                      ? 'Release the clipping mask to edit its contents'
                      : 'Click to select · double-click to rename'
                  }
                >
                  <span className="block truncate text-xs font-medium">{object.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {getRoleLabel(object)}
                    {protectedMask ? ' · Active mask' : object.groupId ? ' · Grouped' : ''}
                  </span>
                </button>
              )}
              {isKey ? (
                <KeyRound className="size-3 shrink-0 text-amber-600" aria-label="Alignment key" />
              ) : null}
              <span
                draggable={editable}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', object.id)
                  setDragId(object.id)
                }}
                onDragEnd={() => {
                  setDragId(null)
                  setDropId(null)
                }}
                className={`px-0.5 ${editable ? 'cursor-grab text-muted-foreground' : 'text-muted-foreground/20'}`}
                title={editable ? `Drag to reorder ${object.name}` : 'Unlock to reorder'}
              >
                <GripVertical className="size-3.5" />
              </span>
            </div>
          )
        })}
        {piece.objects.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            {t('Import artwork or draw a shape to begin.')}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1 border-t px-2 py-1.5">
        <LayerButton
          label="Bring selected object forward"
          disabled={!active || activeIndex === piece.objects.length - 1}
          onClick={() => {
            if (active) onReorderObject(active.id, activeIndex + 1)
          }}
        >
          <ArrowUp />
        </LayerButton>
        <LayerButton
          label="Send selected object backward"
          disabled={!active || activeIndex === 0}
          onClick={() => {
            if (active) onReorderObject(active.id, activeIndex - 1)
          }}
        >
          <ArrowDown />
        </LayerButton>
        <LayerButton
          label="Rename selected object"
          disabled={!active}
          onClick={() => {
            if (active) startRename(active)
          }}
        >
          <Pencil />
        </LayerButton>
        <LayerButton
          label="Set selected object as alignment key"
          disabled={!active}
          onClick={() => {
            if (active) onSetKeyObject(piece.keyObjectId === active.id ? undefined : active.id)
          }}
        >
          <KeyRound />
        </LayerButton>
        <span className="flex-1" />
        <LayerButton
          label="Delete selected object"
          disabled={!active}
          onClick={() => {
            if (active) onDeleteObject(active.id)
          }}
        >
          <Trash2 />
        </LayerButton>
      </div>
      <p className="border-t px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
        {t('Shift-click to select more. Drag the grip to change stacking order.')}
      </p>
      <p className="border-t px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Print artwork and cutlines stay separate. Registration marks are generated at the sheet
        stage.
      </p>
    </section>
  )
}

function LayerButton({
  label,
  disabled = false,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="size-8 shrink-0 [&_svg]:size-3.5"
      disabled={disabled}
      onClick={onClick}
      aria-label={t(label)}
      title={t(label)}
    >
      {children}
    </Button>
  )
}
function getRoleLabel(object: EditorObject): string {
  if (object.role === 'clipping-mask') return 'Clipping mask'
  if (object.role === 'cutline') return `Cutline · ${object.strokeName || 'CutContour'}`
  if (object.role === 'artwork') return 'Print artwork'
  return 'Helper shape'
}
