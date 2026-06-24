import {
  BookOpen,
  CircleStop,
  Files,
  FileDown,
  FileImage,
  FileText,
  Grid2X2,
  ImageDown,
  LayoutGrid,
  Plus,
  RotateCcw
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import { PdfFilePickerInput } from '@/components/file-input/PdfFilePickerInput'
import { Button } from '@/components/ui/button'
import type {
  BookletScaleMode,
  BookletViewMode,
  ExportProgress,
  ImportProgress,
  BookletReadingDirection,
  PaperOrientation,
  PaperSizeOption,
  SheetSettings
} from '../types'
import { ProgressLine } from './ProgressLine'

interface BookletToolbarProps {
  settings: SheetSettings
  viewMode: BookletViewMode
  blanksNeeded: number
  hasBoardItems: boolean
  canExport: boolean
  isBusy: boolean
  importProgress: ImportProgress
  exportProgress: ExportProgress
  onImportPdf: (files: File[]) => void
  onImportImages: (files: File[]) => void
  onCancelImport: () => void
  onCancelExport: () => void
  onClear: () => void
  onSettingsChange: (settings: Partial<SheetSettings>) => void
  onAutoAddBlankPages: () => void
  onAddEmptySheet: () => void
  onResetSheetLayout: () => void
  onExportPdf: () => void
  onExportImages: (format: 'png' | 'jpg') => void
  onViewModeChange: (viewMode: BookletViewMode) => void
}

const paperOptions: PaperSizeOption[] = ['A4', 'A3', 'SRA3', 'custom']
const orientationOptions: PaperOrientation[] = ['portrait', 'landscape']
const readingDirectionOptions: Array<{ value: BookletReadingDirection; label: string }> = [
  { value: 'ltr', label: 'LTR' },
  { value: 'rtl', label: 'RTL / Arabic' }
]
const scaleOptions: Array<{ value: BookletScaleMode; label: string }> = [
  { value: 'fit', label: 'Fit' },
  { value: 'original', label: 'Original' },
  { value: 'stretch', label: 'Stretch' }
]
const viewModes: Array<{ value: BookletViewMode; label: string; icon: typeof Grid2X2 }> = [
  { value: 'sheet', label: 'Sheet Mode', icon: Files },
  { value: 'montage', label: 'Montage Mode', icon: Grid2X2 },
  { value: 'book', label: '3D Book Mode', icon: BookOpen }
]

export function BookletToolbar({
  settings,
  viewMode,
  blanksNeeded,
  hasBoardItems,
  canExport,
  isBusy,
  importProgress,
  exportProgress,
  onImportPdf,
  onImportImages,
  onCancelImport,
  onCancelExport,
  onClear,
  onSettingsChange,
  onAutoAddBlankPages,
  onAddEmptySheet,
  onResetSheetLayout,
  onExportPdf,
  onExportImages,
  onViewModeChange
}: BookletToolbarProps): JSX.Element {
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const importCanCancel =
    importProgress.phase === 'reading' ||
    importProgress.phase === 'loading-page' ||
    importProgress.phase === 'generating-thumbnails' ||
    importProgress.phase === 'rendering'
  const exportCanCancel =
    exportProgress.phase === 'preparing-pages' ||
    exportProgress.phase === 'rendering-page' ||
    exportProgress.phase === 'creating-pdf'

  return (
    <div className="sticky top-0 z-10 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" onClick={() => pdfInputRef.current?.click()} disabled={isBusy}>
          <FileText data-icon="inline-start" />
          PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => imageInputRef.current?.click()}
          disabled={isBusy}
        >
          <FileImage data-icon="inline-start" />
          Images
        </Button>
        <Button type="button" variant="ghost" onClick={onClear} disabled={isBusy}>
          <RotateCcw data-icon="inline-start" />
          New
        </Button>

        <ToolbarSelect
          label="Paper"
          value={settings.paperSize}
          onChange={(value) => onSettingsChange({ paperSize: value as PaperSizeOption })}
        >
          {paperOptions.map((option) => (
            <option key={option} value={option}>
              {option === 'custom' ? 'Custom' : option}
            </option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          label="Orientation"
          value={settings.orientation}
          onChange={(value) => onSettingsChange({ orientation: value as PaperOrientation })}
        >
          {orientationOptions.map((option) => (
            <option key={option} value={option}>
              {option[0].toUpperCase()}
              {option.slice(1)}
            </option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          label="Reading"
          value={settings.readingDirection}
          onChange={(value) =>
            onSettingsChange({ readingDirection: value as BookletReadingDirection })
          }
        >
          {readingDirectionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ToolbarSelect>

        {settings.paperSize === 'custom' && (
          <>
            <ToolbarNumber
              label="Width"
              value={settings.customWidthMm}
              onChange={(value) => onSettingsChange({ customWidthMm: value })}
            />
            <ToolbarNumber
              label="Height"
              value={settings.customHeightMm}
              onChange={(value) => onSettingsChange({ customHeightMm: value })}
            />
          </>
        )}

        <ToolbarSelect
          label="Scale"
          value={settings.scaleMode}
          onChange={(value) => onSettingsChange({ scaleMode: value as BookletScaleMode })}
        >
          {scaleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ToolbarSelect>

        <div className="flex rounded-md border bg-muted/40 p-1">
          {viewModes.map((mode) => {
            const Icon = mode.icon

            return (
              <Button
                key={mode.value}
                type="button"
                size="sm"
                variant={viewMode === mode.value ? 'default' : 'ghost'}
                onClick={() => onViewModeChange(mode.value)}
              >
                <Icon data-icon="inline-start" />
                {mode.label}
              </Button>
            )
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onAutoAddBlankPages}
          disabled={blanksNeeded === 0 || isBusy}
        >
          Auto blanks
        </Button>
        {viewMode === 'montage' && (
          <>
            <Button type="button" variant="outline" onClick={onAddEmptySheet} disabled={isBusy}>
              <Plus data-icon="inline-start" />
              Add Empty Sheet
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onResetSheetLayout}
              disabled={!hasBoardItems || isBusy}
            >
              <LayoutGrid data-icon="inline-start" />
              Reset layout
            </Button>
          </>
        )}
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
          Export Images
        </Button>
        {(importCanCancel || exportCanCancel) && (
          <Button
            type="button"
            variant="outline"
            onClick={importCanCancel ? onCancelImport : onCancelExport}
          >
            <CircleStop data-icon="inline-start" />
            Cancel
          </Button>
        )}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <ProgressLine progress={importProgress} />
        <ProgressLine progress={exportProgress} />
      </div>

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

function ToolbarSelect({
  label,
  value,
  onChange,
  children
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}): JSX.Element {
  return (
    <label className="flex min-w-[126px] flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  )
}

function ToolbarNumber({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <label className="flex w-24 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"
        type="number"
        min={1}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
