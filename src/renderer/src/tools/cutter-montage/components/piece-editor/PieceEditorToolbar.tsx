import {
  Circle,
  Maximize,
  MousePointer2,
  Move,
  PenTool,
  RectangleHorizontal,
  Square,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EditorTool } from '../../types'

interface PieceEditorToolbarProps {
  tool: EditorTool
  zoom: number
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
    <div className="flex flex-wrap items-center gap-1">
      <ToolButton
        active={props.tool === 'select'}
        onClick={() => props.onToolChange('select')}
        label="Select"
        icon={MousePointer2}
      />
      <ToolButton
        active={props.tool === 'pan'}
        onClick={() => props.onToolChange('pan')}
        label="Move"
        icon={Move}
      />
      <ToolButton
        active={props.tool === 'rectangle'}
        onClick={() => props.onToolChange('rectangle')}
        label="Rectangle"
        icon={RectangleHorizontal}
      />
      <ToolButton
        active={props.tool === 'rounded-rectangle'}
        onClick={() => props.onToolChange('rounded-rectangle')}
        label="Rounded rectangle"
        icon={Square}
      />
      <ToolButton
        active={props.tool === 'ellipse'}
        onClick={() => props.onToolChange('ellipse')}
        label="Ellipse"
        icon={Circle}
      />
      <ToolButton
        active={props.tool === 'line'}
        onClick={() => props.onToolChange('line')}
        label="Draw path"
        icon={PenTool}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={props.onZoomOut}
        aria-label="Zoom out"
        title="Zoom out"
        className="size-8 p-0"
      >
        <ZoomOut data-icon="inline-start" />
      </Button>
      <span
        className="inline-flex h-8 min-w-12 items-center justify-center rounded-md border bg-background px-2 text-xs font-medium tabular-nums"
        aria-label={`Zoom ${Math.round(props.zoom * 100)} percent`}
      >
        {Math.round(props.zoom * 100)}%
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={props.onZoomIn}
        aria-label="Zoom in"
        title="Zoom in"
        className="size-8 p-0"
      >
        <ZoomIn data-icon="inline-start" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={props.onFit}
        aria-label="Reset zoom"
        title="Fit artwork"
        className="size-8 p-0"
      >
        <Maximize data-icon="inline-start" />
      </Button>
      <details className="relative">
        <summary className="flex h-8 cursor-pointer items-center rounded-md border bg-background px-2 text-xs font-medium">
          View
        </summary>
        <div className="absolute right-0 top-full z-50 mt-1 flex w-40 flex-col gap-1 rounded-md border bg-card p-2 shadow-md">
          <Toggle label="Show grid" checked={props.showGrid} onChange={props.onShowGridChange} />
          <Toggle
            label="Snap to grid"
            checked={props.snapToGrid}
            onChange={props.onSnapToGridChange}
          />
          <Toggle
            label="Smart guides"
            checked={props.smartGuides}
            onChange={props.onSmartGuidesChange}
          />
        </div>
      </details>
    </div>
  )
}

function ToolButton({
  active,
  onClick,
  label,
  icon: Icon
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: typeof MousePointer2
}): JSX.Element {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className="size-8 p-0"
      onClick={onClick}
    >
      <Icon data-icon="inline-start" />
    </Button>
  )
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): JSX.Element {
  return (
    <label className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}
