import { useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, FileText, Languages, RotateCcw, Ruler, Save, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  BookDirection,
  CoverDimensions,
  CoverSetup,
  HardcoverPdfSource,
  HardcoverProductionPreset
} from '../types'
import {
  applyCoverPreset,
  getDirectionLabel,
  isValidHardcoverPageNumber
} from '../lib/coverCalculations'
import { formatMeasurement, fromMillimeters, toMillimeters } from '../lib/units'

interface CoverSetupPanelProps {
  setup: CoverSetup
  dimensions: CoverDimensions
  sourcePdf?: HardcoverPdfSource
  productionPreset: HardcoverProductionPreset
  onChange: (patch: Partial<CoverSetup>) => void
  onImportPdf: (file: File) => Promise<void>
  onSelectPdfFrontPage: (pageNumber: number) => Promise<void>
  onSelectPdfBackPage: (pageNumber: number) => Promise<void>
  onTogglePdfBackCover: (enabled: boolean) => Promise<void>
  onSavePreset: () => void
  onUpdatePreset: () => void
  onResetFactoryPreset: () => void
}

export function CoverSetupPanel({
  setup,
  dimensions,
  sourcePdf,
  productionPreset,
  onChange,
  onImportPdf,
  onSelectPdfFrontPage,
  onSelectPdfBackPage,
  onTogglePdfBackCover,
  onSavePreset,
  onUpdatePreset,
  onResetFactoryPreset
}: CoverSetupPanelProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const unit = setup.unit
  const [message, setMessage] = useState<string | null>(null)
  const [busyPdf, setBusyPdf] = useState(false)
  const measure = (valueMm: number): number => Number(fromMillimeters(valueMm, unit).toFixed(2))
  const setMeasure = (
    key: keyof Pick<
      CoverSetup,
      | 'boardWidthMm'
      | 'boardHeightMm'
      | 'bookWidthMm'
      | 'bookHeightMm'
      | 'spineWidthMm'
      | 'leftBandWidthMm'
      | 'rightBandWidthMm'
      | 'markLengthMm'
      | 'paperWidthMm'
      | 'paperHeightMm'
    >,
    value: number
  ): void =>
    onChange({
      [key]: Math.max(0, toMillimeters(value, unit))
    })

  const importPdf = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setBusyPdf(true)
    setMessage('Reading PDF...')

    try {
      await onImportPdf(file)
      setMessage('PDF loaded. Page 1 is selected for the front cover. Back cover is off.')
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setBusyPdf(false)
    }
  }

  const selectFrontPage = async (pageNumber: number): Promise<void> => {
    if (!sourcePdf) return
    if (!isValidHardcoverPageNumber(pageNumber, sourcePdf.pageCount)) {
      setMessage(`Choose a page between 1 and ${sourcePdf.pageCount}.`)
      return
    }

    setBusyPdf(true)

    try {
      await onSelectPdfFrontPage(pageNumber)
      setMessage(`Front cover source page set to ${pageNumber}.`)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setBusyPdf(false)
    }
  }

  const selectBackPage = async (pageNumber: number): Promise<void> => {
    if (!sourcePdf) return
    if (!isValidHardcoverPageNumber(pageNumber, sourcePdf.pageCount)) {
      setMessage(`Choose a page between 1 and ${sourcePdf.pageCount}.`)
      return
    }

    setBusyPdf(true)

    try {
      await onSelectPdfBackPage(pageNumber)
      setMessage(`Back cover source page set to ${pageNumber}.`)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setBusyPdf(false)
    }
  }

  const toggleBackCover = async (enabled: boolean): Promise<void> => {
    if (!sourcePdf) return
    setBusyPdf(true)

    try {
      await onTogglePdfBackCover(enabled)
      setMessage(
        enabled
          ? `Back cover is on. Page ${sourcePdf.backPageNumber ?? Math.min(2, sourcePdf.pageCount)} is selected.`
          : 'Back cover is off. The back side will export blank.'
      )
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setBusyPdf(false)
    }
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Hardcover production setup</h3>
          <p className="text-sm text-muted-foreground">
            Upload the thesis PDF, then set the physical sheet used by the shop.
          </p>
        </div>
        <Ruler className="text-primary" />
      </div>

      <div className="mt-4 flex flex-col gap-5">
        <PanelBlock icon={<FileText className="size-4" />} title="Source PDF">
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              void importPdf(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={busyPdf}
            >
              <Upload />
              Upload mémoire PDF
            </Button>
            {sourcePdf ? (
              <Badge variant={sourcePdf.bytes ? 'success' : 'warning'}>
                {sourcePdf.bytes ? 'Source loaded' : 'Re-upload needed'}
              </Badge>
            ) : (
              <Badge variant="secondary">No PDF yet</Badge>
            )}
          </div>

          {sourcePdf ? (
            <div className="grid gap-3 rounded-md border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{sourcePdf.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {sourcePdf.pageCount} page(s), front page {sourcePdf.frontPageNumber}
                    {sourcePdf.backCoverEnabled && sourcePdf.backPageNumber
                      ? `, back page ${sourcePdf.backPageNumber}`
                      : ', back off'}
                  </p>
                </div>
                <Badge variant="secondary">{sourcePdf.fitMode === 'fill' ? 'Fill' : 'Fit'}</Badge>
              </div>
              <PdfPageCarousel
                title="Front cover"
                description="Page 1 is selected automatically after upload."
                sourcePdf={sourcePdf}
                selectedPageNumber={sourcePdf.frontPageNumber}
                disabled={busyPdf || !sourcePdf.bytes}
                onSelect={(pageNumber) => void selectFrontPage(pageNumber)}
              />
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Back cover</p>
                    <p className="text-xs text-muted-foreground">
                      Leave off when the PDF has no back-cover page.
                    </p>
                  </div>
                  <Toggle
                    label={sourcePdf.backCoverEnabled ? 'Back Cover ON' : 'Back Cover OFF'}
                    checked={sourcePdf.backCoverEnabled}
                    onChange={(enabled) => void toggleBackCover(enabled)}
                    disabled={busyPdf || !sourcePdf.bytes}
                  />
                </div>
                {sourcePdf.backCoverEnabled ? (
                  <div className="mt-3">
                    <PdfPageCarousel
                      title="Back source page"
                      description="Choose the PDF page to place on the back board."
                      sourcePdf={sourcePdf}
                      selectedPageNumber={sourcePdf.backPageNumber ?? 1}
                      disabled={busyPdf || !sourcePdf.bytes}
                      onSelect={(pageNumber) => void selectBackPage(pageNumber)}
                    />
                  </div>
                ) : (
                  <p className="mt-3 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                    Back cover is off, so the back board remains blank in preview and export.
                  </p>
                )}
              </div>
              {!sourcePdf.bytes && (
                <WarningText>
                  Saved project metadata was reopened without the original PDF bytes. Upload the
                  mémoire PDF again before final export.
                </WarningText>
              )}
            </div>
          ) : (
            <WarningText>Upload a mémoire PDF to use page 1 as the front cover source.</WarningText>
          )}
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </PanelBlock>

        <PanelBlock icon={<Languages className="size-4" />} title="Book direction">
          <div className="grid grid-cols-1 gap-2">
            {(['ltr', 'rtl'] as const).map((direction) => (
              <DirectionButton
                key={direction}
                direction={direction}
                active={setup.bookDirection === direction}
                onClick={() => onChange({ bookDirection: direction })}
              />
            ))}
          </div>
        </PanelBlock>

        <PanelBlock icon={<Ruler className="size-4" />} title="Physical hardcover setup">
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Board preset"
              value={setup.preset}
              onChange={(value) => onChange(applyCoverPreset(setup, value as CoverSetup['preset']))}
              options={[
                ['a4', 'A4 mémoire'],
                ['a5', 'A5 mémoire'],
                ['custom', 'Custom']
              ]}
            />
            <SelectField
              label="Unit"
              value={unit}
              onChange={(value) => onChange({ unit: value as CoverSetup['unit'] })}
              options={[
                ['cm', 'Centimeters'],
                ['mm', 'Millimeters']
              ]}
            />
            <NumberField
              label="Board width"
              value={measure(setup.boardWidthMm)}
              suffix={unit}
              onChange={(value) => setMeasure('boardWidthMm', value)}
            />
            <NumberField
              label="Board height"
              value={measure(setup.boardHeightMm)}
              suffix={unit}
              onChange={(value) => setMeasure('boardHeightMm', value)}
            />
            <NumberField
              label="Spine thickness"
              value={measure(setup.spineWidthMm)}
              suffix={unit}
              onChange={(value) => setMeasure('spineWidthMm', value)}
            />
            <NumberField
              label="Guide mark length"
              value={measure(setup.markLengthMm)}
              suffix={unit}
              onChange={(value) => setMeasure('markLengthMm', value)}
            />
            <NumberField
              label="Left band"
              value={measure(setup.leftBandWidthMm)}
              suffix={unit}
              onChange={(value) => setMeasure('leftBandWidthMm', value)}
            />
            <NumberField
              label="Right band"
              value={measure(setup.rightBandWidthMm)}
              suffix={unit}
              onChange={(value) => setMeasure('rightBandWidthMm', value)}
              disabled={setup.useSameBandWidth}
            />
            <Toggle
              label="Use same band width"
              checked={setup.useSameBandWidth}
              onChange={(useSameBandWidth) => onChange({ useSameBandWidth })}
            />
          </div>
        </PanelBlock>

        <PanelBlock icon={<Save className="size-4" />} title="Printer sheet preset">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Sheet width"
              value={measure(setup.paperWidthMm)}
              suffix={unit}
              onChange={(value) => setMeasure('paperWidthMm', value)}
            />
            <NumberField
              label="Sheet height"
              value={measure(setup.paperHeightMm)}
              suffix={unit}
              onChange={(value) => setMeasure('paperHeightMm', value)}
            />
            <Toggle
              label="Center structure on sheet"
              checked={setup.centerOnSheet}
              onChange={(centerOnSheet) => onChange({ centerOnSheet })}
            />
          </div>
          <div className="rounded-md bg-primary/8 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Saved preset: {productionPreset.name}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatMeasurement(dimensions.fullWidthMm, unit)} x{' '}
              {formatMeasurement(dimensions.fullHeightMm, unit)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">
                Structure {formatMeasurement(dimensions.structureWidthMm, unit)}
              </Badge>
              <Badge variant="secondary">
                Margin {formatMeasurement(dimensions.horizontalMarginMm, unit)} /{' '}
                {formatMeasurement(dimensions.verticalMarginMm, unit)}
              </Badge>
              <Badge variant="secondary">{getDirectionLabel(setup.bookDirection)}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button type="button" size="sm" variant="outline" onClick={onSavePreset}>
              <Save />
              Save as default
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onUpdatePreset}>
              <Save />
              Update preset
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onResetFactoryPreset}>
              <RotateCcw />
              Reset factory
            </Button>
          </div>
        </PanelBlock>
      </div>

      {dimensions.warnings.map((warning) => (
        <div
          key={warning}
          className="mt-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {warning}
        </div>
      ))}
    </section>
  )
}

function PdfPageCarousel({
  title,
  description,
  sourcePdf,
  selectedPageNumber,
  disabled,
  onSelect
}: {
  title: string
  description: string
  sourcePdf: HardcoverPdfSource
  selectedPageNumber: number
  disabled: boolean
  onSelect: (pageNumber: number) => void
}): JSX.Element {
  const pageNumbers = Array.from({ length: sourcePdf.pageCount }, (_, index) => index + 1)

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary">Page {selectedPageNumber}</Badge>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {pageNumbers.map((pageNumber) => {
          const preview = sourcePdf.pagePreviews?.find((item) => item.pageNumber === pageNumber)
          const active = selectedPageNumber === pageNumber

          return (
            <button
              key={pageNumber}
              type="button"
              className={`w-[76px] shrink-0 rounded-md border p-1 text-left transition ${
                active
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border bg-background hover:bg-muted'
              }`}
              disabled={disabled}
              onClick={() => onSelect(pageNumber)}
            >
              <span className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-muted">
                {preview ? (
                  <img
                    src={preview.thumbnailDataUrl}
                    alt={`PDF page ${pageNumber}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <FileText className="size-5 text-muted-foreground" />
                )}
              </span>
              <span className="mt-1 block text-center text-[11px] font-medium">
                Page {pageNumber}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DirectionButton({
  direction,
  active,
  onClick
}: {
  direction: BookDirection
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      className={`rounded-md border px-3 py-2 text-left text-sm transition ${
        active ? 'border-primary bg-primary/10 text-primary' : 'bg-background hover:bg-muted'
      }`}
      onClick={onClick}
    >
      <span className="font-medium">{getDirectionLabel(direction)}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        {direction === 'rtl'
          ? 'Front cover on the left board, back cover on the right.'
          : 'Back cover on the left board, front cover on the right.'}
      </span>
    </button>
  )
}

function PanelBlock({
  icon,
  title,
  children
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function WarningText({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function Toggle({
  label,
  checked,
  disabled = false,
  onChange
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}): JSX.Element {
  return (
    <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

function NumberField({
  label,
  value,
  suffix,
  disabled = false,
  onChange
}: {
  label: string
  value: number
  suffix: string
  disabled?: boolean
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <span className="flex overflow-hidden rounded-md border bg-background">
        <input
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-foreground outline-none disabled:opacity-60"
          type="number"
          min={0}
          step={suffix === 'cm' ? 0.1 : 1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="border-l px-2 py-2">{suffix}</span>
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
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong while reading the PDF.'
}
