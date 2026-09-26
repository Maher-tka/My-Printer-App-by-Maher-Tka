import { Eye, Grid3X3, Printer, ZoomIn, ZoomOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CoverViewMode } from '../types'

interface HardcoverToolbarProps {
  viewMode: CoverViewMode
  zoom: number
  showGuides: boolean
  showSafeZones: boolean
  snapToGuides: boolean
  onViewModeChange: (viewMode: CoverViewMode) => void
  onZoomChange: (zoom: number) => void
  onFitToScreen: () => void
  onToggleGuides: () => void
  onToggleSafeZones: () => void
  onToggleSnap: () => void
}

export function HardcoverToolbar(props: HardcoverToolbarProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <ModeButton
        active={props.viewMode === 'layout'}
        onClick={() => props.onViewModeChange('layout')}
        icon={<Grid3X3 />}
        label="Layout"
      />
      <ModeButton
        active={props.viewMode === 'clean'}
        onClick={() => props.onViewModeChange('clean')}
        icon={<Eye />}
        label="Clean Preview"
      />
      <ModeButton
        active={props.viewMode === 'print'}
        onClick={() => props.onViewModeChange('print')}
        icon={<Printer />}
        label="Print Preview"
      />
      <span className="mx-1 h-7 w-px bg-border" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => props.onZoomChange(Math.max(0.5, props.zoom - 0.1))}
        disabled={props.zoom <= 0.5}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <ZoomOut />
      </Button>
      <Badge variant="secondary">{Math.round(props.zoom * 100)}%</Badge>
      <Button type="button" size="sm" variant="outline" onClick={props.onFitToScreen}>
        Fit
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => props.onZoomChange(Math.min(2, props.zoom + 0.1))}
        disabled={props.zoom >= 2}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <ZoomIn />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={props.showGuides ? 'default' : 'outline'}
        onClick={props.onToggleGuides}
        aria-pressed={props.showGuides}
        title="Show or hide binding and fold guides"
      >
        Guides
      </Button>
      <Button
        type="button"
        size="sm"
        variant={props.showSafeZones ? 'default' : 'outline'}
        onClick={props.onToggleSafeZones}
        aria-pressed={props.showSafeZones}
        title="Show the area where text and important artwork stay safe"
      >
        Safe zones
      </Button>
      <Button
        type="button"
        size="sm"
        variant={props.snapToGuides ? 'default' : 'outline'}
        onClick={props.onToggleSnap}
        aria-pressed={props.snapToGuides}
        title="Align artwork to nearby guides while dragging"
      >
        Snap
      </Button>
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}): JSX.Element {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      onClick={onClick}
      aria-pressed={active}
    >
      {icon}
      {label}
    </Button>
  )
}
