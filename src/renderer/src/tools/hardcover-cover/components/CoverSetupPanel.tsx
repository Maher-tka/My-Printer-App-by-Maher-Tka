import { AlertTriangle, Ruler } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CoverDimensions, CoverSetup } from '../types'
import { applyCoverPreset } from '../lib/coverCalculations'
import { formatMeasurement, fromMillimeters, toMillimeters } from '../lib/units'

interface CoverSetupPanelProps {
  setup: CoverSetup
  dimensions: CoverDimensions
  onChange: (patch: Partial<CoverSetup>) => void
}

export function CoverSetupPanel({
  setup,
  dimensions,
  onChange
}: CoverSetupPanelProps): JSX.Element {
  const unit = setup.unit
  const measure = (valueMm: number): number => Number(fromMillimeters(valueMm, unit).toFixed(2))
  const setMeasure = (
    key: keyof Pick<
      CoverSetup,
      | 'bookWidthMm'
      | 'bookHeightMm'
      | 'spineWidthMm'
      | 'hingeMm'
      | 'bleedMm'
      | 'paperWidthMm'
      | 'paperHeightMm'
    >,
    value: number
  ): void =>
    onChange({
      [key]: Math.max(0, toMillimeters(value, unit)),
      preset: key.startsWith('book') ? 'custom' : setup.preset
    })
  const setWrap = (key: keyof CoverSetup['wrap'], value: number): void =>
    onChange({ wrap: { ...setup.wrap, [key]: Math.max(0, toMillimeters(value, unit)) } })

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Cover setup</h3>
          <p className="text-sm text-muted-foreground">
            Enter the finished glued book block measurements.
          </p>
        </div>
        <Ruler className="text-primary" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <SelectField
          label="Book preset"
          value={setup.preset}
          onChange={(value) => onChange(applyCoverPreset(setup, value as CoverSetup['preset']))}
          options={[
            ['a4', 'A4 mémoire'],
            ['a5', 'A5 mémoire'],
            ['custom', 'Custom']
          ]}
        />
        <SelectField
          label="Unit"
          value={unit}
          onChange={(value) => onChange({ unit: value as CoverSetup['unit'] })}
          options={[
            ['cm', 'Centimeters'],
            ['mm', 'Millimeters']
          ]}
        />
        <NumberField
          label="Book width"
          value={measure(setup.bookWidthMm)}
          suffix={unit}
          onChange={(value) => setMeasure('bookWidthMm', value)}
        />
        <NumberField
          label="Book height"
          value={measure(setup.bookHeightMm)}
          suffix={unit}
          onChange={(value) => setMeasure('bookHeightMm', value)}
        />
        <NumberField
          label="Spine thickness"
          value={measure(setup.spineWidthMm)}
          suffix={unit}
          onChange={(value) => setMeasure('spineWidthMm', value)}
        />
        <NumberField
          label="Hinge / safe zone"
          value={measure(setup.hingeMm)}
          suffix={unit}
          onChange={(value) => setMeasure('hingeMm', value)}
        />
        <NumberField
          label="Wrap top"
          value={measure(setup.wrap.topMm)}
          suffix={unit}
          onChange={(value) => setWrap('topMm', value)}
        />
        <NumberField
          label="Wrap bottom"
          value={measure(setup.wrap.bottomMm)}
          suffix={unit}
          onChange={(value) => setWrap('bottomMm', value)}
        />
        <NumberField
          label="Wrap left"
          value={measure(setup.wrap.leftMm)}
          suffix={unit}
          onChange={(value) => setWrap('leftMm', value)}
        />
        <NumberField
          label="Wrap right"
          value={measure(setup.wrap.rightMm)}
          suffix={unit}
          onChange={(value) => setWrap('rightMm', value)}
        />
        <NumberField
          label="Bleed"
          value={measure(setup.bleedMm)}
          suffix={unit}
          onChange={(value) => setMeasure('bleedMm', value)}
        />
        <div />
        <NumberField
          label="Output paper width"
          value={measure(setup.paperWidthMm)}
          suffix={unit}
          onChange={(value) => setMeasure('paperWidthMm', value)}
        />
        <NumberField
          label="Output paper height"
          value={measure(setup.paperHeightMm)}
          suffix={unit}
          onChange={(value) => setMeasure('paperHeightMm', value)}
        />
      </div>
      <div className="mt-4 rounded-md bg-primary/8 p-3">
        <p className="text-xs font-medium text-muted-foreground">Generated physical sheet</p>
        <p className="mt-1 text-lg font-semibold">
          {formatMeasurement(dimensions.fullWidthMm, unit)} ×{' '}
          {formatMeasurement(dimensions.fullHeightMm, unit)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">
            Front {formatMeasurement(dimensions.front.widthMm, unit)}
          </Badge>
          <Badge variant="secondary">
            Spine {formatMeasurement(dimensions.spine.widthMm, unit)}
          </Badge>
          <Badge variant="secondary">{dimensions.orientation}</Badge>
        </div>
      </div>
      {dimensions.warnings.map((warning) => (
        <div
          key={warning}
          className="mt-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {warning}
        </div>
      ))}
    </section>
  )
}

function NumberField({
  label,
  value,
  suffix,
  onChange
}: {
  label: string
  value: number
  suffix: string
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <span className="flex overflow-hidden rounded-md border bg-background">
        <input
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-foreground outline-none"
          type="number"
          min={0}
          step={suffix === 'cm' ? 0.1 : 1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="border-l px-2 py-2">{suffix}</span>
      </span>
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}
