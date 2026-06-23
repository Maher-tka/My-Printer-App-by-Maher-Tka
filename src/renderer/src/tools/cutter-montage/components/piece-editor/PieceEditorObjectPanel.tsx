import { memo } from 'react'
import { Eye, EyeOff, KeyRound, LockKeyhole, UnlockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EditorObject, PiecePreset } from '../../types'

interface PieceEditorObjectPanelProps {
  piece: PiecePreset
  onSelect: (id: string, additive: boolean) => void
  onToggleVisibility: (id: string) => void
  onToggleLock: (id: string) => void
  onSetKey: (id?: string) => void
}

export function PieceEditorObjectPanel(props: PieceEditorObjectPanelProps): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Objects</h4><span className="text-[11px] text-muted-foreground">{props.piece.selectedObjectIds.length} selected</span></div>
      <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-auto">
        {props.piece.objects.map((object) => (
          <ObjectRow
            key={object.id}
            object={object}
            selected={props.piece.selectedObjectIds.includes(object.id)}
            isKey={props.piece.keyObjectId === object.id}
            onSelect={props.onSelect}
            onToggleVisibility={props.onToggleVisibility}
            onToggleLock={props.onToggleLock}
            onSetKey={props.onSetKey}
          />
        ))}
      </div>
    </section>
  )
}

const ObjectRow = memo(function ObjectRow({ object, selected, isKey, onSelect, onToggleVisibility, onToggleLock, onSetKey }: { object: EditorObject; selected: boolean; isKey: boolean; onSelect: (id: string, additive: boolean) => void; onToggleVisibility: (id: string) => void; onToggleLock: (id: string) => void; onSetKey: (id?: string) => void }): JSX.Element {
  return (
    <div className={`flex items-center gap-1 rounded-md border px-1 py-1.5 text-sm ${selected ? 'border-primary bg-primary/5' : 'bg-muted/20'} ${isKey ? 'ring-2 ring-amber-300' : ''}`}>
      <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => onToggleVisibility(object.id)} aria-label={`Toggle ${object.name} visibility`}>{object.visible ? <Eye /> : <EyeOff />}</Button>
      <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => onToggleLock(object.id)} aria-label={`Toggle ${object.name} lock`}>{object.locked ? <LockKeyhole /> : <UnlockKeyhole />}</Button>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={(event) => onSelect(object.id, event.shiftKey)}><span className="block truncate font-medium">{object.name}</span><span className="block truncate text-[11px] text-muted-foreground">{object.role} · {object.id.slice(-6)}</span></button>
      <Button type="button" size="icon" variant={isKey ? 'default' : 'ghost'} className="size-7" disabled={!selected} onClick={() => onSetKey(isKey ? undefined : object.id)} aria-label={`Set ${object.name} as key object`}><KeyRound /></Button>
    </div>
  )
})
