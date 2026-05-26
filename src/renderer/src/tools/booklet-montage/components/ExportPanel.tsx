import { CircleStop, FileDown, ImageDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ExportProgress } from '../types'
import { ProgressLine } from './ProgressLine'

interface ExportPanelProps {
  exportProgress: ExportProgress
  canExport: boolean
  isBusy: boolean
  onExportPdf: () => void
  onExportImages: (format: 'png' | 'jpg') => void
  onCancelExport: () => void
}

export function ExportPanel({
  exportProgress,
  canExport,
  isBusy,
  onExportPdf,
  onExportImages,
  onCancelExport
}: ExportPanelProps): JSX.Element {
  const canCancel =
    exportProgress.phase === 'preparing-pages' ||
    exportProgress.phase === 'rendering-page' ||
    exportProgress.phase === 'creating-pdf'

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="font-semibold">Export</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Exports use the selected paper size and millimeter settings.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onExportPdf} disabled={!canExport || isBusy}>
          <FileDown data-icon="inline-start" />
          Export PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onExportImages('png')}
          disabled={!canExport || isBusy}
        >
          <ImageDown data-icon="inline-start" />
          PNG sheets
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onExportImages('jpg')}
          disabled={!canExport || isBusy}
        >
          <ImageDown data-icon="inline-start" />
          JPG sheets
        </Button>
        {canCancel && (
          <Button type="button" variant="outline" onClick={onCancelExport}>
            <CircleStop data-icon="inline-start" />
            Cancel
          </Button>
        )}
      </div>
      <ProgressLine progress={exportProgress} />
    </div>
  )
}
