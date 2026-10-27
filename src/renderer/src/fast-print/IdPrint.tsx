import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RotateCw, Scan } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/ui/action-button'
import { ToolHeader } from '@/tools/shared/ToolHeader'
import { useLanguage } from '@/i18n/useLanguage'
import { initializeLanguage } from '@/i18n/language'
import { initializeTheme } from '@/appearance/theme'
import { getPerformancePreset } from '@/performance/performanceSettings'
import {
  fullIdCrop,
  validIdCrop,
  isFullIdCrop,
  idCopiesLayout,
  MAX_IDS_PER_SHEET,
  DEFAULT_ID_SHEET_SETTINGS,
  idPrintedSize,
  horizontalIdSide,
  type IdCrop,
  type IdPoint
} from '../../../shared/fast-print-id'
import type { FastPrintBatchSource, FastPrintPreset } from '../../../shared/fast-print'
import {
  loadIdArtwork,
  autoIdCrop,
  IdAutoAnalyzer,
  orientIdArtwork,
  drawIdSheet,
  type IdArtwork,
  type IdSide
} from './idArtwork'
import '@/styles.css'
import { compareDriverPresets } from '../../../shared/printer-preferences'

function IdPrint({ batch }: { batch: FastPrintBatchSource }): JSX.Element {
  const { t, direction } = useLanguage()
  const [sources, setSources] = useState<IdArtwork[]>([])
  const [sides, setSides] = useState<[IdSide | null, IdSide | null]>([null, null])
  const [active, setActive] = useState(0)
  const [color, setColor] = useState(batch.preset.color)
  const [duplex, setDuplex] = useState(batch.canDuplex === true && batch.preset.duplex === true)
  const [printerSelection, setPrinterSelection] = useState({
    preset: batch.preset,
    canColor: batch.canColor === true,
    canDuplex: batch.canDuplex === true
  })
  const [busy, setBusy] = useState(true)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [idsPerSheet, setIdsPerSheet] = useState(batch.idDraft?.idsPerSheet ?? 1)
  const [sheetSettings, setSheetSettings] = useState(
    batch.idDraft?.sheetSettings ?? { ...DEFAULT_ID_SHEET_SETTINGS }
  )
  const input = useRef<HTMLInputElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)
  const preset: FastPrintPreset = { ...printerSelection.preset, color, duplex }
  const driverPresets = batch.driverPresets
    ?.filter((profile) => profile.printer === preset.printer)
    .sort(compareDriverPresets)
  const names = ['Front', 'Back']
  const corners = [
    'Top left corner',
    'Top right corner',
    'Bottom right corner',
    'Bottom left corner'
  ]

  const analyzer = useMemo(() => new IdAutoAnalyzer(), [])
  const initialSide = (source: IdArtwork): Promise<IdSide> => analyzer.analyze(source)
  useEffect(() => () => analyzer.dispose(), [analyzer])
  async function selectSource(selected?: IdArtwork) {
    setBusy(true)
    setError('')
    try {
      updateSide(selected ? await initialSide(selected) : null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (batch.idDraft) {
          const loaded: IdArtwork[] = []
          for (const item of batch.idDraft.sources) {
            const bytes = Uint8Array.from(atob(item.png.split(',')[1]), (character) =>
              character.charCodeAt(0)
            )
            const [artwork] = await loadIdArtwork(item.name, '.png', bytes)
            loaded.push({ ...artwork, id: item.id })
          }
          if (cancelled) return
          const restored: [IdSide | null, IdSide | null] = [null, null]
          for (const [index, side] of batch.idDraft.sides.entries()) {
            const source = loaded.find((item) => item.id === side?.sourceId)
            if (!side || !source) continue
            const horizontal = {
              ...horizontalIdSide(source.canvas.width, source.canvas.height, side),
              ...(side.sheetTurns === undefined
                ? {}
                : { sheetTurns: side.sheetTurns % 2 ? 0 : side.sheetTurns })
            }
            restored[index] =
              horizontal.turns !== side.turns || horizontal.crop !== side.crop
                ? await analyzer.orient(source, horizontal)
                : horizontal
          }
          if (cancelled) return
          setSources(loaded)
          setSides(restored)
          setActive(batch.idDraft.active)
          setNotice('ID edits restored.')
          return
        }
        if (batch.files.length > 8)
          throw new Error('Choose up to 8 images or PDF pages for one ID job.')
        const loaded: IdArtwork[] = []
        for (let i = 0; i < batch.files.length; i++) {
          const file = await window.fastPrint.file(i)
          loaded.push(...(await loadIdArtwork(file.name, file.extension, file.bytes)))
          if (loaded.length > 8)
            throw new Error('Choose up to 8 images or PDF pages for one ID job.')
        }
        if (cancelled) return
        const first = loaded[0] ? await initialSide(loaded[0]) : null
        const second = loaded[1] ? await initialSide(loaded[1]) : null
        if (cancelled) return
        setSources(loaded)
        setSides([first, second])
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [batch])

  const oriented = useMemo(
    () =>
      sides.map((side) => {
        const source = sources.find((item) => item.id === side?.sourceId)
        return source && side ? orientIdArtwork(source, side.turns) : null
      }),
    [sides[0]?.sourceId, sides[0]?.turns, sides[1]?.sourceId, sides[1]?.turns, sources]
  )
  const copiesLayout = useMemo(() => {
    const sizes = sides
      .filter(Boolean)
      .map((side) => idPrintedSize(sheetSettings.heightMm, side!.sheetTurns))
    if (!sizes.length) sizes.push(idPrintedSize(sheetSettings.heightMm))
    const heights = sizes.map((size) => size.heightMm),
      options = {
        cellWidthMm: Math.max(...sizes.map((size) => size.widthMm)),
        marginMm: sheetSettings.marginMm,
        gapMm: sheetSettings.gapMm,
        spacing: sheetSettings.spacing
      }
    let capacity = 0,
      count = idsPerSheet
    try {
      capacity = idCopiesLayout(
        preset.paper,
        preset.landscape === true,
        heights,
        1,
        options
      ).capacity
      count = sheetSettings.fillSheet ? capacity : idsPerSheet
      return {
        layout: idCopiesLayout(preset.paper, preset.landscape === true, heights, count, options),
        capacity,
        count,
        error: ''
      }
    } catch (reason) {
      return {
        layout: null,
        capacity,
        count,
        error: reason instanceof Error ? reason.message : String(reason)
      }
    }
  }, [sides, sheetSettings, preset.paper, preset.landscape, idsPerSheet])
  const count = copiesLayout.count
  const previews = useMemo(
    () =>
      sides.map((side, i) => {
        if (!side || !oriented[i]) return null
        try {
          if (!copiesLayout.layout) throw new Error(copiesLayout.error)
          const size = idPrintedSize(sheetSettings.heightMm, side.sheetTurns)
          return {
            url: drawIdSheet(
              oriented[i]!,
              side.crop,
              preset,
              getPerformancePreset() === 'low-end' ? 60 : 85,
              undefined,
              {
                count,
                cellHeightMm: copiesLayout.layout.cellHeightMm,
                back: i === 1,
                settings: sheetSettings,
                sheetTurns: side.sheetTurns,
                layout: copiesLayout.layout
              }
            ).toDataURL('image/png'),
            ...size,
            error: ''
          }
        } catch (reason) {
          return {
            url: '',
            widthMm: 90,
            heightMm: sheetSettings.heightMm,
            error: reason instanceof Error ? reason.message : String(reason)
          }
        }
      }),
    [sides, oriented, color, preset.paper, preset.landscape, count, sheetSettings, copiesLayout]
  )
  const side = sides[active]
  const art = oriented[active]
  const source = sources.find((item) => item.id === side?.sourceId)
  const artUrl = useMemo(() => art?.toDataURL('image/png'), [art])
  const canPrint =
    sides.every(Boolean) && previews.every((preview) => preview && !preview.error) && !busy && !sent

  function updateSide(next: IdSide | null) {
    setSides(
      (previous) => previous.map((value, i) => (i === active ? next : value)) as typeof previous
    )
  }
  function moveCorner(index: number, point: IdPoint) {
    if (!side) return
    const crop = side.crop.map((value, i) => (i === index ? point : value)) as IdCrop
    if (validIdCrop(crop)) updateSide({ ...side, crop })
  }
  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError('')
    try {
      const loaded: IdArtwork[] = []
      for (const file of Array.from(files)) {
        if (file.size > 512 * 1024 * 1024)
          throw new Error('Choose a non-empty document smaller than 512 MB.')
        const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
        if (!['.png', '.jpg', '.jpeg', '.gif', '.pdf'].includes(extension))
          throw new Error('Choose PDF, PNG, JPEG or GIF files.')
        loaded.push(
          ...(await loadIdArtwork(file.name, extension, new Uint8Array(await file.arrayBuffer())))
        )
        if (sources.length + loaded.length > 8)
          throw new Error('Choose up to 8 images or PDF pages for one ID job.')
      }
      const defaults: IdSide[] = []
      for (const source of loaded.slice(0, sides.filter((value) => !value).length))
        defaults.push(await initialSide(source))
      setSources((previous) => [...previous, ...loaded])
      setSides((previous) => {
        let index = 0
        return previous.map((value) => value ?? defaults[index++] ?? null) as typeof previous
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  async function print() {
    if (!canPrint) return
    setBusy(true)
    setError('')
    let preparingSheets = false
    try {
      if (batch.canReturnToSettings) await window.fastPrint.saveIdDraft(reviewDraft())
      preparingSheets = true
      // ID sides are one duplex document: never insert a batch blank between front and back.
      for (let i = 0; i < 2; i++) {
        const sheet = drawIdSheet(
          oriented[i]!,
          sides[i]!.crop,
          preset,
          300,
          sides[i]!.angleDegrees,
          {
            count,
            cellHeightMm: copiesLayout.layout!.cellHeightMm,
            back: i === 1,
            settings: sheetSettings,
            sheetTurns: sides[i]!.sheetTurns,
            layout: copiesLayout.layout!
          }
        )
        try {
          await window.fastPrint.sheet(sheet.toDataURL('image/png'))
        } finally {
          sheet.width = 0
          sheet.height = 0
        }
      }
      const result = await window.fastPrint.submit({
        color,
        duplex,
        idsPerSheet: count,
        manualDuplexPrompt: {
          title: t('Fast Print — print the back'),
          message: t(
            'Wait for the front side to finish printing. Reinsert the same sheet using your printer’s manual-duplex feed direction, then click OK to print the back. Cancel leaves the back unprinted.'
          ),
          rtl: direction === 'rtl'
        }
      })
      setSent(true)
      setError(
        result.manualBackCanceled
          ? 'Front submitted; back canceled.'
          : result.verified
            ? 'Print settings verified'
            : 'Sent to print queue'
      )
      await new Promise((resolve) => setTimeout(resolve, result.manualBackCanceled ? 3500 : 1600))
      await window.fastPrint.finish()
    } catch (reason) {
      if (!preparingSheets) {
        setError(reason instanceof Error ? reason.message : String(reason))
        setBusy(false)
        return
      }
      // After transferring sheets, finish the worker to prevent duplicate sides on retry.
      await window.fastPrint.finish(reason instanceof Error ? reason.message : String(reason))
    }
  }

  function reviewDraft() {
    return {
      version: 1 as const,
      printer: preset.printer,
      sources: sources.map((item) => ({
        id: item.id,
        name: item.name,
        png: item.canvas.toDataURL('image/png')
      })),
      sides,
      active,
      color,
      duplex,
      idsPerSheet: count,
      sheetSettings
    }
  }
  async function returnToSettings() {
    if (busy || sent) return
    if (!batch.canReturnToSettings) {
      await window.fastPrint.finish()
      return
    }
    setBusy(true)
    setError('')
    try {
      await window.fastPrint.back(reviewDraft())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      setBusy(false)
    }
  }

  async function selectPrinter(name: string) {
    if (busy || sent || name === preset.printer) return
    setBusy(true)
    setError('')
    try {
      const selection = await window.fastPrint.selectIdPrinter(name, reviewDraft())
      setPrinterSelection(selection)
      setColor(selection.preset.color)
      setDuplex(selection.preset.duplex === true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }
  async function selectDriverPreset(id: string) {
    if (busy || sent) return
    setBusy(true)
    setError('')
    try {
      const selection = await window.fastPrint.selectIdPreset(id, reviewDraft())
      setPrinterSelection(selection)
      setColor(selection.preset.color)
      setDuplex(selection.preset.duplex === true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4 text-foreground"
      dir={direction}
    >
      <ToolHeader
        title="ID card — 9 cm"
        projectName={`${preset.printer} · ${preset.paper}${preset.profileName ? ` · ${preset.profileName}` : ''}`}
        onBack={() => void returnToSettings()}
        backDisabled={busy || sent}
        backLabel={batch.canReturnToSettings ? 'Printer settings' : 'Cancel'}
        print={{
          mode: 'fast-print',
          onPrint: () => void print(),
          disabled: !canPrint,
          isBusy: busy
        }}
        actions={
          <ActionButton
            action="import"
            disabled={busy || sent}
            onClick={() => input.current?.click()}
          >
            {t('Add images or PDF')}
          </ActionButton>
        }
      />
      <input
        ref={input}
        type="file"
        accept=".png,.jpg,.jpeg,.gif,.pdf"
        multiple
        className="hidden"
        aria-label={t('Add images or PDF')}
        onChange={(event) => void addFiles(event.target.files)}
      />
      <div className="flex flex-wrap items-center gap-4 rounded-[var(--ui-radius-lg)] border bg-card p-4">
        {batch.printers && (
          <label
            className="flex min-w-0 max-w-full flex-wrap items-center gap-2"
            htmlFor="id-printer"
          >
            {t('Printer')}
            <select
              id="id-printer"
              className="h-9 min-w-0 max-w-full rounded-[var(--ui-radius-md)] border bg-background px-3 sm:max-w-80"
              value={preset.printer}
              disabled={busy || sent}
              onChange={(event) => void selectPrinter(event.target.value)}
            >
              {batch.printers.map((device) => (
                <option
                  key={device.name}
                  value={device.name}
                  disabled={!device.papers.some((paper) => paper === 'A4' || paper === 'A3')}
                >
                  {device.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {driverPresets && (
          <label
            className="flex min-w-0 max-w-full flex-wrap items-center gap-2"
            htmlFor="id-driver-preset"
          >
            {t('Saved driver preset')}
            <select
              id="id-driver-preset"
              className="h-9 min-w-0 max-w-full rounded-[var(--ui-radius-md)] border bg-background px-3 sm:max-w-80"
              value={
                driverPresets.some((profile) => profile.id === preset.profileId)
                  ? preset.profileId
                  : 'current'
              }
              disabled={
                busy ||
                sent ||
                !driverPresets.some(
                  (profile) => profile.usable && ['A4', 'A3'].includes(profile.paper)
                )
              }
              onChange={(event) => void selectDriverPreset(event.target.value)}
            >
              {!driverPresets.some((profile) => profile.id === preset.profileId) && (
                <option value="current" disabled>
                  {t(
                    driverPresets.length
                      ? 'Current printer options'
                      : 'No saved presets for this printer.'
                  )}
                </option>
              )}
              {driverPresets.map((profile) => (
                <option
                  key={profile.id}
                  value={profile.id}
                  disabled={!profile.usable || !['A4', 'A3'].includes(profile.paper)}
                  title={profile.error}
                >
                  {profile.name} · {profile.paper} · {t(profile.color ? 'Color' : 'Black & white')}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('Color mode')}>
          {[false, true].map((value) => (
            <Button
              key={String(value)}
              type="button"
              variant={color === value ? 'selected' : 'outline'}
              aria-pressed={color === value}
              disabled={busy || sent || (value && !printerSelection.canColor)}
              onClick={() => setColor(value)}
            >
              {t(value ? 'Color' : 'Black & white')}
            </Button>
          ))}
        </div>
        <label className="flex min-w-0 flex-wrap items-center gap-2">
          {t('Two-sided printing')}
          <select
            className="h-9 max-w-full rounded-[var(--ui-radius-md)] border bg-background px-3"
            value={duplex ? 'auto' : 'manual'}
            disabled={busy || sent}
            onChange={(event) => setDuplex(event.target.value === 'auto')}
          >
            {printerSelection.canDuplex && <option value="auto">{t('Automatic duplex')}</option>}
            <option value="manual">{t('Two pages (manual duplex)')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2" htmlFor="id-card-size">
          {t('Card size')}
          <select
            id="id-card-size"
            className="h-9 rounded-[var(--ui-radius-md)] border bg-background px-3"
            dir="ltr"
            value={sheetSettings.heightMm}
            disabled={busy || sent}
            onChange={(event) =>
              setSheetSettings((previous) => ({
                ...previous,
                heightMm: Number(event.target.value)
              }))
            }
          >
            {[55, 56, 60].map((height) => (
              <option key={height} value={height}>
                90 × {height} mm
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2" htmlFor="id-copies-per-sheet">
          {t('Sheet preset')}
          <select
            id="id-copies-per-sheet"
            className="h-9 max-w-full rounded-[var(--ui-radius-md)] border bg-background px-3"
            value={sheetSettings.fillSheet ? 'fill' : idsPerSheet}
            disabled={busy || sent}
            aria-describedby="id-copies-help"
            onChange={(event) => {
              const fillSheet = event.target.value === 'fill'
              setSheetSettings((previous) => ({ ...previous, fillSheet }))
              if (!fillSheet) setIdsPerSheet(Number(event.target.value))
            }}
          >
            <option value="fill">{t('Fill sheet')}</option>
            <optgroup label={t('Common presets')}>
              {[1, 2, 4, 6, 8].map((value) => (
                <option
                  key={value}
                  value={value}
                  disabled={copiesLayout.capacity > 0 && value > copiesLayout.capacity}
                >
                  {value} · {t('IDs per sheet')}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('More copies')}>
              {Array.from({ length: MAX_IDS_PER_SHEET }, (_, index) => index + 1)
                .filter((value) => ![1, 2, 4, 6, 8].includes(value))
                .map((value) => (
                  <option
                    key={value}
                    value={value}
                    disabled={copiesLayout.capacity > 0 && value > copiesLayout.capacity}
                  >
                    {value} · {t('IDs per sheet')}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
        <label className="flex items-center gap-2" htmlFor="id-sheet-spacing">
          {t('Spacing')}
          <select
            id="id-sheet-spacing"
            className="h-9 rounded-[var(--ui-radius-md)] border bg-background px-3"
            value={sheetSettings.spacing}
            disabled={busy || sent}
            onChange={(event) =>
              setSheetSettings((previous) => ({
                ...previous,
                spacing: event.target.value as 'compact' | 'even'
              }))
            }
          >
            <option value="even">{t('Even spacing')}</option>
            <option value="compact">{t('Compact')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2" htmlFor="id-sheet-margin">
          {t('Margins')}
          <select
            id="id-sheet-margin"
            className="h-9 rounded-[var(--ui-radius-md)] border bg-background px-3"
            dir="ltr"
            value={sheetSettings.marginMm}
            disabled={busy || sent}
            onChange={(event) =>
              setSheetSettings((previous) => ({
                ...previous,
                marginMm: Number(event.target.value)
              }))
            }
          >
            {[5, 7, 10, 15, 20].map((value) => (
              <option key={value} value={value}>
                {value} mm
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2" htmlFor="id-sheet-gap">
          {t('Cutting gap')}
          <select
            id="id-sheet-gap"
            className="h-9 rounded-[var(--ui-radius-md)] border bg-background px-3"
            dir="ltr"
            value={sheetSettings.gapMm}
            disabled={busy || sent}
            onChange={(event) =>
              setSheetSettings((previous) => ({ ...previous, gapMm: Number(event.target.value) }))
            }
          >
            {[3, 5, 8, 10].map((value) => (
              <option key={value} value={value}>
                {value} mm
              </option>
            ))}
          </select>
        </label>
        <span id="id-copies-help" className="text-xs text-muted-foreground">
          {t('Matching front/back size')} · <bdi dir="ltr">90 × {sheetSettings.heightMm} mm</bdi> ·{' '}
          {count} {t('IDs per sheet')}
          {copiesLayout.capacity > 0 && (
            <>
              {' '}
              · {t('Maximum on this sheet:')} {copiesLayout.capacity}
            </>
          )}
        </span>
      </div>
      {(error || busy) && (
        <p role={sent || busy ? 'status' : 'alert'} aria-live="polite">
          {t(error || 'Preparing…')}
        </p>
      )}
      {!error && !busy && notice && <p role="status">{t(notice)}</p>}
      {!busy && copiesLayout.error && <p role="alert">{t(copiesLayout.error)}</p>}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section
          className="min-w-0 rounded-[var(--ui-radius-lg)] border bg-card p-4"
          aria-label={t('Crop card')}
        >
          <div className="mb-4 flex gap-2" role="group" aria-label={t('Card side')}>
            {names.map((name, i) => (
              <Button
                key={name}
                type="button"
                variant={active === i ? 'selected' : 'outline'}
                aria-pressed={active === i}
                onClick={() => setActive(i)}
                disabled={busy || sent}
              >
                {t(name)}
              </Button>
            ))}
          </div>
          <label className="mb-4 flex min-w-0 flex-col gap-2">
            {t(active === 0 ? 'Front image' : 'Back image')}
            <select
              className="h-9 w-full min-w-0 rounded-[var(--ui-radius-md)] border bg-background px-3"
              value={side?.sourceId ?? ''}
              disabled={busy || sent}
              onChange={(event) => {
                const selected = sources.find((item) => item.id === event.target.value)
                void selectSource(selected)
              }}
            >
              <option value="">{t('Choose an image')}</option>
              {sources.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {side && art && source ? (
            <>
              <div
                className="flex min-h-48 items-center justify-center overflow-hidden rounded-[var(--ui-radius-md)] border bg-muted p-4"
                dir="ltr"
              >
                <div
                  ref={stage}
                  className="relative select-none"
                  style={{
                    width: `min(100%, calc(clamp(180px, calc(100vh - 600px), 360px) * ${art.width / art.height}))`,
                    aspectRatio: `${art.width}/${art.height}`,
                    touchAction: 'none'
                  }}
                  onPointerMove={(event) => {
                    if (drag.current === null || !stage.current) return
                    const rect = stage.current.getBoundingClientRect()
                    moveCorner(drag.current, {
                      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
                      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
                    })
                  }}
                  onPointerUp={() => {
                    drag.current = null
                  }}
                  onPointerCancel={() => {
                    drag.current = null
                  }}
                >
                  <img src={artUrl} alt={source.name} className="block w-full" draggable={false} />
                  <svg
                    className="pointer-events-none absolute inset-0 size-full"
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d={`M0,0 H1 V1 H0 Z M${side.crop.map((p) => `${p.x},${p.y}`).join(' L')} Z`}
                      fill="black"
                      fillOpacity="0.5"
                      fillRule="evenodd"
                    />
                    <polygon
                      points={side.crop.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {side.crop.map((point, i) => (
                    <button
                      key={i}
                      type="button"
                      className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        left: `${point.x * 100}%`,
                        top: `${point.y * 100}%`,
                        cursor: 'move'
                      }}
                      aria-label={t(corners[i])}
                      title={t(corners[i])}
                      disabled={busy || sent}
                      onPointerDown={(event) => {
                        drag.current = i
                        event.currentTarget.setPointerCapture(event.pointerId)
                      }}
                      onKeyDown={(event) => {
                        const delta = event.shiftKey ? 0.02 : 0.005
                        const offsets: Record<string, [number, number]> = {
                          ArrowLeft: [-delta, 0],
                          ArrowRight: [delta, 0],
                          ArrowUp: [0, -delta],
                          ArrowDown: [0, delta]
                        }
                        if (!offsets[event.key]) return
                        event.preventDefault()
                        const [dx, dy] = offsets[event.key]
                        moveCorner(i, {
                          x: Math.max(0, Math.min(1, point.x + dx)),
                          y: Math.max(0, Math.min(1, point.y + dy))
                        })
                      }}
                    />
                  ))}
                </div>
              </div>
              <p className="my-3 text-xs text-muted-foreground">
                {t('Drag the corners around the card. Arrow keys adjust a focused corner.')}
              </p>
              {side.orientationVerified === false && (
                <p role="status" className="mb-3 text-sm">
                  {t(
                    'Check orientation before printing. Rotate the side in the sheet preview if needed.'
                  )}
                </p>
              )}
              {isFullIdCrop(side.crop) && (
                <p role="status" className="mb-3 text-sm">
                  {t('Check the card outline. Adjust the four corners to remove the background.')}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || sent}
                  onClick={() =>
                    updateSide({ ...side, crop: autoIdCrop(art), angleDegrees: undefined })
                  }
                >
                  <Scan aria-hidden="true" />
                  {t('Auto crop')}
                </Button>
                <ActionButton
                  action="reset"
                  disabled={busy || sent}
                  onClick={() =>
                    updateSide({ ...side, crop: fullIdCrop(), angleDegrees: undefined })
                  }
                >
                  {t('Reset crop')}
                </ActionButton>
              </div>
            </>
          ) : (
            <div className="flex min-h-48 items-center justify-center rounded-[var(--ui-radius-md)] border border-dashed p-6 text-muted-foreground">
              {t('Choose a photo for this side. You can use the same photo for both sides.')}
            </div>
          )}
        </section>
        <section
          className="min-w-0 rounded-[var(--ui-radius-lg)] border bg-card p-4"
          aria-label={t('Print preview')}
        >
          <h2 className="mb-4 font-semibold">{t('Print preview')}</h2>
          <div className="grid grid-cols-2 gap-4" dir="ltr">
            {names.map((name, i) => (
              <div key={name} className="min-w-0 text-center" dir={direction}>
                <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                  <h3 className="font-medium">{t(name)}</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || sent || !sides[i]}
                    aria-label={t(i === 0 ? 'Rotate front on sheet' : 'Rotate back on sheet')}
                    data-id-sheet-rotate={i}
                    onClick={() =>
                      setSides(
                        (previous) =>
                          previous.map((side, index) =>
                            side && index === i
                              ? { ...side, sheetTurns: ((side.sheetTurns ?? 0) + 2) % 4 }
                              : side
                          ) as typeof previous
                      )
                    }
                  >
                    <RotateCw aria-hidden="true" />
                    {t('Rotate 180°')}
                  </Button>
                </div>
                {previews[i]?.url ? (
                  <img
                    src={previews[i]!.url}
                    alt={t(name)}
                    className="mx-auto max-h-[350px] w-full border object-contain"
                  />
                ) : (
                  <div className="flex aspect-[210/297] items-center justify-center border bg-muted p-3 text-xs">
                    {t(previews[i]?.error || 'Choose an image')}
                  </div>
                )}
                {previews[i]?.url && (
                  <p className="mt-2 text-xs text-muted-foreground" dir="ltr">
                    {count > 1
                      ? `${count} × (${previews[i]!.widthMm} × ${previews[i]!.heightMm}) mm`
                      : `${previews[i]!.widthMm} × ${previews[i]!.heightMm} mm`}
                  </p>
                )}
              </div>
            ))}
          </div>
          {!sides[1] && (
            <p className="mt-4 text-xs text-muted-foreground">
              {t('Choose a back image before printing.')}
            </p>
          )}
          {!duplex && (
            <p className="mt-4 text-xs text-muted-foreground">
              {t(
                /pdf|xps/i.test(preset.printer)
                  ? 'Saves front and back as two pages in one document.'
                  : 'Front prints first. Reinsert the same sheet when prompted to print the back.'
              )}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

export function openIdPrint(batch: FastPrintBatchSource): void {
  document.getElementById('fast-print-progress-styles')?.remove()
  const root = document.createElement('div')
  root.id = 'root'
  document.body.replaceChildren(root)
  initializeTheme()
  initializeLanguage()
  document.documentElement.dataset.performancePreset = getPerformancePreset()
  createRoot(root).render(<IdPrint batch={batch} />)
}
