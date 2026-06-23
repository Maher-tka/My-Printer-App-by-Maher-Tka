import { Circle, Maximize, MousePointer2, Move, RectangleHorizontal, Square, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EditorTool } from '../../types'

interface PieceEditorToolbarProps {
  tool: EditorTool
  showGrid: boolean
  snapToGrid: boolean
  smartGuides: boolean
  onToolChange: (tool: EditorTool) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onShowGridChange: (value: boolean) => void
  onSnapToGridChange: (value: boolean) => void
  onSmartGuidesChange: (value: boolean) => void
}

export function PieceEditorToolbar(props: PieceEditorToolbarProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      <ToolButton active={props.tool === 'select'} onClick={() => props.onToolChange('select')} label="Select" icon={MousePointer2} />
      <ToolButton active={props.tool === 'pan'} onClick={() => props.onToolChange('pan')} label="Pan" icon={Move} />
      <ToolButton active={props.tool === 'rectangle'} onClick={() => props.onToolChange('rectangle')} label="Rect" icon={RectangleHorizontal} />
      <ToolButton active={props.tool === 'rounded-rectangle'} onClick={() => props.onToolChange('rounded-rectangle')} label="Round" icon={Square} />
      <ToolButton active={props.tool === 'ellipse'} onClick={() => props.onToolChange('ellipse')} label="Ellipse" icon={Circle} />
      <Button type="button" size="sm" variant="outline" onClick={props.onZoomIn}><ZoomIn data-icon="inline-start" />Zoom</Button>
      <Button type="button" size="sm" variant="outline" onClick={props.onZoomOut}><ZoomOut data-icon="inline-start" />Zoom</Button>
      <Button type="button" size="sm" variant="outline" onClick={props.onFit}><Maximize data-icon="inline-start" />Fit</Button>
      <Toggle label="Grid" checked={props.showGrid} onChange={props.onShowGridChange} />
      <Toggle label="Snap" checked={props.snapToGrid} onChange={props.onSnapToGridChange} />
      <Toggle label="Smart" checked={props.smartGuides} onChange={props.onSmartGuidesChange} />
    </div>
  )
}

function ToolButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: typeof MousePointer2 }): JSX.Element {
  return <Button type="button" size="sm" variant={active ? 'default' : 'outline'} onClick={onClick}><Icon data-icon="inline-start" />{label}</Button>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }): JSX.Element {
  return <label className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium text-muted-foreground"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>
}
