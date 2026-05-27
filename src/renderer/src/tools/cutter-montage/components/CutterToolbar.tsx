import { Grid2X2, MousePointer2, Ruler, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CutterMode, CutterSheetSettings } from '../types'

interface CutterToolbarProps {
  mode: CutterMode
  settings: CutterSheetSettings
  warnings: string[]
  hasPieces: boolean
  onModeChange: (mode: CutterMode) => void
  onSettingsChange: (settings: Partial<CutterSheetSettings>) => void
  onAutoArrange: () => void
}

export function CutterToolbar({
  mode,
  settings,
  warnings,
  hasPieces,
  onModeChange,
  onSettingsChange,
  onAutoArrange
}: CutterToolbarProps): JSX.Element {
  return (
    <div className="sticky top-0 z-10 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-end gap-3">
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

        <NumberControl
          label="Sheet width"
          suffix="cm"
          value={settings.widthCm}
          min={20}
          max={110}
          step={0.5}
          onChange={(widthCm) => onSettingsChange({ widthCm })}
        />
        <NumberControl
          label="Sheet height"
          suffix="cm"
          value={settings.heightCm}
          min={30}
          max={220}
          step={0.5}
          onChange={(heightCm) => onSettingsChange({ heightCm })}
        />
        <NumberControl
          label="Spacing"
          suffix="mm"
          value={settings.spacingMm}
          min={0}
          max={50}
          step={0.5}
          onChange={(spacingMm) => onSettingsChange({ spacingMm })}
        />
        <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
          <input
            type="checkbox"
            checked={settings.allowRotation}
            onChange={(event) => onSettingsChange({ allowRotation: event.target.checked })}
          />
          Allow rotation
        </label>
        <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
          <input
            type="checkbox"
            checked={settings.preserveManualPositions}
            onChange={(event) =>
              onSettingsChange({ preserveManualPositions: event.target.checked })
            }
          />
          Preserve positions
        </label>
        <Button type="button" onClick={onAutoArrange} disabled={!hasPieces}>
          <Wand2 data-icon="inline-start" />
          Auto Arrange
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
          <Ruler aria-hidden="true" />
          Roll width: {settings.rollWidthCm} cm
        </span>
        <span className="rounded-md bg-muted px-2 py-1">
          95-97 cm recommended for Mimaki marks
        </span>
        {warnings.map((warning) => (
          <span key={warning} className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">
            {warning}
          </span>
        ))}
      </div>
    </div>
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
      <span className="flex h-10 items-center overflow-hidden rounded-md border bg-background">
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
