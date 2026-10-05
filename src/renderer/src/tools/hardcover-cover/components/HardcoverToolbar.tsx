import { useLanguage } from '@/i18n/useLanguage'
import { Eye, Grid3X3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PreviewZoomControls } from '@/components/ui/preview-zoom-controls'
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
  const { t } = useLanguage()

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3"
      role="toolbar"
      aria-label="Cover preview tools"
    >
      <ModeButton
        active={props.viewMode === 'layout'}
        onClick={() => props.onViewModeChange('layout')}
        icon={<Grid3X3 />}
        label={t('Layout')}
      />
      <ModeButton
        active={props.viewMode === 'clean'}
        onClick={() => props.onViewModeChange('clean')}
        icon={<Eye />}
        label={t('Clean Preview')}
      />
      <ModeButton
        active={props.viewMode === 'print'}
        onClick={() => props.onViewModeChange('print')}
        icon={<Eye />}
        label={t('Print Preview')}
      />
      <span className="mx-1 h-7 w-px bg-border" aria-hidden="true" />
      <PreviewZoomControls
        zoom={props.zoom}
        zoomOutDisabled={props.zoom <= 0.5}
        zoomInDisabled={props.zoom >= 2}
        onZoomOut={() => props.onZoomChange(Math.max(0.5, props.zoom - 0.1))}
        onZoomIn={() => props.onZoomChange(Math.min(2, props.zoom + 0.1))}
        onFit={props.onFitToScreen}
      />
      <details className="relative ml-auto">
        <summary className="flex h-8 cursor-pointer items-center rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] px-3 text-[13px] text-muted-foreground hover:bg-accent">
          {t('View options')}
        </summary>
        <div className="absolute right-0 top-full z-50 mt-2 grid w-48 gap-1 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-popover p-2 shadow-elevated">
          <PreviewToggle
            active={props.showGuides}
            onClick={props.onToggleGuides}
            label={t('Guides')}
            title={t('Show or hide binding and fold guides')}
          />
          <PreviewToggle
            active={props.showSafeZones}
            onClick={props.onToggleSafeZones}
            label={t('Safe zones')}
            title={t('Show the area where text and important artwork stay safe')}
          />
          <PreviewToggle
            active={props.snapToGuides}
            onClick={props.onToggleSnap}
            label={t('Snap')}
            title={t('Align artwork to nearby guides while dragging')}
          />{' '}
        </div>
      </details>
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
  const { t } = useLanguage()

  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'selected' : 'ghost'}
      className={active ? undefined : 'border border-transparent'}
      onClick={onClick}
      aria-pressed={active}
    >
      {icon}
      {t(label)}
    </Button>
  )
}

function PreviewToggle({
  active,
  onClick,
  label,
  title
}: {
  active: boolean
  onClick: () => void
  label: string
  title: string
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label
      className="flex cursor-pointer items-center gap-2 rounded-[var(--ui-radius-sm)] px-2 py-2 text-[13px] hover:bg-accent"
      title={title}
    >
      <input type="checkbox" checked={active} onChange={onClick} className="accent-primary" />
      {t(label)}
    </label>
  )
}
