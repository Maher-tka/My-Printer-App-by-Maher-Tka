import { useLanguage } from '@/i18n/useLanguage'
import { Eye, Image, ScanLine, Scissors, type LucideIcon } from 'lucide-react'
import type { CutterLayerVisibility, CutterSheetSettings } from '../types'

interface LayerVisibilityControlsProps {
  layers: CutterLayerVisibility
  settings: CutterSheetSettings
  onLayerChange: (layers: Partial<CutterLayerVisibility>) => void
  onSettingsChange: (settings: Partial<CutterSheetSettings>) => void
}

export function LayerVisibilityControls({
  layers,
  settings,
  onLayerChange,
  onSettingsChange
}: LayerVisibilityControlsProps): JSX.Element {
  const { t } = useLanguage()

  return (
    <section className="space-y-4" aria-label="Production layers and guides">
      <div>
        <h3 className="text-sm font-semibold">{t('Production layers')}</h3>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <LayerToggle
          label={t('Print artwork')}
          icon={Image}
          checked={layers.artwork}
          onChange={(artwork) => onLayerChange({ artwork })}
        />
        <LayerToggle
          label={t('Cutline')}
          icon={Scissors}
          checked={layers.cutlines}
          onChange={(cutlines) => onLayerChange({ cutlines })}
        />
        <div className="flex items-start gap-3 rounded-md bg-muted/40 px-3 py-3">
          <ScanLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-xs font-medium">{t('Registration marks')}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {settings.registrationMarks?.enabled ? 'Enabled' : 'Disabled'} · Generated from sheet
              settings. Configure marks in Export.
            </p>
          </div>
        </div>
      </div>
      <div className="border-t pt-4">
        <h4 className="mb-2 text-xs font-semibold">{t('Canvas guides')}</h4>
        <LayerToggle
          label={t('Grid')}
          checked={settings.showGrid}
          onChange={(showGrid) => onSettingsChange({ showGrid })}
        />
        <LayerToggle
          label={t('Safe area')}
          checked={settings.showSafeArea !== false}
          onChange={(showSafeArea) => onSettingsChange({ showSafeArea })}
        />
        <LayerToggle
          label={t('Roll edge guides')}
          checked={settings.showRollGuides !== false}
          onChange={(showRollGuides) => onSettingsChange({ showRollGuides })}
        />
        <LayerToggle
          label={t('Snap to grid')}
          checked={settings.snapToGrid}
          onChange={(snapToGrid) => onSettingsChange({ snapToGrid })}
        />
      </div>
    </section>
  )
}

function LayerToggle({
  label,
  icon: Icon = Eye,
  checked,
  onChange
}: {
  label: string
  icon?: LucideIcon
  checked: boolean
  onChange: (checked: boolean) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex min-h-9 items-center gap-3 rounded-md px-3 py-2 text-xs transition-colors hover:bg-muted/40">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1">{t(label)}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}
