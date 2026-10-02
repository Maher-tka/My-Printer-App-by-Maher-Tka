import { Grid2X2, MousePointer2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  onModeChange,
  onSettingsChange,
  onAutoArrange,
  onUndoAutoArrange,
  onCreateTestProject
}: CutterToolbarProps): JSX.Element {
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
              variant={mode === 'piece-editor' ? 'default' : 'ghost'}
              onClick={() => onModeChange('piece-editor')}
            >
              <MousePointer2 data-icon="inline-start" />
              Piece Editor
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'montage-sheet' ? 'default' : 'ghost'}
              onClick={() => onModeChange('montage-sheet')}
            >
              <Grid2X2 data-icon="inline-start" />
              Montage Sheet
            </Button>
          </div>
        )}

        <Button type="button" onClick={onAutoArrange} disabled={!hasPieces}>
          <Wand2 data-icon="inline-start" />
          Arrange Copies
        </Button>
        <Button type="button" variant="outline" onClick={onUndoAutoArrange}>
          Undo Arrange
        </Button>
        <details className="relative rounded-md bg-card">
          <summary className="flex h-9 cursor-pointer items-center px-3 text-sm font-medium">
            Sheet setup
          </summary>
          <div className="absolute left-0 top-full z-50 mt-2 flex max-h-[60vh] w-[min(480px,80vw)] flex-wrap items-end gap-3 overflow-y-auto rounded-lg border bg-card p-3 shadow-elevated">
            <div className="flex h-9 min-w-44 items-center rounded-md border bg-background px-3 text-sm">
              Final width: <strong className="ml-1">auto, max 96 cm</strong>
            </div>
            <NumberControl
              label="Production length"
              suffix="cm"
              value={settings.heightCm}
              min={MIN_PRODUCTION_SHEET_HEIGHT_CM}
              max={MAX_PRODUCTION_SHEET_HEIGHT_CM}
              step={10}
              onChange={(heightCm) => onSettingsChange({ heightCm, lengthMode: 'fixed' })}
            />
            <NumberControl
              label="Sheet margin"
              suffix="mm"
              value={settings.safeMarginCm * 10}
              min={0}
              max={100}
              step={1}
              onChange={(value) => onSettingsChange({ safeMarginCm: value / 10 })}
            />
            <NumberControl
              label="Copy spacing"
              suffix="mm"
              value={settings.spacingMm}
              min={0}
              max={50}
              step={0.5}
              onChange={(spacingMm) => onSettingsChange({ spacingMm })}
            />
            <label className="flex w-40 flex-col gap-1 text-xs font-medium text-muted-foreground">
              Arrangement order
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
                <option value="largest-first">Largest first</option>
                <option value="smallest-first">Smallest first</option>
                <option value="piece-name">Piece name</option>
                <option value="quantity">Quantity</option>
              </select>
            </label>
            <AdvancedToggle
              label="Allow rotation"
              checked={settings.allowRotation}
              onChange={(allowRotation) => onSettingsChange({ allowRotation })}
            />
            <AdvancedToggle
              label="Preserve manual positions"
              checked={settings.preserveManualPositions}
              onChange={(preserveManualPositions) => onSettingsChange({ preserveManualPositions })}
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
  return (
    <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
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
  onChange
}: {
  label: string
  suffix: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <label className="flex w-32 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <span className="flex h-9 items-center overflow-hidden rounded-md border bg-background">
        <input
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="border-l px-2 text-xs">{suffix}</span>
      </span>
    </label>
  )
}
