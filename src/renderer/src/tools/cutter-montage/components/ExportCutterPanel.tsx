import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CutterExportSettings } from '../types'

interface ExportCutterPanelProps {
  canExport: boolean
  onExportSvg: () => void
  onExportPdf: () => void
  onExportEps: () => void
  settings: CutterExportSettings
  onModeChange: (mode: NonNullable<CutterExportSettings['mode']>) => void
}

export function ExportCutterPanel({
  canExport,
  onExportSvg,
  onExportPdf,
  onExportEps,
  settings,
  onModeChange
}: ExportCutterPanelProps): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">Export</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        SVG keeps Artwork and CutContour groups. PDF/EPS keep vector cutlines with known layer
        limitations.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Export mode
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={settings.mode ?? 'print-cut'}
            onChange={(event) =>
              onModeChange(event.target.value as NonNullable<CutterExportSettings['mode']>)
            }
          >
            <option value="print-cut">Print + Cut</option>
            <option value="print-only">Print only</option>
            <option value="cut-only">Cut only</option>
          </select>
        </label>
        <Button type="button" onClick={onExportSvg} disabled={!canExport}>
          <Download data-icon="inline-start" />
          Export SVG
        </Button>
        <Button type="button" variant="outline" onClick={onExportPdf} disabled={!canExport}>
          Export PDF
        </Button>
        <Button type="button" variant="outline" onClick={onExportEps} disabled={!canExport}>
          Export EPS
        </Button>
      </div>
    </section>
  )
}
