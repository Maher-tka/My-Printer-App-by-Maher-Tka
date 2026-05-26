import type { BookletScaleMode, PaperOrientation, PaperSizeOption, SheetSettings } from '../types'
import { getPrintSizeMm } from '../lib/printSizes'

interface SheetSettingsPanelProps {
  settings: SheetSettings
  onChange: (settings: Partial<SheetSettings>) => void
}

const paperOptions: PaperSizeOption[] = ['A4', 'A3', 'SRA3', 'custom']
const orientationOptions: PaperOrientation[] = ['portrait', 'landscape']
const scaleModes: Array<{ value: BookletScaleMode; label: string }> = [
  { value: 'fit', label: 'Fit' },
  { value: 'fill', label: 'Fill' },
  { value: 'stretch', label: 'Stretch' }
]

export function SheetSettingsPanel({
  settings,
  onChange
}: SheetSettingsPanelProps): JSX.Element {
  const paperSize = getPrintSizeMm(settings)

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="font-semibold">Sheet Settings</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Output size: {paperSize.widthMm} x {paperSize.heightMm} mm
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Paper size</span>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={settings.paperSize}
            onChange={(event) =>
              onChange({ paperSize: event.target.value as PaperSizeOption })
            }
          >
            {paperOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'custom' ? 'Custom' : option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Orientation</span>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={settings.orientation}
            onChange={(event) =>
              onChange({ orientation: event.target.value as PaperOrientation })
            }
          >
            {orientationOptions.map((option) => (
              <option key={option} value={option}>
                {option[0].toUpperCase()}
                {option.slice(1)}
              </option>
            ))}
          </select>
        </label>

        {settings.paperSize === 'custom' && (
          <>
            <NumberField
              label="Custom width"
              value={settings.customWidthMm}
              onChange={(value) => onChange({ customWidthMm: value })}
            />
            <NumberField
              label="Custom height"
              value={settings.customHeightMm}
              onChange={(value) => onChange({ customHeightMm: value })}
            />
          </>
        )}

        <NumberField
          label="Margin"
          value={settings.marginMm}
          onChange={(value) => onChange({ marginMm: value })}
        />
        <NumberField
          label="Gap between pages"
          value={settings.gapMm}
          onChange={(value) => onChange({ gapMm: value })}
        />
        <NumberField
          label="Bleed"
          value={settings.bleedMm}
          onChange={(value) => onChange({ bleedMm: value })}
        />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Scale mode</span>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={settings.scaleMode}
            onChange={(event) =>
              onChange({ scaleMode: event.target.value as BookletScaleMode })
            }
          >
            {scaleModes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={settings.cropMarks}
            onChange={(event) => onChange({ cropMarks: event.target.checked })}
          />
          <span className="font-medium">Add crop marks</span>
        </label>

        <label className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={settings.registrationMarks}
            onChange={(event) => onChange({ registrationMarks: event.target.checked })}
          />
          <span className="font-medium">Registration marks</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Export quality</span>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={settings.exportQuality}
            onChange={(event) =>
              onChange({ exportQuality: event.target.value as SheetSettings['exportQuality'] })
            }
          >
            <option value="standard">Standard</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>

      <div className="rounded-md border bg-muted/35 p-3 text-sm text-muted-foreground">
        Output side: front/back sheet pairs
      </div>
    </div>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
}

function NumberField({ label, value, onChange }: NumberFieldProps): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label} (mm)</span>
      <input
        className="h-10 rounded-md border bg-background px-3"
        type="number"
        min={0}
        step={0.5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
