import { useLanguage } from '@/i18n/useLanguage'
import { Grid2X2, MousePointer2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActionIcon } from '@/components/ui/action-button'
import { ToolSettingsTabs } from '../../shared/ToolSettingsTabs'
import { LiveNumberInput } from './LiveNumberInput'
import type { CutterMode, CutterSheetSettings } from '../types'
import {
  MAX_PRODUCTION_SHEET_HEIGHT_CM,
  MIN_PRODUCTION_SHEET_HEIGHT_CM
} from '../lib/productionSheets'

interface CutterToolbarProps {
  hideModeSwitcher?: boolean
  mode: CutterMode
  settings: CutterSheetSettings
  warnings: string[]
  hasPieces: boolean
  hasLayout?: boolean
  onModeChange: (mode: CutterMode) => void
  onSettingsChange: (settings: Partial<CutterSheetSettings>) => void
  onAutoArrange: () => void
  onUndoAutoArrange: () => void
  onCreateTestProject?: (count: number) => void
}

export function CutterToolbar({
  hideModeSwitcher = false,
  mode,
  settings,
  warnings,
  hasPieces,
  hasLayout = false,
  onModeChange,
  onSettingsChange,
  onAutoArrange,
  onUndoAutoArrange,
  onCreateTestProject
}: CutterToolbarProps): JSX.Element {
  const { t } = useLanguage()

  return (
    <div
      className="relative z-40 shrink-0 rounded-lg bg-muted/40 p-2"
      role="toolbar"
      aria-label="Sheet arrangement tools"
    >
      <div className="flex flex-wrap items-center gap-2">
        {!hideModeSwitcher && (
          <div className="flex rounded-md border bg-muted/40 p-1">
            <Button
              type="button"
              size="sm"
              variant={mode === 'piece-editor' ? 'selected' : 'ghost'}
              onClick={() => onModeChange('piece-editor')}
            >
              <MousePointer2 data-icon="inline-start" />
              {t('Piece Editor')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'montage-sheet' ? 'selected' : 'ghost'}
              onClick={() => onModeChange('montage-sheet')}
            >
              <Grid2X2 data-icon="inline-start" />
              {t('Montage Sheet')}
            </Button>
          </div>
        )}

        <Button
          type="button"
          variant={hasLayout ? 'outline' : 'default'}
          onClick={onAutoArrange}
          disabled={!hasPieces}
        >
          <Wand2 data-icon="inline-start" />
          {t('Arrange Copies')}
        </Button>
        <Button type="button" variant="outline" onClick={onUndoAutoArrange}>
          <ActionIcon action="undo" /> {t('Undo Arrange')}
        </Button>
        <details className="relative rounded-md bg-card">
          <summary className="flex h-9 cursor-pointer items-center px-3 text-sm font-medium">
            {t('Sheet setup')}
          </summary>
          <div className="absolute left-0 top-full z-50 mt-2 flex max-h-[60vh] w-[min(480px,80vw)] flex-wrap items-end gap-3 overflow-y-auto rounded-lg border bg-card p-3 shadow-elevated">
            <ToolSettingsTabs
              label={t('Cutter sheet settings')}
              advanced={
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex w-40 flex-col gap-1 text-xs font-medium text-muted-foreground">
                    {t('Arrangement order')}
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={settings.sortStrategy ?? 'largest-first'}
                      onChange={(event) =>
                        onSettingsChange({
                          sortStrategy: event.target.value as NonNullable<
                            CutterSheetSettings['sortStrategy']
                          >
                        })
                      }
                    >
                      <option value="largest-first">{t('Largest first')}</option>
                      <option value="smallest-first">{t('Smallest first')}</option>
                      <option value="piece-name">{t('Piece name')}</option>
                      <option value="quantity">{t('Quantity')}</option>
                    </select>
                  </label>
                  <AdvancedToggle
                    label={t('Allow rotation')}
                    checked={settings.allowRotation}
                    onChange={(allowRotation) => onSettingsChange({ allowRotation })}
                  />
                  <AdvancedToggle
                    label="Preserve manual positions"
                    checked={settings.preserveManualPositions}
                    onChange={(preserveManualPositions) =>
                      onSettingsChange({ preserveManualPositions })
                    }
                  />
                  <AdvancedToggle
                    label="Keep matching designs together"
                    checked={Boolean(settings.preferSameDesignGrouping)}
                    onChange={(preferSameDesignGrouping) =>
                      onSettingsChange({ preferSameDesignGrouping })
                    }
                  />
                  {onCreateTestProject && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onCreateTestProject(20)}
                      >
                        Create Test Cutter Project
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onCreateTestProject(100)}
                      >
                        Create Test Montage (100)
                      </Button>
                    </>
                  )}
                </div>
              }
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex h-9 min-w-44 items-center rounded-md border bg-background px-3 text-sm">
                  Final width: <strong className="ml-1">auto, max 96 cm</strong>
                </div>
                <AdvancedToggle
                  label={t('Auto-expand height')}
                  checked={Boolean(settings.autoExpandHeight)}
                  onChange={(autoExpandHeight) =>
                    onSettingsChange({
                      autoExpandHeight,
                      lengthMode: autoExpandHeight ? 'auto-trim-last' : 'fixed'
                    })
                  }
                />
                <NumberControl
                  label={t('Production length')}
                  suffix="cm"
                  value={settings.heightCm}
                  min={MIN_PRODUCTION_SHEET_HEIGHT_CM}
                  max={MAX_PRODUCTION_SHEET_HEIGHT_CM}
                  step={10}
                  disabled={settings.autoExpandHeight}
                  onChange={(heightCm) => onSettingsChange({ heightCm, lengthMode: 'fixed' })}
                />
                <NumberControl
                  label={t('Sheet margin')}
                  suffix="mm"
                  value={settings.safeMarginCm * 10}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(value) => onSettingsChange({ safeMarginCm: value / 10 })}
                />
                <NumberControl
                  label={t('Copy spacing')}
                  suffix="mm"
                  value={settings.spacingMm}
                  min={0}
                  max={50}
                  step={0.5}
                  onChange={(spacingMm) => onSettingsChange({ spacingMm })}
                />
              </div>
            </ToolSettingsTabs>
          </div>
        </details>
      </div>
      {warnings.length > 0 && (
        <details className="mt-1 text-xs text-warning-foreground">
          <summary className="cursor-pointer">{warnings.length} sheet notice(s)</summary>
          <div className="flex flex-wrap gap-1 pt-1">
            {warnings.map((warning) => (
              <span
                key={warning}
                className="rounded-md bg-warning px-2 py-1 text-warning-foreground"
              >
                {warning}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function AdvancedToggle({
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
    <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {t(label)}
    </label>
  )
}

function NumberControl({
  label,
  suffix,
  value,
  min,
  max,
  step,
  disabled,
  onChange
}: {
  label: string
  suffix: string
  value: number
  min: number
  max: number
  step: number
  disabled?: boolean
  onChange: (value: number) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex w-32 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t(label)}
      <span className="flex h-9 items-center overflow-hidden rounded-md border bg-background">
        <LiveNumberInput
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={value}
          onValueChange={onChange}
        />
        <span className="border-l px-2 text-xs">{suffix}</span>
      </span>
    </label>
  )
}
