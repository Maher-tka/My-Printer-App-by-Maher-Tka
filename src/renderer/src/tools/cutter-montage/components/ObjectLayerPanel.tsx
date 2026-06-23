import { Eye, EyeOff, LockKeyhole, UnlockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EditorObjectType, KeyObjectState, PiecePreset } from '../types'

interface ObjectLayerPanelProps {
  piece: PiecePreset
  selectedObjects: EditorObjectType[]
  keyObject: KeyObjectState
  onPieceChange: (piece: PiecePreset) => void
  onSelectedObjectsChange: (objects: EditorObjectType[]) => void
}

const objectRows: Array<{
  id: EditorObjectType
  visibilityKey: keyof PiecePreset['objectVisibility']
  label: string
  role: string
}> = [
  { id: 'artwork', visibilityKey: 'artwork', label: 'Artwork', role: 'Artwork' },
  { id: 'mask', visibilityKey: 'mask', label: 'Mask', role: 'Clipping' },
  { id: 'cutline', visibilityKey: 'cutline', label: 'CutContour', role: 'Cutline' },
  { id: 'helper-shape', visibilityKey: 'helper', label: 'Helper Shape', role: 'Shape' }
]

export function ObjectLayerPanel({
  piece,
  selectedObjects,
  keyObject,
  onPieceChange,
  onSelectedObjectsChange
}: ObjectLayerPanelProps): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-3">
      <h4 className="text-sm font-semibold">Objects</h4>
      <div className="mt-3 flex flex-col gap-2">
        {objectRows.map((row) => {
          const available = row.id !== 'helper-shape' || Boolean(piece.helperShape)
          const visible = piece.objectVisibility[row.visibilityKey]
          const locked = piece.objectLocks[row.visibilityKey]
          const selected = selectedObjects.includes(row.id)

          return (
            <div
              key={row.id}
              className={`flex items-center gap-2 rounded-md border px-2 py-2 text-sm ${
                selected ? 'border-primary bg-primary/5' : 'bg-muted/20'
              } ${available ? '' : 'opacity-50'}`}
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={!available}
                onClick={() =>
                  onPieceChange({
                    ...piece,
                    objectVisibility: {
                      ...piece.objectVisibility,
                      [row.visibilityKey]: !visible
                    }
                  })
                }
                aria-label={`Toggle ${row.label} visibility`}
              >
                {visible ? <Eye /> : <EyeOff />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={!available}
                onClick={() =>
                  onPieceChange({
                    ...piece,
                    objectLocks: {
                      ...piece.objectLocks,
                      [row.visibilityKey]: !locked
                    }
                  })
                }
                aria-label={`Toggle ${row.label} lock`}
              >
                {locked ? <LockKeyhole /> : <UnlockKeyhole />}
              </Button>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                disabled={!available}
                onClick={(event) =>
                  onSelectedObjectsChange(
                    event.shiftKey
                      ? selectedObjects.includes(row.id)
                        ? selectedObjects.filter((object) => object !== row.id)
                        : [...selectedObjects, row.id]
                      : [row.id]
                  )
                }
              >
                <span className="block truncate font-medium">{row.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{row.role}</span>
              </button>
              {keyObject.object === row.id && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                  KEY
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
