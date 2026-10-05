import { ActionIcon } from '@/components/ui/action-button'
import { useLanguage } from '@/i18n/useLanguage'
import { FolderDown, Printer, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToolSettingsTabs } from '../../shared/ToolSettingsTabs'
import { CUTTER_EXPORT_PRESETS, type CutterExportPresetId } from '../lib/exportPresets'
import { TARGET_CUTTER_LABEL } from '../lib/cutterDeviceProfile'
import { getCutterSheetPdfFileName } from '../../../../../shared/illustrator-pdf-export'
import type {
  CutterExportSettings,
  CutterSheetSettings,
  ProductionLabelPosition,
  ProductionLabelSize
} from '../types'

interface ExportCutterPanelProps {
  onPrepareFineCut: () => void
  fineCutBusy: boolean
  layoutNumber: number
  repeatCount?: number
  layoutCount?: number
  onExportAllSheetPdfs?: () => void
  canExport: boolean
  onExportSvg: () => void
  onExportPdf: () => void
  onExportEps: () => void
  onBatchExport: () => void
  settings: CutterExportSettings
  sheet: CutterSheetSettings
  onModeChange: (mode: NonNullable<CutterExportSettings['mode']>) => void
  onSettingsChange: (settings: Partial<CutterExportSettings>) => void
  onSheetChange: (settings: Partial<CutterSheetSettings>) => void
  onPresetChange: (presetId: CutterExportPresetId) => void
}

export function ExportCutterPanel({
  onPrepareFineCut,
  fineCutBusy,
  layoutNumber,
  repeatCount = 1,
  layoutCount = 1,
  onExportAllSheetPdfs,
  canExport,
  onExportSvg,
  onExportPdf,
  onExportEps,
  onBatchExport,
  settings,
  sheet,
  onModeChange,
  onSettingsChange,
  onSheetChange,
  onPresetChange
}: ExportCutterPanelProps): JSX.Element {
  const { t } = useLanguage()

  const label = sheet.productionLabel!
  const registration = sheet.registrationMarks!
  const nativePdf = (settings.mode ?? 'print-cut') === 'print-cut'

  return (
    <section className="space-y-3" aria-label="Production export options">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t('Production Export')}</h3>
        </div>
        <Printer className="size-5 text-muted-foreground" />
      </div>

      <div className="mt-4 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <strong>Target: {TARGET_CUTTER_LABEL}</strong>
        <span className="mt-1 block text-xs text-muted-foreground">
          Offline Mimaki package · Cutter connection can be validated later at the office
        </span>
      </div>

      <ToolSettingsTabs
        label={t('Cutter export settings')}
        advanced={
          <>
            {' '}
            <div className="grid gap-3 border-t p-3">
              <div className="grid gap-3 border-b pb-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Settings2 className="size-4" />
                  {t('Export Checklist')}
                </div>
                <ChecklistItem checked={settings.includeArtwork} label={t('Artwork layer')} />
                <ChecklistItem checked={settings.includeCutlines} label={t('CutContour layer')} />
                <ChecklistItem
                  checked={settings.strokeName === 'CutContour'}
                  label="Stroke name CutContour"
                />
                <ChecklistItem
                  checked={registration.enabled && settings.includeRegistrationMarks !== false}
                  label="Automatic Mimaki Type 1 marks"
                />
                <ChecklistItem
                  checked={Boolean(label.enabled && settings.includeProductionLabel !== false)}
                  label="Production label"
                />
              </div>

              <div className="mt-4 grid gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  {t('Export mode')}
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={settings.mode ?? 'print-cut'}
                    onChange={(event) =>
                      onModeChange(event.target.value as NonNullable<CutterExportSettings['mode']>)
                    }
                  >
                    <option value="print-cut">{t('Print + Cut')}</option>
                    <option value="print-only">{t('Print only')}</option>
                    <option value="cut-only">{t('Cut only')}</option>
                    <option value="test-cut">{t('Test cut')}</option>
                    <option value="customer-preview">{t('Customer preview')}</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  CutContour spot
                  <input
                    className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                    value={settings.strokeName}
                    onChange={(event) => onSettingsChange({ strokeName: event.target.value })}
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <Toggle
                    label={t('Artwork')}
                    checked={settings.includeArtwork}
                    onChange={(includeArtwork) => onSettingsChange({ includeArtwork })}
                  />
                  <Toggle
                    label={t('Cutlines')}
                    checked={settings.includeCutlines}
                    onChange={(includeCutlines) => onSettingsChange({ includeCutlines })}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t pt-3">
                <Toggle
                  label="Automatic Mimaki Type 1 marks"
                  checked={registration.enabled}
                  onChange={(enabled) =>
                    onSheetChange({
                      registrationMarks: {
                        ...registration,
                        enabled,
                        type: 'mimaki',
                        includeIn: 'artwork'
                      }
                    })
                  }
                />
                <NumberField
                  label={t('Registration arm length')}
                  suffix="mm"
                  value={registration.sizeMm}
                  min={5}
                  max={30}
                  step={1}
                  onChange={(sizeMm) =>
                    onSheetChange({
                      registrationMarks: {
                        ...registration,
                        enabled: true,
                        type: 'mimaki',
                        sizeMm,
                        marginMm: 0,
                        includeIn: 'artwork'
                      }
                    })
                  }
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Default: 10 mm arms, 1 mm black line, four corners and a feed-direction
                  triangle—matched to your proven FineCut production files. Marks print with the
                  artwork and never enter the cut-only files.
                </p>
              </div>

              <div className="mt-4 grid gap-3 border-t pt-3">
                <Toggle
                  label="Production label"
                  checked={label.enabled}
                  onChange={(enabled) => onSheetChange({ productionLabel: { ...label, enabled } })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <SelectField
                    label={t('Position')}
                    value={label.position}
                    options={[
                      ['top-left', 'Top left'],
                      ['top-right', 'Top right'],
                      ['bottom-left', 'Bottom left'],
                      ['bottom-right', 'Bottom right']
                    ]}
                    onChange={(position) =>
                      onSheetChange({
                        productionLabel: { ...label, position: position as ProductionLabelPosition }
                      })
                    }
                  />
                  <SelectField
                    label={t('Size')}
                    value={label.size}
                    options={[
                      ['small', 'Small'],
                      ['medium', 'Medium']
                    ]}
                    onChange={(size) =>
                      onSheetChange({
                        productionLabel: { ...label, size: size as ProductionLabelSize }
                      })
                    }
                  />
                </div>
                <SelectField
                  label={t('Placement')}
                  value={label.placement}
                  options={[
                    ['margin', 'Sheet margin'],
                    ['inside-sheet', 'Inside sheet']
                  ]}
                  onChange={(placement) =>
                    onSheetChange({
                      productionLabel: {
                        ...label,
                        placement: placement as 'margin' | 'inside-sheet'
                      }
                    })
                  }
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <p className="rounded-md border border-success-foreground/15 bg-success px-3 py-2 text-xs text-success-foreground">
                {nativePdf
                  ? 'Illustrator PDF: Artwork and registration marks are separate visible layers. CutContour is included as a hidden, non-printing layer; enable its eye in Illustrator to inspect the cutting paths.'
                  : settings.mode === 'print-only'
                    ? 'Print-only PDF contains artwork and marks. Choose Illustrator Print + Cut PDF to include editable cutting paths.'
                    : 'Uses the selected output mode. Customer preview contours are not production cutting paths.'}
              </p>
              <div className="space-y-2 rounded-lg border p-3">
                <strong className="text-sm">Cutting on the work PC</strong>
                <p className="text-xs text-muted-foreground">
                  Prepare layout {layoutNumber} in Illustrator with native artwork, cut and
                  registration layers. Print its generated PDF, then use FineCut Plot and Detect
                  Mark with the USB cutter.
                </p>
                <Button
                  className="h-auto min-h-9 w-full whitespace-normal py-2 text-center"
                  type="button"
                  variant="outline"
                  disabled={!canExport || fineCutBusy}
                  onClick={onPrepareFineCut}
                >
                  {fineCutBusy ? 'Preparing in Illustrator...' : 'Prepare in Illustrator / FineCut'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  This prepares files and opens Illustrator. It does not send a cut or bypass
                  FineCut activation. Standalone USB cutting is not yet implemented.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onBatchExport}
                disabled={!canExport}
                className="h-auto min-h-9 whitespace-normal py-2 text-center"
              >
                <FolderDown data-icon="inline-start" />
                {t('Export Mimaki Job Folder')}
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">
                The app-generated marks match the measured geometry and spot names in your reference
                PDFs. FineCut mark detection still needs a physical work-PC test. Exact repeated
                sheets are exported once with PRINT/CUT repeat counts in their filenames.
              </p>
              <details className="rounded-md border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                  {t('Export a single format')}
                </summary>
                <div className="grid gap-2 border-t p-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onExportSvg}
                    disabled={!canExport}
                  >
                    <ActionIcon action="export" />
                    {t('Export SVG')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onExportEps}
                    disabled={!canExport}
                  >
                    {t('Export EPS CutContour Only')}
                  </Button>
                </div>
              </details>
            </div>
          </>
        }
      >
        <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('Output type')}
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={settings.preset}
            onChange={(event) => onPresetChange(event.target.value as CutterExportPresetId)}
          >
            {CUTTER_EXPORT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.title}
              </option>
            ))}
          </select>
        </label>

        <p className="rounded-md bg-muted/30 px-2 py-1 text-xs leading-relaxed">
          <strong>
            {t('Print')} {repeatCount} {repeatCount === 1 ? 'copy' : 'copies'}
          </strong>{' '}
          · {getCutterSheetPdfFileName(layoutNumber, repeatCount, settings.mode)}
        </p>
        <Button type="button" onClick={onExportPdf} disabled={!canExport} className="w-full">
          <ActionIcon action="export" />
          {fineCutBusy
            ? 'Preparing PDF...'
            : nativePdf
              ? 'Export Illustrator PDF'
              : t('Export PDF')}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {nativePdf
            ? `Requires Adobe Illustrator. Exports displayed layout ${layoutNumber} as one page and one artboard, with four corner marks and one direction arrow. Print at 100% / Actual size.`
            : `Save displayed layout ${layoutNumber} as one PDF page. Print-only PDF excludes cut paths. Print at 100% / Actual size.`}
        </p>

        {nativePdf && onExportAllSheetPdfs && (
          <Button
            type="button"
            onClick={onExportAllSheetPdfs}
            disabled={!canExport}
            variant="outline"
            className="h-auto min-h-9 w-full whitespace-normal py-2"
          >
            <FolderDown data-icon="inline-start" />
            {t('Export all')} {layoutCount} sheet PDF{layoutCount === 1 ? '' : 's'} separately
          </Button>
        )}
        <p className="rounded-md border bg-muted/30 p-2 text-xs leading-relaxed text-muted-foreground">
          Operator:{' '}
          <strong>{getCutterSheetPdfFileName(layoutNumber, repeatCount, settings.mode)}</strong>{' '}
          means print this sheet{' '}
          <strong>
            {repeatCount} {repeatCount === 1 ? 'time' : 'times'}
          </strong>
          . Each unique sheet is a separate one-page PDF. Identical sheets share one file; x6 means
          six printed copies. Print at 100% / Actual size.
        </p>
      </ToolSettingsTabs>
    </section>
  )
}

function ChecklistItem({ checked, label }: { checked: boolean; label: string }): JSX.Element {
  const { t } = useLanguage()

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span>{t(label)}</span>
      <span
        className={`size-2 rounded-full ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
        aria-hidden="true"
      />
    </div>
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
  const { t } = useLanguage()

  return (
    <label className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2 text-sm">
      <span>{t(label)}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

function NumberField({
  label,
  suffix,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string
  suffix: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t(label)}
      <span className="flex h-9 items-center overflow-hidden rounded-md border bg-background">
        <input
          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none"
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : min}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="border-l px-2 text-xs">{suffix}</span>
      </span>
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t(label)}
      <select
        className="h-9 rounded-md border bg-background px-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  )
}
