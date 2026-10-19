import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RotateCw, Scan } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ActionButton } from '@/components/ui/action-button'
import { ToolHeader } from '@/tools/shared/ToolHeader'
import { useLanguage } from '@/i18n/useLanguage'
import { initializeLanguage } from '@/i18n/language'
import { initializeTheme } from '@/appearance/theme'
import { getPerformancePreset } from '@/performance/performanceSettings'
import {
  fullIdCrop,
  validIdCrop,
  idCardPlacement,
  idCardAngle,
  type IdCrop,
  type IdPoint
} from '../../../shared/fast-print-id'
import type { FastPrintBatchSource, FastPrintPreset } from '../../../shared/fast-print'
import {
  loadIdArtwork,
  autoIdCrop,
  orientIdArtwork,
  drawIdSheet,
  type IdArtwork,
  type IdSide
} from './idArtwork'
import '@/styles.css'

function IdPrint({ batch }: { batch: FastPrintBatchSource }): JSX.Element {
  const { t, direction } = useLanguage()
  const [sources, setSources] = useState<IdArtwork[]>([])
  const [sides, setSides] = useState<[IdSide | null, IdSide | null]>([null, null])
  const [active, setActive] = useState(0)
  const [color, setColor] = useState(batch.preset.color)
  const [duplex, setDuplex] = useState(batch.canDuplex === true)
  const [busy, setBusy] = useState(true)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)
  const preset: FastPrintPreset = { ...batch.preset, color, duplex }
  const names = ['Front', 'Back']
  const corners = [
    'Top left corner',
    'Top right corner',
    'Bottom right corner',
    'Bottom left corner'
  ]

  function initialSide(source: IdArtwork): IdSide {
    return { sourceId: source.id, turns: 0, crop: autoIdCrop(source.canvas) }
  }
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
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
        setSources(loaded)
        setSides([
          loaded[0] ? initialSide(loaded[0]) : null,
          loaded[1] ? initialSide(loaded[1]) : null
        ])
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
  const previews = useMemo(
    () =>
      sides.map((side, i) => {
        if (!side || !oriented[i]) return null
        try {
          const placement = idCardPlacement(
            oriented[i]!.width,
            oriented[i]!.height,
            side.crop,
            preset.paper,
            preset.landscape,
            side.angleDegrees
          )
          return {
            url: drawIdSheet(
              oriented[i]!,
              side.crop,
              preset,
              getPerformancePreset() === 'low-end' ? 60 : 85,
              side.angleDegrees
            ).toDataURL('image/png'),
            heightMm: placement.heightMm,
            error: ''
          }
        } catch (reason) {
          return {
            url: '',
            heightMm: 0,
            error: reason instanceof Error ? reason.message : String(reason)
          }
        }
      }),
    [sides, oriented, color, preset.paper, preset.landscape]
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
      setSources((previous) => [...previous, ...loaded])
      setSides((previous) => {
        let index = 0
        return previous.map(
          (value) => value ?? (loaded[index] ? initialSide(loaded[index++]) : null)
        ) as typeof previous
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
    try {
      // ID sides are one duplex document: never insert a batch blank between front and back.
      for (let i = 0; i < 2; i++) {
        const sheet = drawIdSheet(oriented[i]!, sides[i]!.crop, preset, 300, sides[i]!.angleDegrees)
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
      // Finish the worker after any preparation/submission failure; never append duplicate sides on retry.
      await window.fastPrint.finish(reason instanceof Error ? reason.message : String(reason))
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4" dir={direction}>
      <ToolHeader
        title="ID card — 9 cm"
        projectName={`${batch.preset.printer} · ${batch.preset.paper}${batch.preset.profileName ? ` · ${batch.preset.profileName}` : ''}`}
        onBack={() => void window.fastPrint.finish()}
        backDisabled={busy}
        backLabel="Cancel"
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
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('Color mode')}>
          {[false, true].map((value) => (
            <Button
              key={String(value)}
              type="button"
              variant={color === value ? 'selected' : 'outline'}
              aria-pressed={color === value}
              disabled={busy || sent || (value && batch.canColor !== true)}
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
            {batch.canDuplex && <option value="auto">{t('Automatic duplex')}</option>}
            <option value="manual">{t('Two pages (manual duplex)')}</option>
          </select>
        </label>
        <span className="text-xs text-muted-foreground">
          {t('Width: 9 cm · Height: proportional · Centered')}
        </span>
      </div>
      {(error || busy) && (
        <p role={sent || busy ? 'status' : 'alert'} aria-live="polite">
          {t(error || 'Preparing…')}
        </p>
      )}
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
                updateSide(selected ? initialSide(selected) : null)
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
                    width: `min(100%, ${Math.round((art.width / art.height) * 240)}px)`,
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
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || sent}
                  onClick={() => {
                    const crop = [side.crop[3], side.crop[0], side.crop[1], side.crop[2]].map(
                      (p) => ({ x: 1 - p.y, y: p.x })
                    ) as IdCrop
                    updateSide({
                      ...side,
                      turns: (side.turns + 1) % 4,
                      crop,
                      angleDegrees: undefined
                    })
                  }}
                >
                  <RotateCw aria-hidden="true" />
                  {t('Rotate')}
                </Button>
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
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2" htmlFor="id-card-angle">
                  {t('Card angle (°)')}
                  <Input
                    id="id-card-angle"
                    type="number"
                    className="w-24"
                    dir="ltr"
                    min={-180}
                    max={180}
                    step={0.1}
                    value={Number(
                      (side.angleDegrees ?? idCardAngle(art.width, art.height, side.crop)).toFixed(
                        1
                      )
                    )}
                    disabled={busy || sent}
                    aria-describedby="id-card-angle-help"
                    onChange={(event) => {
                      const value = event.target.valueAsNumber
                      if (Number.isFinite(value))
                        updateSide({ ...side, angleDegrees: Math.max(-180, Math.min(180, value)) })
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant={side.angleDegrees === undefined ? 'selected' : 'outline'}
                  aria-pressed={side.angleDegrees === undefined}
                  disabled={busy || sent}
                  onClick={() => updateSide({ ...side, angleDegrees: undefined })}
                >
                  {t('Auto straighten')}
                </Button>
              </div>
              <p id="id-card-angle-help" className="mt-2 text-xs text-muted-foreground">
                {t(
                  'Match the card’s tilt. The selected card is straightened and centered for printing.'
                )}
              </p>
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
                <h3 className="mb-2 font-medium">{t(name)}</h3>
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
                    90 × {previews[i]!.heightMm.toFixed(1)} mm
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
                /pdf|xps/i.test(batch.preset.printer)
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
