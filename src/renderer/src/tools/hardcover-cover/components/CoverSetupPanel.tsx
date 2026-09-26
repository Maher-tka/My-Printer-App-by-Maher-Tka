import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Languages,
  RotateCcw,
  Ruler,
  Save,
  Settings2,
  Upload
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  BookDirection,
  CoverDimensions,
  CoverSetup,
  HardcoverPdfCoverSource,
  HardcoverPdfCoverTarget,
  HardcoverPdfSource,
  HardcoverProductionPreset
} from '../types'
import {
  applyCoverPreset,
  getDirectionLabel,
  isValidHardcoverPageNumber
} from '../lib/coverCalculations'
import { formatMeasurement, fromMillimeters, toMillimeters } from '../lib/units'
import { hasHardcoverPdfCoverSourceBytes, markHardcoverPdfImportTarget } from '../lib/sourcePdf'

type CoverSetupPanelSection = 'all' | 'source' | 'measurements'

interface CoverSetupPanelProps {
  section?: CoverSetupPanelSection
  setup: CoverSetup
  dimensions: CoverDimensions
  sourcePdf?: HardcoverPdfSource
  productionPreset: HardcoverProductionPreset
  onChange: (patch: Partial<CoverSetup>) => void
  onImportPdf: (file: File) => Promise<void>
  onSelectPdfFrontPage: (pageNumber: number) => Promise<void>
  onSelectPdfBackPage: (pageNumber: number) => Promise<void>
  onTogglePdfBackCover: (enabled: boolean) => Promise<void>
  onLoadPdfPagePreviews: (
    startPage: number,
    count?: number,
    target?: HardcoverPdfCoverTarget
  ) => Promise<void>
  onChangePdfFitMode: (
    fitMode: HardcoverPdfSource['fitMode'],
    target?: HardcoverPdfCoverTarget
  ) => void
  onSavePreset: () => void
  onUpdatePreset: () => void
  onResetFactoryPreset: () => void
}

export function CoverSetupPanel({
  section = 'all',
  setup,
  dimensions,
  sourcePdf,
  productionPreset,
  onChange,
  onImportPdf,
  onSelectPdfFrontPage,
  onSelectPdfBackPage,
  onTogglePdfBackCover,
  onLoadPdfPagePreviews,
  onChangePdfFitMode,
  onSavePreset,
  onUpdatePreset,
  onResetFactoryPreset
}: CoverSetupPanelProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const frontInputRef = useRef<HTMLInputElement | null>(null)
  const backInputRef = useRef<HTMLInputElement | null>(null)
  const unit = setup.unit
  const [message, setMessage] = useState<string | null>(null)
  const [busyPdf, setBusyPdf] = useState(false)
  const [showAdvancedMeasurements, setShowAdvancedMeasurements] = useState(false)
  const showSource = section === 'all' || section === 'source'
  const showMeasurements = section === 'all' || section === 'measurements'
  const heading =
    section === 'source'
      ? 'Source PDF'
      : section === 'measurements'
        ? 'Book measurements'
        : 'Hardcover production setup'
  const description =
    section === 'source'
      ? 'Upload the mémoire PDF and choose front/back cover pages.'
      : section === 'measurements'
        ? 'Set the board, spine, bands, sheet size, and physical direction.'
        : 'Upload the thesis PDF, then set the physical sheet used by the shop.'
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

  const importPdf = async (
    file: File | undefined,
    target: 'single' | HardcoverPdfCoverTarget = 'single'
  ): Promise<void> => {
    if (!file) return
    if (target !== 'single') markHardcoverPdfImportTarget(file, target)
    setBusyPdf(true)
    setMessage('Reading PDF...')

    try {
      await onImportPdf(file)
      setMessage(
        target === 'single'
          ? 'PDF loaded. Page 1 is selected for the front cover. Back cover is off.'
          : `${target === 'front' ? 'Front' : 'Back'} cover PDF loaded. You can choose its page and placement mode.`
      )
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setBusyPdf(false)
    }
  }

  const separateSources = sourcePdf?.sourceMode === 'separate' || Boolean(sourcePdf?.frontSource)

  const selectFrontPage = async (pageNumber: number): Promise<void> => {
    if (!sourcePdf) return
    const pageCount = sourcePdf.frontSource?.pageCount ?? sourcePdf.pageCount
    if (!isValidHardcoverPageNumber(pageNumber, pageCount)) {
      setMessage(`Choose a page between 1 and ${pageCount}.`)
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
    const pageCount = sourcePdf.backSource?.pageCount ?? sourcePdf.pageCount
    if (!isValidHardcoverPageNumber(pageNumber, pageCount)) {
      setMessage(`Choose a page between 1 and ${pageCount}.`)
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
          ? `Back cover is on. Page ${
              sourcePdf.backPageNumber ??
              Math.min(2, sourcePdf.backSource?.pageCount ?? sourcePdf.pageCount)
            } is selected.`
          : 'Back cover is off. The back side will export blank.'
      )
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setBusyPdf(false)
    }
  }

  const loadMorePagePreviews = async (
    startPage: number,
    target: HardcoverPdfCoverTarget = 'front'
  ): Promise<void> => {
    if (!sourcePdf) return
    setBusyPdf(true)

    try {
      await onLoadPdfPagePreviews(startPage, undefined, target)
      setMessage(`Loaded more ${target} page thumbnails from page ${startPage}.`)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setBusyPdf(false)
    }
  }

  return (
    <section
      className="min-w-0 max-w-full overflow-hidden rounded-lg border bg-card p-4"
      data-hardcover-setup-panel={section}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{heading}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Ruler className="shrink-0 text-primary" />
      </div>

      <div className="mt-4 flex min-w-0 max-w-full flex-col gap-5 overflow-hidden">
        {showSource && (
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
            <input
              ref={frontInputRef}
              className="hidden"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                void importPdf(event.target.files?.[0], 'front')
                event.currentTarget.value = ''
              }}
            />
            <input
              ref={backInputRef}
              className="hidden"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                void importPdf(event.target.files?.[0], 'back')
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => frontInputRef.current?.click()}
                disabled={busyPdf}
              >
                <Upload />
                Upload front PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => backInputRef.current?.click()}
                disabled={busyPdf}
              >
                <Upload />
                Upload back PDF
              </Button>
              {sourcePdf ? (
                <Badge
                  variant={
                    sourcePdf.bytes ||
                    (sourcePdf.frontSource &&
                      hasHardcoverPdfCoverSourceBytes(sourcePdf.frontSource))
                      ? 'success'
                      : 'warning'
                  }
                >
                  {separateSources
                    ? 'Separate sources'
                    : sourcePdf.bytes
                      ? 'Source loaded'
                      : 'Re-upload needed'}
                </Badge>
              ) : (
                <Badge variant="secondary">No PDF yet</Badge>
              )}
            </div>

            {sourcePdf && separateSources ? (
              <SeparatePdfSources
                sourcePdf={sourcePdf}
                busy={busyPdf}
                onChangeFitMode={onChangePdfFitMode}
                onSelectFrontPage={(pageNumber) => void selectFrontPage(pageNumber)}
                onSelectBackPage={(pageNumber) => void selectBackPage(pageNumber)}
                onToggleBackCover={(enabled) => void toggleBackCover(enabled)}
                onLoadMoreFront={(startPage) => void loadMorePagePreviews(startPage, 'front')}
                onLoadMoreBack={(startPage) => void loadMorePagePreviews(startPage, 'back')}
              />
            ) : sourcePdf ? (
              <div className="grid min-w-0 max-w-full gap-3 overflow-hidden rounded-md border bg-background p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{sourcePdf.fileName}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {sourcePdf.pageCount} page(s), front page {sourcePdf.frontPageNumber}
                      {sourcePdf.backCoverEnabled && sourcePdf.backPageNumber
                        ? `, back page ${sourcePdf.backPageNumber}`
                        : ', back off'}
                    </p>
                  </div>
                  <Badge variant="secondary">{sourcePdf.fitMode === 'fill' ? 'Fill' : 'Fit'}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2">
                  <span className="text-xs font-medium text-muted-foreground">PDF placement</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={sourcePdf.fitMode === 'fit' ? 'default' : 'outline'}
                    onClick={() => onChangePdfFitMode('fit')}
                    disabled={busyPdf || !sourcePdf.bytes}
                  >
                    Fit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sourcePdf.fitMode === 'fill' ? 'default' : 'outline'}
                    onClick={() => onChangePdfFitMode('fill')}
                    disabled={busyPdf || !sourcePdf.bytes}
                  >
                    Fill
                  </Button>
                </div>
                <PdfPageCarousel
                  title="Front cover"
                  description="Page 1 is selected automatically after upload."
                  source={sourcePdf}
                  selectedPageNumber={sourcePdf.frontPageNumber}
                  selectedLabel="Front"
                  disabled={busyPdf || !sourcePdf.bytes}
                  onSelect={(pageNumber) => void selectFrontPage(pageNumber)}
                  onLoadMore={(startPage) => void loadMorePagePreviews(startPage)}
                />
                <div className="min-w-0 max-w-full overflow-hidden rounded-md border bg-muted/30 p-3">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
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
                    <div className="mt-3 min-w-0 max-w-full overflow-hidden">
                      <PdfPageCarousel
                        title="Back source page"
                        description="Choose the PDF page to place on the back board."
                        source={sourcePdf}
                        selectedPageNumber={sourcePdf.backPageNumber ?? 1}
                        selectedLabel="Back"
                        disabled={busyPdf || !sourcePdf.bytes}
                        onSelect={(pageNumber) => void selectBackPage(pageNumber)}
                        onLoadMore={(startPage) => void loadMorePagePreviews(startPage)}
                      />
                    </div>
                  ) : (
                    <p className="mt-3 max-w-full break-words rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                      Back cover is OFF. The back board will stay blank.
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
              <WarningText>
                Upload a mémoire PDF to use page 1 as the front cover source.
              </WarningText>
            )}
            {message && (
              <p className="min-w-0 break-words text-xs text-muted-foreground">{message}</p>
            )}
          </PanelBlock>
        )}

        {showMeasurements && (
          <PanelBlock icon={<Languages className="size-4" />} title="Book direction">
            <div className="grid grid-cols-2 gap-2">
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
        )}

        {showMeasurements && (
          <PanelBlock icon={<Ruler className="size-4" />} title="Essential measurements">
            <p className="text-xs leading-5 text-muted-foreground">
              Set the spine first, then confirm the printer sheet size.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="Spine width"
                value={measure(setup.spineWidthMm)}
                suffix={unit}
                onChange={(value) => setMeasure('spineWidthMm', value)}
              />
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
            </div>
          </PanelBlock>
        )}

        {showMeasurements && (
          <div className="rounded-xl border bg-card">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/50"
              aria-expanded={showAdvancedMeasurements}
              onClick={() => setShowAdvancedMeasurements((open) => !open)}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Settings2 className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Advanced settings</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Board, bands, units, marks, and presets
                </span>
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${
                  showAdvancedMeasurements ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {showAdvancedMeasurements ? (
              <div className="flex flex-col gap-4 border-t p-3">
                <PanelBlock icon={<Ruler className="size-4" />} title="Cover and binding">
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Board preset"
                      value={setup.preset}
                      onChange={(value) =>
                        onChange(applyCoverPreset(setup, value as CoverSetup['preset']))
                      }
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
                    <Toggle
                      label="Center structure on sheet"
                      checked={setup.centerOnSheet}
                      onChange={(centerOnSheet) => onChange({ centerOnSheet })}
                    />
                  </div>
                </PanelBlock>

                <PanelBlock icon={<Save className="size-4" />} title="Printer preset">
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
                  <div className="grid grid-cols-1 gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={onSavePreset}>
                      <Save />
                      Save as default
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={onUpdatePreset}>
                      <Save />
                      Update preset
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onResetFactoryPreset}
                    >
                      <RotateCcw />
                      Reset factory
                    </Button>
                  </div>
                </PanelBlock>
              </div>
            ) : null}
          </div>
        )}
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

function SeparatePdfSources({
  sourcePdf,
  busy,
  onChangeFitMode,
  onSelectFrontPage,
  onSelectBackPage,
  onToggleBackCover,
  onLoadMoreFront,
  onLoadMoreBack
}: {
  sourcePdf: HardcoverPdfSource
  busy: boolean
  onChangeFitMode: (
    fitMode: HardcoverPdfSource['fitMode'],
    target?: HardcoverPdfCoverTarget
  ) => void
  onSelectFrontPage: (pageNumber: number) => void
  onSelectBackPage: (pageNumber: number) => void
  onToggleBackCover: (enabled: boolean) => void
  onLoadMoreFront: (startPage: number) => void
  onLoadMoreBack: (startPage: number) => void
}): JSX.Element {
  const front = sourcePdf.frontSource
  const back = sourcePdf.backSource

  return (
    <div className="grid min-w-0 max-w-full gap-3 overflow-hidden rounded-md border bg-background p-3">
      <div>
        <p className="text-sm font-semibold">Independent cover PDFs</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Front and back files stay separate. Choose a page and Fit or Fill independently for each
          cover.
        </p>
      </div>

      {front ? (
        <IndependentCoverSourceCard
          source={front}
          title="Front cover source"
          selectedLabel="Front"
          target="front"
          busy={busy}
          onChangeFitMode={onChangeFitMode}
          onSelectPage={onSelectFrontPage}
          onLoadMore={onLoadMoreFront}
        />
      ) : (
        <WarningText>Upload a front PDF to place artwork on the front board.</WarningText>
      )}

      <div className="min-w-0 max-w-full overflow-hidden rounded-md border bg-muted/30 p-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Back cover source</p>
            <p className="text-xs text-muted-foreground">
              Upload a separate back PDF when the back artwork is not in the same document.
            </p>
          </div>
          <Toggle
            label={sourcePdf.backCoverEnabled ? 'Back Cover ON' : 'Back Cover OFF'}
            checked={sourcePdf.backCoverEnabled}
            onChange={onToggleBackCover}
            disabled={busy || !back}
          />
        </div>
        {back && sourcePdf.backCoverEnabled ? (
          <div className="mt-3">
            <IndependentCoverSourceCard
              source={back}
              title="Back cover source"
              selectedLabel="Back"
              target="back"
              busy={busy}
              onChangeFitMode={onChangeFitMode}
              onSelectPage={onSelectBackPage}
              onLoadMore={onLoadMoreBack}
            />
          </div>
        ) : (
          <p className="mt-3 max-w-full break-words rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
            {back
              ? 'Back cover is OFF. The uploaded back PDF is kept and can be enabled again.'
              : 'Back cover is OFF. Use Upload back PDF above to add an independent source.'}
          </p>
        )}
      </div>
    </div>
  )
}

function IndependentCoverSourceCard({
  source,
  title,
  selectedLabel,
  target,
  busy,
  onChangeFitMode,
  onSelectPage,
  onLoadMore
}: {
  source: HardcoverPdfCoverSource
  title: string
  selectedLabel: string
  target: HardcoverPdfCoverTarget
  busy: boolean
  onChangeFitMode: (
    fitMode: HardcoverPdfSource['fitMode'],
    target?: HardcoverPdfCoverTarget
  ) => void
  onSelectPage: (pageNumber: number) => void
  onLoadMore: (startPage: number) => void
}): JSX.Element {
  const loaded = hasHardcoverPdfCoverSourceBytes(source)

  return (
    <div className="grid min-w-0 max-w-full gap-3 overflow-hidden rounded-md border bg-muted/30 p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{source.fileName}</p>
          <p className="break-words text-xs text-muted-foreground">
            {source.pageCount} page(s), selected page {source.pageNumber}
          </p>
        </div>
        <Badge variant={loaded ? 'success' : 'warning'}>
          {loaded ? 'Source loaded' : 'Re-upload needed'}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-background p-2">
        <span className="text-xs font-medium text-muted-foreground">{title} placement</span>
        <Button
          type="button"
          size="sm"
          variant={source.fitMode === 'fit' ? 'default' : 'outline'}
          onClick={() => onChangeFitMode('fit', target)}
          disabled={busy || !loaded}
        >
          Fit
        </Button>
        <Button
          type="button"
          size="sm"
          variant={source.fitMode === 'fill' ? 'default' : 'outline'}
          onClick={() => onChangeFitMode('fill', target)}
          disabled={busy || !loaded}
        >
          Fill
        </Button>
      </div>
      <PdfPageCarousel
        title={title}
        description="Choose the source page to place on this board."
        source={source}
        selectedPageNumber={source.pageNumber}
        selectedLabel={selectedLabel}
        disabled={busy || !loaded}
        onSelect={onSelectPage}
        onLoadMore={onLoadMore}
      />
      {!loaded && (
        <WarningText>
          This project contains the source metadata, but the original PDF bytes are not stored in
          the project file. Re-upload this cover PDF before exporting.
        </WarningText>
      )}
    </div>
  )
}

function PdfPageCarousel({
  title,
  description,
  source,
  selectedPageNumber,
  selectedLabel,
  disabled,
  onSelect,
  onLoadMore
}: {
  title: string
  description: string
  source: HardcoverPdfSource | HardcoverPdfCoverSource
  selectedPageNumber: number
  selectedLabel: string
  disabled: boolean
  onSelect: (pageNumber: number) => void
  onLoadMore: (startPage: number) => void
}): JSX.Element {
  const [pageDraft, setPageDraft] = useState(String(selectedPageNumber))
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const loadedPreviews = [...(source.pagePreviews ?? [])].sort(
    (first, second) => first.pageNumber - second.pageNumber
  )
  const previewPages = new Set(source.pagePreviews?.map((preview) => preview.pageNumber) ?? [])
  let firstMissingPage: number | undefined

  for (let pageNumber = 1; pageNumber <= source.pageCount; pageNumber += 1) {
    if (!previewPages.has(pageNumber)) {
      firstMissingPage = pageNumber
      break
    }
  }

  useEffect(() => {
    setPageDraft(String(selectedPageNumber))
  }, [selectedPageNumber])

  useEffect(() => {
    const selectedThumbnail = scrollRef.current?.querySelector<HTMLElement>(
      `[data-page-number="${selectedPageNumber}"]`
    )
    selectedThumbnail?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [loadedPreviews.length, selectedPageNumber])

  const commitPageDraft = (): void => {
    const pageNumber = Number(pageDraft)

    if (Number.isInteger(pageNumber) && isValidHardcoverPageNumber(pageNumber, source.pageCount)) {
      onSelect(pageNumber)
    } else {
      setPageDraft(String(selectedPageNumber))
    }
  }

  const renderPageButton = (
    pageNumber: number,
    thumbnailDataUrl?: string,
    selectedOnly = false
  ): JSX.Element => {
    const active = selectedPageNumber === pageNumber

    return (
      <button
        key={`${pageNumber}-${selectedOnly ? 'selected' : 'loaded'}`}
        type="button"
        data-page-number={pageNumber}
        className={`w-[72px] shrink-0 rounded-md border p-1 text-left transition ${
          active
            ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/30'
            : 'border-border bg-background hover:bg-muted'
        }`}
        disabled={disabled}
        onClick={() => onSelect(pageNumber)}
      >
        <span className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-muted">
          {thumbnailDataUrl ? (
            <img
              src={thumbnailDataUrl}
              alt={`PDF page ${pageNumber}`}
              className="h-full w-full object-contain"
            />
          ) : (
            <FileText className="size-5 text-muted-foreground" />
          )}
        </span>
        <span className="mt-1 block text-center text-[11px] font-medium">Page {pageNumber}</span>
        {active && (
          <span className="mt-1 block rounded bg-primary px-1 py-0.5 text-center text-[9px] font-semibold text-primary-foreground">
            {selectedLabel}
          </span>
        )}
      </button>
    )
  }
  const scrollCarousel = (direction: 'left' | 'right'): void => {
    scrollRef.current?.scrollBy({
      left: direction === 'left' ? -180 : 180,
      behavior: 'smooth'
    })
  }

  return (
    <div
      className="min-w-0 max-w-full overflow-hidden rounded-md border bg-muted/30 p-3"
      data-hardcover-pdf-carousel={title}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="break-words text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge className="shrink-0" variant="secondary">
          Page {selectedPageNumber}
        </Badge>
      </div>
      <div className="mt-3 grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={`Previous ${title.toLowerCase()} page`}
          disabled={disabled || selectedPageNumber <= 1}
          onClick={() => onSelect(selectedPageNumber - 1)}
        >
          <ChevronLeft />
        </Button>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Jump to page
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            type="number"
            min={1}
            max={source.pageCount}
            value={pageDraft}
            disabled={disabled}
            onBlur={commitPageDraft}
            onChange={(event) => setPageDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitPageDraft()
            }}
          />
        </label>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={`Next ${title.toLowerCase()} page`}
          disabled={disabled || selectedPageNumber >= source.pageCount}
          onClick={() => onSelect(selectedPageNumber + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="mt-3 grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={`Scroll ${title.toLowerCase()} thumbnails left`}
          disabled={disabled}
          onClick={() => scrollCarousel('left')}
        >
          <ChevronLeft />
        </Button>
        <div
          ref={scrollRef}
          className="hardcover-carousel-scroll min-w-0 max-w-full overflow-x-auto overflow-y-hidden pb-2 pr-1"
          data-hardcover-carousel-scroll={title}
        >
          <div className="flex min-w-0 gap-2">
            {loadedPreviews.map((preview) =>
              renderPageButton(preview.pageNumber, preview.thumbnailDataUrl)
            )}
            {!previewPages.has(selectedPageNumber) &&
              renderPageButton(selectedPageNumber, undefined, true)}
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={`Scroll ${title.toLowerCase()} thumbnails right`}
          disabled={disabled}
          onClick={() => scrollCarousel('right')}
        >
          <ChevronRight />
        </Button>
      </div>
      {firstMissingPage && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          disabled={disabled}
          onClick={() => onLoadMore(firstMissingPage)}
        >
          Load more pages
        </Button>
      )}
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
      className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold transition ${
        active ? 'border-primary bg-primary/10 text-primary' : 'bg-background hover:bg-muted'
      }`}
      onClick={onClick}
    >
      {getDirectionLabel(direction)}
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
    <div className="min-w-0 max-w-full overflow-hidden rounded-md border bg-muted/30 p-3">
      <div className="mb-3 flex min-w-0 items-center gap-2 text-sm font-semibold">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 truncate">{title}</span>
      </div>
      <div className="flex min-w-0 max-w-full flex-col gap-3 overflow-hidden">{children}</div>
    </div>
  )
}

function WarningText({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex min-w-0 max-w-full items-start gap-2 overflow-hidden rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
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
    <label className="flex min-w-0 max-w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
      <input
        className="shrink-0"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 break-words">{label}</span>
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
