import { useLanguage } from '@/i18n/useLanguage'
import { BookOpen, CircleStop, Files, Grid2X2, LayoutGrid, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import { PdfFilePickerInput } from '@/components/file-input/PdfFilePickerInput'
import { Button } from '@/components/ui/button'
import { ActionIcon } from '@/components/ui/action-button'
import { WorkflowHint } from '@/components/ui/workflow-hint'
import { ToolSettingsTabs } from '../../shared/ToolSettingsTabs'
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
import { getSimpleCreepToggleSettings } from '../lib/creepCompensation'
import { ProgressLine } from './ProgressLine'

export interface BookletToolbarProps {
  variant?: 'actions' | 'properties'
  settings: SheetSettings
  viewMode: BookletViewMode
  blanksNeeded: number
  physicalSheetCount: number
  hasBoardItems: boolean
  canExport: boolean
  isBusy: boolean
  importProgress: ImportProgress
  exportProgress: ExportProgress
  onImportPdf: (files: File[]) => void
  onImportImages: (files: File[]) => void
  onCancelImport: () => void
  onCancelExport: () => void
  onSettingsChange: (settings: Partial<SheetSettings>) => void
  onAddEmptySheet: () => void
  onResetSheetLayout: () => void
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
  variant = 'actions',
  settings,
  viewMode,
  blanksNeeded,
  physicalSheetCount,
  hasBoardItems,
  canExport,
  isBusy,
  importProgress,
  exportProgress,
  onImportPdf,
  onImportImages,
  onCancelImport,
  onCancelExport,
  onSettingsChange,
  onAddEmptySheet,
  onResetSheetLayout,
  onExportImages,
  onViewModeChange
}: BookletToolbarProps): JSX.Element {
  const { t } = useLanguage()

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
  const hasPages = physicalSheetCount > 0 || blanksNeeded > 0 || hasBoardItems
  const nextAction = !hasPages
    ? 'import'
    : blanksNeeded > 0
      ? 'blanks'
      : viewMode === 'sheet'
        ? 'preview'
        : 'export'

  return (
    <div className="rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
      {variant === 'properties' && (
        <h3 className="mb-4 text-sm font-semibold">{t('Booklet settings')}</h3>
      )}
      <div
        className={
          variant === 'properties'
            ? 'grid gap-4 [&_label]:w-full [&_label]:min-w-0'
            : 'flex flex-wrap items-center gap-2'
        }
      >
        {variant === 'actions' && (
          <>
            <Button
              type="button"
              variant={nextAction === 'import' ? 'default' : 'outline'}
              onClick={() => pdfInputRef.current?.click()}
              disabled={isBusy}
            >
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
              {t('Import images')}
            </Button>
          </>
        )}
        {variant === 'properties' && (
          <ToolSettingsTabs
            label={t('Booklet settings')}
            advanced={
              <>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <ToolbarNumber
                    label={t('Outer margin mm')}
                    value={settings.outerMarginMm}
                    min={0}
                    step={0.5}
                    onChange={(value) => onSettingsChange({ outerMarginMm: value })}
                  />
                  <ToolbarNumber
                    label={t('Page gap mm')}
                    value={settings.pageGapMm}
                    min={0}
                    step={0.5}
                    onChange={(value) => onSettingsChange({ pageGapMm: value })}
                  />
                  <ToolbarCheckbox
                    label={t('Crop marks')}
                    checked={settings.cropMarks}
                    onChange={(cropMarks) => onSettingsChange({ cropMarks })}
                  />
                  <ToolbarCheckbox
                    label={t('Registration marks')}
                    checked={settings.registrationMarks}
                    onChange={(registrationMarks) => onSettingsChange({ registrationMarks })}
                  />
                </div>
                <ToolbarCheckbox
                  label={t('Creep Compensation')}
                  checked={settings.creep.enabled}
                  title={t(
                    'Shift inner-sheet artwork progressively toward the saddle-stitch spine.'
                  )}
                  onChange={(enabled) =>
                    onSettingsChange({
                      creep: getSimpleCreepToggleSettings(
                        settings.creep,
                        enabled,
                        physicalSheetCount
                      )
                    })
                  }
                />
                <div className="grid gap-2 border-t pt-3">
                  <h4 className="text-xs font-semibold">{t('Image exports')}</h4>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onExportImages('png')}
                    disabled={!canExport || isBusy}
                  >
                    <ActionIcon action="export" />
                    {t('PNG Sheets')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onExportImages('jpg')}
                    disabled={!canExport || isBusy}
                  >
                    <ActionIcon action="export" />
                    {t('JPG Sheets')}
                  </Button>
                </div>
              </>
            }
          >
            <div className="grid gap-4">
              <ToolbarSelect
                label={t('Paper')}
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
                label={t('Orientation')}
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
                    {t(option.label)}
                  </option>
                ))}
              </ToolbarSelect>

              {settings.paperSize === 'custom' && (
                <>
                  <ToolbarNumber
                    label={t('Width')}
                    value={settings.customWidthMm}
                    onChange={(value) => onSettingsChange({ customWidthMm: value })}
                  />
                  <ToolbarNumber
                    label={t('Height')}
                    value={settings.customHeightMm}
                    onChange={(value) => onSettingsChange({ customHeightMm: value })}
                  />
                </>
              )}

              <ToolbarSelect
                label={t('Scale')}
                value={settings.scaleMode}
                onChange={(value) => onSettingsChange({ scaleMode: value as BookletScaleMode })}
              >
                {scaleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </ToolbarSelect>
            </div>
          </ToolSettingsTabs>
        )}
        {variant === 'actions' && (
          <>
            <div className="flex flex-wrap rounded-[14px] border border-border/60 bg-muted/40 p-1">
              {viewModes.map((mode) => {
                const Icon = mode.icon

                return (
                  <Button
                    key={mode.value}
                    type="button"
                    size="sm"
                    variant={viewMode === mode.value ? 'selected' : 'ghost'}
                    aria-pressed={viewMode === mode.value}
                    onClick={() => onViewModeChange(mode.value)}
                  >
                    <Icon data-icon="inline-start" />
                    {mode.label}
                  </Button>
                )
              })}
            </div>

            {viewMode === 'montage' && (
              <div className="basis-full border-t border-[var(--ui-divider)]" aria-hidden="true" />
            )}

            {viewMode === 'montage' && (
              <>
                <Button type="button" variant="outline" onClick={onAddEmptySheet} disabled={isBusy}>
                  <Plus data-icon="inline-start" />
                  {t('Add Empty Sheet')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResetSheetLayout}
                  disabled={!hasBoardItems || isBusy}
                >
                  <LayoutGrid data-icon="inline-start" />
                  {t('Reset layout')}
                </Button>
              </>
            )}

            {(importCanCancel || exportCanCancel) && (
              <Button
                type="button"
                variant="outline"
                onClick={importCanCancel ? onCancelImport : onCancelExport}
              >
                <CircleStop data-icon="inline-start" />
                {t('Cancel')}
              </Button>
            )}
          </>
        )}
      </div>

      {variant === 'actions' && (
        <>
          {(isBusy || (nextAction !== 'import' && nextAction !== 'blanks')) && (
            <WorkflowHint className="mt-3">
              {isBusy
                ? 'Please wait while your files are processed.'
                : nextAction === 'preview'
                  ? 'Check the page order, then open Montage Mode to review the print sheets.'
                  : 'Review the print sheets and paper settings, then export your PDF or print.'}
            </WorkflowHint>
          )}
          <div
            className={
              importProgress.phase === 'idle' && exportProgress.phase === 'idle'
                ? 'sr-only'
                : 'mt-3 grid gap-2 lg:grid-cols-2'
            }
          >
            {importProgress.phase === 'idle' && exportProgress.phase === 'idle' ? (
              <p className="text-sm text-muted-foreground">
                {t('Ready for local PDF or image input.')}
              </p>
            ) : (
              <>
                {importProgress.phase !== 'idle' && <ProgressLine progress={importProgress} />}
                {exportProgress.phase !== 'idle' && <ProgressLine progress={exportProgress} />}
              </>
            )}
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
        </>
      )}
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
  const { t } = useLanguage()

  return (
    <label className="flex min-w-[126px] flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t(label)}
      <select
        className="h-9 rounded-[14px] border border-border/70 bg-background px-3 text-[13px] text-foreground"
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
  min = 1,
  step = 1,
  onChange
}: {
  label: string
  value: number
  min?: number
  step?: number
  onChange: (value: number) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex w-24 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t(label)}
      <input
        className="h-9 rounded-[14px] border border-border/70 bg-background px-3 text-[13px] text-foreground"
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function ToolbarCheckbox({
  label,
  checked,
  title,
  onChange
}: {
  label: string
  checked: boolean
  title?: string
  onChange: (checked: boolean) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label
      className="flex min-h-9 items-center gap-2 text-[13px] font-medium text-foreground"
      title={title}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {t(label)}
    </label>
  )
}
