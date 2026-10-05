import { ActionIcon } from '@/components/ui/action-button'
import { useLanguage } from '@/i18n/useLanguage'
import { CircleStop } from 'lucide-react'
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
  const { t } = useLanguage()

  const canCancel =
    exportProgress.phase === 'preparing-pages' ||
    exportProgress.phase === 'rendering-page' ||
    exportProgress.phase === 'creating-pdf'

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="font-semibold">{t('Export')}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onExportPdf} disabled={!canExport || isBusy}>
          <ActionIcon action="export" />
          {t('Export PDF')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onExportImages('png')}
          disabled={!canExport || isBusy}
        >
          <ActionIcon action="export" />
          {t('PNG sheets')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onExportImages('jpg')}
          disabled={!canExport || isBusy}
        >
          <ActionIcon action="export" />
          {t('JPG sheets')}
        </Button>
        {canCancel && (
          <Button type="button" variant="outline" onClick={onCancelExport}>
            <CircleStop data-icon="inline-start" />
            {t('Cancel')}
          </Button>
        )}
      </div>
      <ProgressLine
        progress={exportProgress}
        idleMessage={
          canExport
            ? 'Ready to export. Choose PDF for printing, or PNG/JPG for individual sheet images.'
            : 'Import pages and prepare your sheets to enable export.'
        }
      />
    </div>
  )
}
