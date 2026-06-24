import { Download, FolderOutput } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { HardcoverExportMode, HardcoverExportSettings } from '../types'

export function ExportHardcoverPanel({
  settings,
  warnings,
  batchCount,
  isBusy,
  onChange,
  onPdf,
  onSvg,
  onImage,
  onBatchSeparate,
  onBatchCombined
}: {
  settings: HardcoverExportSettings
  warnings: string[]
  batchCount: number
  isBusy: boolean
  onChange: (patch: Partial<HardcoverExportSettings>) => void
  onPdf: () => void
  onSvg: () => void
  onImage: () => void
  onBatchSeparate: () => void
  onBatchCombined: () => void
}): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Print-ready export</h3>
          <p className="text-sm text-muted-foreground">
            Exact page size in millimeters. SVG keeps editable text and guides.
          </p>
        </div>
        <Badge variant={warnings.length ? 'warning' : 'success'}>
          {warnings.length ? `${warnings.length} warning(s)` : 'Preflight ready'}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
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
          label="Fold lines"
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
      {warnings.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs text-warning-foreground">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Button type="button" onClick={onPdf} disabled={isBusy}>
          <Download />
          PDF
        </Button>
        <Button type="button" variant="outline" onClick={onSvg} disabled={isBusy}>
          SVG
        </Button>
        <Button type="button" variant="outline" onClick={onImage} disabled={isBusy}>
          JPG preview
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onBatchSeparate}
          disabled={isBusy || batchCount === 0}
        >
          <FolderOutput />
          Batch folder
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onBatchCombined}
          disabled={isBusy || batchCount === 0}
        >
          Combined PDF
        </Button>
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
    <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}
