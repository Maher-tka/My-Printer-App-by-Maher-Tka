import { ActionIcon } from '@/components/ui/action-button'
import { useLanguage } from '@/i18n/useLanguage'
import { CircleStop } from 'lucide-react'
import { useRef } from 'react'
import { PdfFilePickerInput } from '@/components/file-input/PdfFilePickerInput'
import { Button } from '@/components/ui/button'
import type { ImportProgress } from '../types'
import { ProgressLine } from './ProgressLine'

interface FileImporterProps {
  importProgress: ImportProgress
  isBusy: boolean
  onImportPdf: (files: File[]) => void
  onImportImages: (files: File[]) => void
  onCancelImport: () => void
  onClear: () => void
}

export function FileImporter({
  importProgress,
  isBusy,
  onImportPdf,
  onImportImages,
  onCancelImport,
  onClear
}: FileImporterProps): JSX.Element {
  const { t } = useLanguage()

  const pdfInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const canCancel =
    importProgress.phase === 'reading' ||
    importProgress.phase === 'loading-page' ||
    importProgress.phase === 'generating-thumbnails' ||
    importProgress.phase === 'rendering'

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => pdfInputRef.current?.click()} disabled={isBusy}>
          <ActionIcon action="import" />
          {t('Import PDF')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => imageInputRef.current?.click()}
          disabled={isBusy}
        >
          <ActionIcon action="import" />
          {t('Import JPG/PNG')}
        </Button>
        <Button type="button" variant="ghost" onClick={onClear} disabled={isBusy}>
          <ActionIcon action="newProject" />
          {t('New Project')}
        </Button>
        {canCancel && (
          <Button type="button" variant="outline" onClick={onCancelImport}>
            <CircleStop data-icon="inline-start" />
            {t('Cancel')}
          </Button>
        )}
      </div>

      <ProgressLine progress={importProgress} />

      <PdfFilePickerInput ref={pdfInputRef} onFilesSelected={onImportPdf} />
      <input
        ref={imageInputRef}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        multiple
        onChange={(event) => {
          onImportImages(Array.from(event.target.files ?? []))
          event.currentTarget.value = ''
        }}
      />
    </div>
  )
}
