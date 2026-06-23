import { Copy, LockKeyhole, RotateCcw, UnlockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ArtworkTransform, EditorObject, PiecePreset } from '../../types'

interface PieceEditorPropertiesPanelProps {
  piece: PiecePreset
  selectedObject?: EditorObject
  onPieceSizeChange: (widthCm: number, heightCm: number, source: 'width' | 'height') => void
  onQuantityChange: (quantity: number) => void
  onAspectLockChange: (locked: boolean) => void
  onObjectTransformChange: (objectId: string, patch: Partial<ArtworkTransform>) => void
  onReset: () => void
  onDuplicatePiece: () => void
  onPieceLockChange: (locked: boolean) => void
  onGroupChange: (linked: boolean) => void
}

export function PieceEditorPropertiesPanel({
  piece,
  selectedObject,
  onPieceSizeChange,
  onQuantityChange,
  onAspectLockChange,
  onObjectTransformChange,
  onReset,
  onDuplicatePiece,
  onPieceLockChange,
  onGroupChange
}: PieceEditorPropertiesPanelProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Piece">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Width cm" value={piece.widthCm} step={0.1} onChange={(value) => onPieceSizeChange(value, piece.heightCm, 'width')} />
          <NumberField label="Height cm" value={piece.heightCm} step={0.1} onChange={(value) => onPieceSizeChange(piece.widthCm, value, 'height')} />
          <NumberField label="Quantity" value={piece.quantity} step={1} onChange={onQuantityChange} />
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={piece.lockAspectRatio} onChange={(event) => onAspectLockChange(event.target.checked)} />Lock aspect ratio</label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onReset}><RotateCcw data-icon="inline-start" />Reset</Button>
          <Button type="button" size="sm" variant="outline" onClick={onDuplicatePiece}><Copy data-icon="inline-start" />Duplicate preset</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onPieceLockChange(!piece.locked)}>{piece.locked ? <LockKeyhole data-icon="inline-start" /> : <UnlockKeyhole data-icon="inline-start" />}{piece.locked ? 'Locked' : 'Unlocked'}</Button>
          <Button type="button" size="sm" variant={piece.groupLinked ? 'default' : 'outline'} onClick={() => onGroupChange(!piece.groupLinked)}>{piece.groupLinked ? 'Linked transforms' : 'Edit independently'}</Button>
        </div>
      </Panel>
      <Panel title={selectedObject ? `${selectedObject.name} Transform` : 'Transform'}>
        {selectedObject ? (
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" value={selectedObject.transform.xCm} step={0.1} onChange={(xCm) => onObjectTransformChange(selectedObject.id, { xCm })} />
            <NumberField label="Y" value={selectedObject.transform.yCm} step={0.1} onChange={(yCm) => onObjectTransformChange(selectedObject.id, { yCm })} />
            <NumberField label="Width" value={selectedObject.transform.widthCm} step={0.1} onChange={(widthCm) => onObjectTransformChange(selectedObject.id, { widthCm: Math.max(widthCm, 0.2) })} />
            <NumberField label="Height" value={selectedObject.transform.heightCm} step={0.1} onChange={(heightCm) => onObjectTransformChange(selectedObject.id, { heightCm: Math.max(heightCm, 0.2) })} />
            <NumberField label="Rotation" value={selectedObject.transform.rotation} step={1} onChange={(rotation) => onObjectTransformChange(selectedObject.id, { rotation })} />
          </div>
        ) : <p className="text-xs text-muted-foreground">Select one object to edit exact geometry.</p>}
      </Panel>
    </div>
  )
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return <section className="rounded-lg border bg-card p-3"><h4 className="text-sm font-semibold">{title}</h4><div className="mt-3">{children}</div></section>
}

function NumberField({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (value: number) => void }): JSX.Element {
  return <label className="flex flex-col gap-1 text-xs text-muted-foreground">{label}<input className="h-8 rounded border bg-background px-2 text-sm text-foreground" type="number" step={step} value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0} onChange={(event) => onChange(Number(event.target.value))} /></label>
}
