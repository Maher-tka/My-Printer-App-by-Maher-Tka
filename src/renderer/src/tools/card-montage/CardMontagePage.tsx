import { useLanguage } from '@/i18n/useLanguage'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ClearButton } from '@/components/ui/clear-button'
import { ToolHeader } from '../shared/ToolHeader'
import { ToolSettingsTabs } from '../shared/ToolSettingsTabs'
import { getPrintResultMessage, printPdf } from '@/print/printPdf'
import { downloadBlob } from '../booklet-montage/lib/download'
import { changeCardArtworkPage, loadCardArtwork, loadCardPagePreviews } from './lib/artwork'
import type { AppRoute } from '@/types/navigation'
import type { CardArtwork, CardMontageDraft, CardMontageMode, CardMontageSettings } from './types'
import { getCardLayout } from './lib/layout'
import { exportCardMontagePdf } from './lib/exportPdf'
import { STANDARD_CARD_SIZES } from './lib/cardSize'
import { assignCardFile, shareCardPagePreviews } from './lib/cardSides'
import { CardArtworkPanel } from './components/CardArtworkPanel'
import { CardPreviewViewport } from './components/CardPreviewViewport'
import { CardPrintDialog } from './components/CardPrintDialog'
import { createCardPrintPdf, getCardPrintSetupError, type CardPrintSide } from './lib/printSetup'
import { getCardOutlineColor } from './lib/cropMarks'

const inputClass =
  'h-[var(--ui-control-standard)] w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-secondary/80 px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const modes: { value: CardMontageMode; title: string; description: string }[] = [
  { value: 'zero', title: '1 · Zero spacing', description: 'Cards touch edge to edge.' },
  {
    value: 'spaced',
    title: '2 · With spacing',
    description: 'Choose horizontal and vertical gaps.'
  },
  {
    value: 'auto',
    title: '3 · Auto 8.8 × 5.6 cm',
    description: '1 mm between rows · adjustable space between columns.'
  }
]

function NumericField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.1,
  disabled = false
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  const { t } = useLanguage()

  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      {t(label)}
      <input
        className={inputClass}
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? NaN : Number(event.target.value))}
      />
    </label>
  )
}

export function CardMontagePage({
  draft,
  onDraftChange,
  onNavigate
}: {
  draft: CardMontageDraft
  onDraftChange: (draft: CardMontageDraft) => void
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  const { t } = useLanguage()

  const { artwork, settings } = draft
  const [previewSide, setPreviewSide] = useState<'front' | 'back' | 'both'>('front')
  const [previewResetKey, setPreviewResetKey] = useState(0)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [printSide, setPrintSide] = useState<CardPrintSide>('front')
  const [printCopies, setPrintCopies] = useState(1)
  const printSetupError = getCardPrintSetupError(draft, printSide, printCopies)
  const previewSides: ('front' | 'back')[] =
    previewSide === 'both' ? ['front', 'back'] : [previewSide]
  const layout = useMemo(() => getCardLayout(settings), [settings])
  const backLayout = useMemo(() => getCardLayout(settings, 'back'), [settings])
  const outputPageCount = settings.includeBack
    ? 2
    : artwork?.kind === 'pdf' && settings.exportAllPdfPages
      ? artwork.pageCount
      : 1
  const fontPages = [
    ...(artwork?.pdfInfo?.pages.filter(
      (page) =>
        (!settings.includeBack && settings.exportAllPdfPages) ||
        page.pageNumber === artwork.pageNumber
    ) ?? []),
    ...(settings.includeBack
      ? (draft.back?.pdfInfo?.pages.filter((page) => page.pageNumber === draft.back?.pageNumber) ??
        [])
      : [])
  ]
  const unembeddedFonts = [
    ...new Set(
      fontPages.flatMap((page) =>
        page.fonts.filter((font) => !font.embedded).map((font) => font.name)
      )
    )
  ]
  const [busy, setBusy] = useState<'import' | 'export' | 'print' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const operationRef = useRef(0)
  useEffect(
    () => () => {
      operationRef.current++
    },
    []
  )
  const updateSettings = (patch: Partial<CardMontageSettings>) => {
    setMessage(null)
    onDraftChange({ ...draft, settings: { ...settings, ...patch } })
  }
  const importArtwork = async (
    file: File | null,
    side: 'front' | 'back',
    pageNumber?: number,
    sourceArtwork?: CardArtwork
  ) => {
    const current = sourceArtwork ?? (side === 'front' ? artwork : draft.back)
    if (busy || (!file && !current)) return
    const operation = ++operationRef.current
    setBusy('import')
    setError(null)
    setMessage(null)
    try {
      const next = file
        ? await loadCardArtwork(file)
        : await changeCardArtworkPage(current!, pageNumber!)
      let pairedBack: CardArtwork | null | undefined
      if (
        file &&
        side === 'front' &&
        (!draft.back || draft.back.bytesBase64 === artwork?.bytesBase64)
      ) {
        pairedBack =
          next.kind === 'pdf' && next.pageCount > 1 ? await changeCardArtworkPage(next, 2) : null
      }
      if (operation !== operationRef.current) return
      const nextDraft = file
        ? assignCardFile(draft, side, next, pairedBack)
        : side === 'front'
          ? { ...draft, artwork: next }
          : {
              ...draft,
              back: next,
              settings: { ...settings, includeBack: true, exportAllPdfPages: false }
            }
      onDraftChange(shareCardPagePreviews(nextDraft, side, next))
      setPreviewSide(side)
      setMessage(`Loaded ${next.name}${next.kind === 'pdf' ? ` · page ${next.pageNumber}` : ''}.`)
    } catch (cause) {
      if (operation === operationRef.current)
        setError(cause instanceof Error ? cause.message : 'Could not read this design.')
    } finally {
      if (operation === operationRef.current) setBusy(null)
    }
  }
  const loadMorePages = async (side: 'front' | 'back', start: number) => {
    const current = side === 'front' ? artwork : draft.back
    if (!current || busy) return
    const operation = ++operationRef.current
    setBusy('import')
    setError(null)
    try {
      const next = await loadCardPagePreviews(current, start)
      if (operation === operationRef.current)
        onDraftChange(shareCardPagePreviews(draft, side, next))
    } catch (cause) {
      if (operation === operationRef.current)
        setError(cause instanceof Error ? cause.message : 'Could not load page thumbnails.')
    } finally {
      if (operation === operationRef.current) setBusy(null)
    }
  }
  const exportPdf = async () => {
    if (
      !artwork ||
      busy ||
      layout.errors.length ||
      unembeddedFonts.length ||
      (settings.includeBack && !draft.back)
    )
      return
    const operation = ++operationRef.current
    setBusy('export')
    setError(null)
    setMessage(null)
    try {
      const bytes = await exportCardMontagePdf(artwork, settings, draft.back)
      if (operation !== operationRef.current) return
      const suggestedName = `${artwork.name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')} - A4 card montage.pdf`
      if (window.printerApp?.saveFile) {
        const result = await window.printerApp.saveFile({
          suggestedName,
          bytes,
          filters: [{ name: 'PDF document', extensions: ['pdf'] }]
        })
        if (operation !== operationRef.current) return
        if (result.canceled) setMessage('Export save canceled.')
        else if (!result.ok) throw new Error(result.error || 'Could not save the PDF.')
        else
          setMessage(
            `Exported ${outputPageCount} A4 sheet${outputPageCount === 1 ? '' : 's'} with ${layout.capacity} cards per side.`
          )
      } else {
        downloadBlob(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), suggestedName)
        setMessage(
          `Exported ${outputPageCount} A4 sheet${outputPageCount === 1 ? '' : 's'} with ${layout.capacity} cards per side.`
        )
      }
    } catch (cause) {
      if (operation === operationRef.current)
        setError(cause instanceof Error ? cause.message : 'Could not prepare the montage.')
    } finally {
      if (operation === operationRef.current) setBusy(null)
    }
  }
  const clear = () => {
    if (busy) return
    operationRef.current++
    onDraftChange({
      artwork: null,
      back: null,
      settings
    })
    setPreviewSide('front')
    setPreviewResetKey((key) => key + 1)
    setShowPrintDialog(false)
    setPrintSide('front')
    setPrintCopies(1)
    setMessage(null)
    setError(null)
  }
  const openPrintSetup = () => {
    setPrintSide(
      previewSide === 'back' && draft.back
        ? 'back'
        : (previewSide === 'both' || settings.includeBack) && artwork && draft.back
          ? 'both'
          : artwork
            ? 'front'
            : 'back'
    )
    setShowPrintDialog(true)
  }
  const startPrint = async () => {
    if (busy || printSetupError || layout.errors.length) return
    const operation = ++operationRef.current
    setShowPrintDialog(false)
    setBusy('print')
    setMessage(null)
    setError(null)
    try {
      const bytes = await createCardPrintPdf(draft, printSide)
      if (operation !== operationRef.current) return
      const source = printSide === 'back' ? draft.back! : artwork!
      const suggestedName = `${source.name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')} - ${printSide} A4 cards.pdf`
      const result = await printPdf({
        bytes,
        suggestedName,
        jobTitle: `Card Montage - ${printSide}`,
        silent: false,
        copies: printCopies
      })
      if (operation !== operationRef.current) return
      if (!result.ok && !result.canceled) setError(getPrintResultMessage(result, suggestedName))
      else setMessage(getPrintResultMessage(result, suggestedName))
    } catch (cause) {
      if (operation === operationRef.current)
        setError(cause instanceof Error ? cause.message : 'Could not prepare printing.')
    } finally {
      if (operation === operationRef.current) setBusy(null)
    }
  }
  const outputDisabled =
    !artwork ||
    Boolean(busy) ||
    layout.errors.length > 0 ||
    unembeddedFonts.length > 0 ||
    (settings.includeBack && !draft.back)
  return (
    <div className="workspace-shell mx-auto max-w-[1600px] space-y-4">
      <ToolHeader
        title={t('Card Montage')}
        onBack={() => onNavigate('dashboard')}
        print={{
          disabled: Boolean(busy) || layout.errors.length > 0 || (!artwork && !draft.back),
          isBusy: busy === 'print',
          onPrint: openPrintSetup
        }}
        exportPdf={{
          disabled: outputDisabled,
          isBusy: busy === 'export',
          onExport: () => void exportPdf()
        }}
        actions={
          <ClearButton
            disabled={Boolean(busy) || (!artwork && !draft.back && !message && !error)}
            onClear={clear}
          />
        }
      />
      <CardPrintDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        hasFront={Boolean(artwork)}
        hasBack={Boolean(draft.back)}
        side={printSide}
        copies={printCopies}
        error={printSetupError}
        onSideChange={setPrintSide}
        onCopiesChange={setPrintCopies}
        onContinue={() => void startPrint()}
      />
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t(error)}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl border bg-card p-3 text-sm">
          {message}
        </p>
      )}
      <fieldset
        disabled={Boolean(busy)}
        className="grid min-w-0 gap-4 md:grid-cols-2 disabled:opacity-70"
      >
        <CardArtworkPanel
          side="front"
          artwork={artwork}
          busy={Boolean(busy)}
          widthMm={layout.widthMm}
          heightMm={layout.heightMm}
          onImport={(file) => void importArtwork(file, 'front')}
          onChangePage={(page) => void importArtwork(null, 'front', page)}
          onLoadMore={(start) => void loadMorePages('front', start)}
          onPreview={() => setPreviewSide('front')}
        />
        <CardArtworkPanel
          side="back"
          artwork={draft.back ?? null}
          busy={Boolean(busy)}
          widthMm={layout.widthMm}
          heightMm={layout.heightMm}
          onImport={(file) => void importArtwork(file, 'back')}
          onChangePage={(page) => void importArtwork(null, 'back', page)}
          onLoadMore={(start) => void loadMorePages('back', start)}
          onPreview={() => setPreviewSide('back')}
          onRemove={() => {
            onDraftChange({ ...draft, back: null, settings: { ...settings, includeBack: false } })
            setPreviewSide('front')
          }}
          onUseFrontPage={
            artwork?.kind === 'pdf' && artwork.pageCount > 1
              ? () => void importArtwork(null, 'back', 2, artwork)
              : undefined
          }
          includeBack={settings.includeBack}
          onIncludeBack={(value) =>
            updateSettings({
              includeBack: value,
              exportAllPdfPages: value ? false : settings.exportAllPdfPages
            })
          }
        />
        {!settings.includeBack && artwork?.kind === 'pdf' && artwork.pageCount > 2 && (
          <label className="flex items-start gap-2 rounded-xl border bg-card p-3 text-xs">
            <input
              className="mt-0.5 accent-primary"
              type="checkbox"
              checked={Boolean(settings.exportAllPdfPages)}
              onChange={(event) => updateSettings({ exportAllPdfPages: event.target.checked })}
            />
            {t('Export all')} {artwork.pageCount} pages in one PDF
          </label>
        )}
      </fieldset>
      <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-4 disabled:opacity-70">
          <ToolSettingsTabs
            label={t('Card montage settings')}
            advanced={
              <section className="space-y-3 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
                <h2 className="text-sm font-semibold">
                  {t(
                    settings.mode === 'auto'
                      ? 'Margins'
                      : settings.mode === 'zero'
                        ? 'Margins & cutting lines'
                        : 'Margins & crop crosses'
                  )}
                </h2>
                <NumericField
                  label={t('Minimum sheet margin (mm)')}
                  value={settings.marginMm}
                  onChange={(value) => updateSettings({ marginMm: value })}
                />
                {settings.mode !== 'auto' && (
                  <>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.cutMarks}
                        onChange={(event) => updateSettings({ cutMarks: event.target.checked })}
                        className="accent-primary"
                      />
                      {t(
                        settings.mode === 'zero'
                          ? 'Cutting lines on front only (0.25 px)'
                          : 'Crop crosses (0.25 px)'
                      )}
                    </label>
                    <label className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                      {t(settings.mode === 'zero' ? 'Cutting line color' : 'Crop cross color')}
                      <span className="flex items-center gap-2">
                        <span>{layout.lineColor}</span>
                        <input
                          type="color"
                          aria-label={t(
                            settings.mode === 'zero' ? 'Cutting line color' : 'Crop cross color'
                          )}
                          value={layout.lineColor}
                          disabled={!settings.cutMarks}
                          onChange={(event) =>
                            updateSettings({ cropMarkColor: event.target.value })
                          }
                          className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1"
                        />
                      </span>
                    </label>
                  </>
                )}
              </section>
            }
          >
            <section className="space-y-3 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
              <h2 className="text-sm font-semibold">{t('2. Choose montage')}</h2>
              <div className="space-y-2">
                {modes.map((mode) => (
                  <label
                    key={mode.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${settings.mode === mode.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
                  >
                    <input
                      type="radio"
                      name="card-montage-mode"
                      value={mode.value}
                      checked={settings.mode === mode.value}
                      onChange={() => updateSettings({ mode: mode.value })}
                      className="mt-1 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium">{mode.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {mode.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {settings.mode === 'auto' && (
                <div className="space-y-3">
                  <label className="flex items-start gap-2 text-[13px] font-medium">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-primary"
                      checked={Boolean(settings.cardOutline)}
                      onChange={(event) => updateSettings({ cardOutline: event.target.checked })}
                    />
                    {t('Cutting rectangle (0.25 px)')}
                  </label>
                  <label className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                    {t('Outline color')}
                    <span className="flex items-center gap-2" dir="ltr">
                      <span>{getCardOutlineColor(settings.cardOutlineColor)}</span>
                      <input
                        type="color"
                        aria-label={t('Outline color')}
                        value={getCardOutlineColor(settings.cardOutlineColor)}
                        disabled={!settings.cardOutline}
                        onChange={(event) =>
                          updateSettings({
                            cardOutlineColor: getCardOutlineColor(event.target.value)
                          })
                        }
                        className="h-9 w-12 cursor-pointer rounded-[var(--ui-radius-md)] border border-input bg-background p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </span>
                  </label>
                </div>
              )}
              {settings.mode !== 'auto' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('Choose card size or enter your own below')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STANDARD_CARD_SIZES.map((size) => (
                      <Button
                        key={size.label}
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateSettings({ widthMm: size.widthMm, heightMm: size.heightMm })
                        }
                      >
                        {size.label}
                      </Button>
                    ))}
                    {artwork && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateSettings({ widthMm: artwork.widthMm, heightMm: artwork.heightMm })
                        }
                      >
                        {t('Use original size')}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <NumericField
                  label={t('Card width (cm)')}
                  value={layout.widthMm / 10}
                  min={0.5}
                  max={29.7}
                  disabled={settings.mode === 'auto'}
                  onChange={(value) => updateSettings({ widthMm: value * 10 })}
                />
                <NumericField
                  label={t('Card height (cm)')}
                  value={layout.heightMm / 10}
                  min={0.5}
                  max={29.7}
                  disabled={settings.mode === 'auto'}
                  onChange={(value) => updateSettings({ heightMm: value * 10 })}
                />
                {settings.mode === 'spaced' && (
                  <>
                    <NumericField
                      label={t('Horizontal gap (mm)')}
                      value={settings.horizontalGapMm}
                      onChange={(value) => updateSettings({ horizontalGapMm: value })}
                    />
                    <NumericField
                      label={t('Vertical gap (mm)')}
                      value={settings.verticalGapMm}
                      onChange={(value) => updateSettings({ verticalGapMm: value })}
                    />
                  </>
                )}
                {settings.mode === 'auto' && (
                  <NumericField
                    label={t('Space between columns (cm)')}
                    value={(settings.autoHorizontalGapMm ?? 10) / 10}
                    max={10}
                    onChange={(value) => updateSettings({ autoHorizontalGapMm: value * 10 })}
                  />
                )}
              </div>
              {settings.mode !== 'auto' && (
                <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                  {t('Artwork sizing')}
                  <select
                    className={inputClass}
                    value={settings.artworkFit}
                    onChange={(event) =>
                      updateSettings({
                        artworkFit: event.target.value as CardMontageSettings['artworkFit']
                      })
                    }
                  >
                    <option value="stretch">{t('Resize to exact card size')}</option>
                    <option value="contain">
                      {t('Keep proportions (may leave white borders)')}
                    </option>
                  </select>
                </label>
              )}
            </section>
            <section className="space-y-3 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
              <h2 className="text-sm font-semibold">{t('3. A4 sheet setup')}</h2>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                {t('Orientation')}
                <select
                  className={inputClass}
                  value={settings.orientation}
                  onChange={(event) =>
                    updateSettings({
                      orientation: event.target.value as CardMontageSettings['orientation']
                    })
                  }
                >
                  <option value="portrait">{t('Portrait · 21 × 29.7 cm')}</option>
                  <option value="landscape">{t('Landscape · 29.7 × 21 cm')}</option>
                </select>
              </label>
            </section>
          </ToolSettingsTabs>
        </fieldset>
        <section className="min-w-0 space-y-4 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 lg:sticky lg:top-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">
                {previewSide === 'both'
                  ? 'Front and back A4 previews'
                  : `${previewSide === 'front' ? 'Front' : 'Back'} A4 sheet preview`}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Centered layout · {(layout.widthMm / 10).toFixed(2)} ×{' '}
                {(layout.heightMm / 10).toFixed(2)} cm cards
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {layout.errors.length
                ? 'Check settings'
                : `${layout.capacity} cards · ${layout.columns} × ${layout.rows}`}
            </span>
          </div>
          <div className="flex gap-2" role="group" aria-label={t('Side to preview')}>
            <Button
              size="sm"
              variant={previewSide === 'front' ? 'selected' : 'outline'}
              aria-pressed={previewSide === 'front'}
              onClick={() => setPreviewSide('front')}
            >
              {t('Front side')}
            </Button>
            <Button
              size="sm"
              variant={previewSide === 'back' ? 'selected' : 'outline'}
              aria-pressed={previewSide === 'back'}
              disabled={!draft.back}
              onClick={() => setPreviewSide('back')}
            >
              {t('Back side')}
            </Button>
            <Button
              size="sm"
              variant={previewSide === 'both' ? 'selected' : 'outline'}
              aria-pressed={previewSide === 'both'}
              onClick={() => setPreviewSide('both')}
            >
              {t('Both sides')}
            </Button>
          </div>
          {settings.includeBack && !draft.back && (
            <p role="alert" className="text-sm text-destructive">
              {t('Import a back design or turn off back-side export.')}
            </p>
          )}
          {unembeddedFonts.length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              Export is stopped: font data is missing for {unembeddedFonts.join(', ')}.
            </p>
          )}
          {layout.errors.length > 0 ? (
            <div
              role="alert"
              className="space-y-1 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
            >
              {layout.errors.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : (
            <CardPreviewViewport
              key={previewResetKey}
              sides={previewSides}
              front={artwork}
              back={draft.back ?? null}
              layout={layout}
              backLayout={backLayout}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {layout.horizontalGapMm} mm horizontal · {layout.verticalGapMm} mm vertical.
          </p>
        </section>
      </div>
    </div>
  )
}
