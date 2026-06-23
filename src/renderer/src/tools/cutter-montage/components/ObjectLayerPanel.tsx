import { Eye, EyeOff, KeyRound, LockKeyhole, Trash2, UnlockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EditorObject, PiecePreset } from '../types'

interface ObjectLayerPanelProps {
  piece: PiecePreset
  onSelectObject: (objectId: string, additive: boolean) => void
  onToggleVisibility: (objectId: string) => void
  onToggleLock: (objectId: string) => void
  onSetKeyObject: (objectId?: string) => void
  onDeleteObject: (objectId: string) => void
}

export function ObjectLayerPanel({
  piece,
  onSelectObject,
  onToggleVisibility,
  onToggleLock,
  onSetKeyObject,
  onDeleteObject
}: ObjectLayerPanelProps): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Objects</h4>
        <span className="text-[11px] text-muted-foreground">
          {piece.selectedObjectIds.length} selected
        </span>
      </div>
      <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-auto">
        {piece.objects.map((object) => {
          const selected = piece.selectedObjectIds.includes(object.id)
          const isKey = piece.keyObjectId === object.id
          const canDelete = object.role === 'helper' || object.role === 'cutline'

          return (
            <div
              key={object.id}
              className={`flex items-center gap-1 rounded-md border px-1 py-1.5 text-sm ${
                selected ? 'border-primary bg-primary/5' : 'bg-muted/20'
              } ${isKey ? 'ring-2 ring-amber-300' : ''}`}
            >
              <LayerButton
                label={`Toggle ${object.name} visibility`}
                onClick={() => onToggleVisibility(object.id)}
              >
                {object.visible ? <Eye /> : <EyeOff />}
              </LayerButton>
              <LayerButton
                label={`Toggle ${object.name} lock`}
                onClick={() => onToggleLock(object.id)}
              >
                {object.locked ? <LockKeyhole /> : <UnlockKeyhole />}
              </LayerButton>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={(event) => onSelectObject(object.id, event.shiftKey)}
              >
                <span className="block truncate font-medium">{getObjectLabel(object)}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {getRoleLabel(object)}
                </span>
              </button>
              <Button
                type="button"
                size="icon"
                variant={isKey ? 'default' : 'ghost'}
                className="size-7"
                disabled={!selected}
                onClick={() => onSetKeyObject(isKey ? undefined : object.id)}
                aria-label={`Set ${object.name} as key object`}
              >
                <KeyRound />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 text-destructive"
                disabled={!canDelete}
                onClick={() => onDeleteObject(object.id)}
                aria-label={`Delete ${object.name}`}
              >
                <Trash2 />
              </Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function LayerButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="size-7"
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </Button>
  )
}

function getObjectLabel(object: EditorObject): string {
  if (object.role === 'artwork') return 'Artwork'
  if (object.role === 'clipping-mask') return 'Mask'
  if (object.role === 'cutline') return object.strokeName || 'CutContour'
  return object.name
}

function getRoleLabel(object: EditorObject): string {
  if (object.role === 'clipping-mask') return 'Clipping mask'
  if (object.role === 'cutline') return 'Cutline'
  if (object.role === 'artwork') return 'Artwork'
  return 'Helper shape'
}
