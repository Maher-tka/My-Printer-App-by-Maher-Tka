import { ActionButton } from './action-button'
import { Button } from './button'
import { useLanguage } from '@/i18n/useLanguage'

export function PreviewZoomControls({
  zoom,
  onZoomOut,
  onZoomIn,
  onFit,
  onActualSize,
  zoomOutDisabled,
  zoomInDisabled
}: {
  zoom: number
  onZoomOut: () => void
  onZoomIn: () => void
  onFit: () => void
  onActualSize?: () => void
  zoomOutDisabled?: boolean
  zoomInDisabled?: boolean
}): JSX.Element {
  const { t } = useLanguage()
  return (
    <div
      className="inline-flex items-center gap-1"
      role="group"
      aria-label={t('Preview zoom controls')}
    >
      <ActionButton action="zoomOut" iconOnly disabled={zoomOutDisabled} onClick={onZoomOut} />
      <output
        aria-label={t('Preview zoom')}
        className="min-w-12 text-center text-xs font-medium tabular-nums text-muted-foreground"
      >
        {Math.round(zoom * 100)}%
      </output>
      <ActionButton action="zoomIn" iconOnly disabled={zoomInDisabled} onClick={onZoomIn} />
      <ActionButton action="fit" size="sm" onClick={onFit} title={t('Fit preview to workspace')} />
      {onActualSize && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onActualSize}
          title={t('Show at actual size')}
        >
          100%
        </Button>
      )}
    </div>
  )
}
