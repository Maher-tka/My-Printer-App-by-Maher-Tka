import { useLanguage } from '@/i18n/useLanguage'
import { Circle, MousePointer2, Move, PenTool, RectangleHorizontal, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PreviewZoomControls } from '@/components/ui/preview-zoom-controls'
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
  const { t } = useLanguage()

  return (
    <div
      className="mb-3 flex shrink-0 flex-wrap items-center gap-1 rounded-lg bg-muted/40 p-2"
      role="toolbar"
      aria-label="Artwork tools and zoom"
    >
      <ToolButton
        active={props.tool === 'select'}
        onClick={() => props.onToolChange('select')}
        label={t('Select')}
        icon={MousePointer2}
      />
      <ToolButton
        active={props.tool === 'pan'}
        onClick={() => props.onToolChange('pan')}
        label={t('Move')}
        icon={Move}
      />
      <ToolButton
        active={props.tool === 'rectangle'}
        onClick={() => props.onToolChange('rectangle')}
        label={t('Rectangle')}
        icon={RectangleHorizontal}
      />
      <ToolButton
        active={props.tool === 'rounded-rectangle'}
        onClick={() => props.onToolChange('rounded-rectangle')}
        label={t('Rounded rectangle')}
        icon={Square}
      />
      <ToolButton
        active={props.tool === 'ellipse'}
        onClick={() => props.onToolChange('ellipse')}
        label={t('Ellipse')}
        icon={Circle}
      />
      <ToolButton
        active={props.tool === 'line'}
        onClick={() => props.onToolChange('line')}
        label={t('Draw path')}
        icon={PenTool}
      />
      <PreviewZoomControls
        zoom={props.zoom}
        onZoomOut={props.onZoomOut}
        onZoomIn={props.onZoomIn}
        onFit={props.onFit}
        zoomOutDisabled={props.zoom <= 0.45}
        zoomInDisabled={props.zoom >= 2.5}
      />
      <details className="relative">
        <summary className="flex h-8 cursor-pointer items-center rounded-md border bg-background px-2 text-xs font-medium">
          {t('View')}
        </summary>
        <div className="absolute right-0 top-full z-50 mt-2 flex w-44 flex-col gap-1 rounded-lg border bg-card p-2 shadow-elevated">
          <Toggle
            label={t('Show grid')}
            checked={props.showGrid}
            onChange={props.onShowGridChange}
          />
          <Toggle
            label={t('Snap to grid')}
            checked={props.snapToGrid}
            onChange={props.onSnapToGridChange}
          />
          <Toggle
            label={t('Smart guides')}
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
  const { t } = useLanguage()

  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'selected' : 'outline'}
      aria-pressed={active}
      aria-label={t(label)}
      title={t(label)}
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
  const { t } = useLanguage()

  return (
    <label className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        aria-label={t(label)}
        onChange={(event) => onChange(event.target.checked)}
      />
      {t(label)}
    </label>
  )
}
