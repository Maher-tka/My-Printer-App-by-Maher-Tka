import { Download, Info, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { HardcoverExportMode, HardcoverExportSettings, HardcoverPdfSource } from '../types'
import { hasHardcoverPdfSourceBytes } from '../lib/sourcePdf'

export function ExportHardcoverPanel({
  settings,
  warnings,
  sourcePdf,
  isBusy,
  onChange,
  onPdf,
  onPrint,
  onSvg,
  onImage
}: {
  settings: HardcoverExportSettings
  warnings: string[]
  sourcePdf?: HardcoverPdfSource
  isBusy: boolean
  onChange: (patch: Partial<HardcoverExportSettings>) => void
  onPdf: () => void
  onPrint: () => void
  onSvg: () => void
  onImage: () => void
}): JSX.Element {
  const sourceReady = !sourcePdf || hasHardcoverPdfSourceBytes(sourcePdf)

  return (
    <section className="@container/export-panel rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Print-ready export</h3>
          <p className="text-sm text-muted-foreground">
            Exact page size in millimeters. SVG keeps editable text and guides.
          </p>
        </div>
        <Badge variant={!sourceReady || warnings.length ? 'warning' : 'success'}>
          {!sourceReady
            ? 'Source PDF needed'
            : warnings.length
              ? `${warnings.length} warning(s)`
              : 'Preflight ready'}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 @sm/export-panel:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Export mode
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={settings.mode}
            onChange={(event) => onChange({ mode: event.target.value as HardcoverExportMode })}
          >
            <option value="print-final">Print Final</option>
            <option value="production-guide">Production Guide</option>
            <option value="customer-preview">Customer Preview</option>
          </select>
        </label>
        <Toggle
          label="Binding edge marks"
          checked={settings.includeFoldLines}
          onChange={(includeFoldLines) => onChange({ includeFoldLines })}
        />
        <Toggle
          label="Crop marks"
          checked={settings.includeCropMarks}
          onChange={(includeCropMarks) => onChange({ includeCropMarks })}
        />
        <Toggle
          label="Safe zones"
          checked={settings.includeSafeZones}
          onChange={(includeSafeZones) => onChange({ includeSafeZones })}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Preview quality
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={settings.imageQuality}
            onChange={(event) =>
              onChange({
                imageQuality: event.target.value as HardcoverExportSettings['imageQuality']
              })
            }
          >
            <option value="low">Low-end PC</option>
            <option value="balanced">Balanced</option>
            <option value="high">High quality</option>
          </select>
        </label>
      </div>
      {sourcePdf && !sourceReady && (
        <div className="mt-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-xs text-warning-foreground">
          <p className="font-medium">Source PDF must be re-uploaded before export.</p>
          <p className="mt-1">
            {sourcePdf.sourceMode === 'separate'
              ? 'This saved project keeps the selected front/back pages, but their PDF bytes are runtime-only. Re-upload the independent front and back files in the Source PDF step.'
              : 'This saved project keeps the selected pages, but the original PDF bytes are runtime-only. Re-upload the mémoire PDF in the Source PDF step.'}
          </p>
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs text-warning-foreground">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button className="w-full" type="button" onClick={onPdf} disabled={isBusy || !sourceReady}>
          <Download />
          PDF
        </Button>
        <Button
          className="w-full"
          type="button"
          onClick={onPrint}
          disabled={isBusy || !sourceReady}
        >
          <Printer />
          Print
        </Button>
        <Button
          className="w-full"
          type="button"
          variant="outline"
          onClick={onSvg}
          disabled={isBusy || !sourceReady}
        >
          SVG
        </Button>
        <Button
          className="w-full"
          type="button"
          variant="outline"
          onClick={onImage}
          disabled={isBusy || !sourceReady}
        >
          JPG Preview
        </Button>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          Print opens the printer driver, where you can choose tray, paper, duplex, color, and
          scaling.
        </p>
      </div>
    </section>
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
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}
