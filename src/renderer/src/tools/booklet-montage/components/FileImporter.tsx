import { CircleStop, FileImage, FileText, RotateCcw } from 'lucide-react'
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
        <Button
          type="button"
          onClick={() => pdfInputRef.current?.click()}
          disabled={isBusy}
        >
          <FileText data-icon="inline-start" />
          Import PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => imageInputRef.current?.click()}
          disabled={isBusy}
        >
          <FileImage data-icon="inline-start" />
          Import JPG/PNG
        </Button>
        <Button type="button" variant="ghost" onClick={onClear} disabled={isBusy}>
          <RotateCcw data-icon="inline-start" />
          New Project
        </Button>
        {canCancel && (
          <Button type="button" variant="outline" onClick={onCancelImport}>
            <CircleStop data-icon="inline-start" />
            Cancel
          </Button>
        )}
      </div>

      <ProgressLine progress={importProgress} />

      <PdfFilePickerInput
        ref={pdfInputRef}
        onFilesSelected={onImportPdf}
      />
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
