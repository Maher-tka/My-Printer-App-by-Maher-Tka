import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExportCutterPanelProps {
  canExport: boolean
  onExportSvg: () => void
  onExportPdf: () => void
  onExportEps: () => void
}

export function ExportCutterPanel({
  canExport,
  onExportSvg,
  onExportPdf,
  onExportEps
}: ExportCutterPanelProps): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">Export</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        SVG keeps Artwork and CutContour groups. PDF/EPS keep vector cutlines with known layer limitations.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2">
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
