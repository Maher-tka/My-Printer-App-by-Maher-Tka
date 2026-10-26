import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/ui/action-button'
import { useLanguage } from '@/i18n/useLanguage'
import { translate } from '@/i18n/language'
import {
  clampStickerBounds,
  detectStickerSheetRegions,
  mergeStickerBounds,
  splitStickerBounds,
  separateStickerSheet,
  type ReviewedStickerBounds,
  type StickerSheetSettings
} from '../lib/stickerSheet'

interface Region extends ReviewedStickerBounds {
  id: string
}
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

export function ImageStickerSheetReview({
  file,
  settings,
  initial,
  onApply,
  onClose
}: {
  file: File
  settings: StickerSheetSettings
  initial?: ReviewedStickerBounds[]
  onApply: (regions: ReviewedStickerBounds[]) => Promise<void>
  onClose: () => void
}): JSX.Element {
  const { t, language } = useLanguage()
  const [url, setUrl] = useState('')
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [regions, setRegions] = useState<Region[]>([])
  const [selected, setSelected] = useState('')
  const [mergeIds, setMergeIds] = useState<string[]>([])
  const [past, setPast] = useState<Region[][]>([])
  const [future, setFuture] = useState<Region[][]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [preparedPreview, setPreparedPreview] = useState('')
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const previewJob = useRef<Promise<void>>(Promise.resolve())
  const drag = useRef<{
    id: string
    handle: Handle
    start: { x: number; y: number }
    original: Region
    snapshot: Region[]
    future: Region[][]
  } | null>(null)
  const active = regions.find((region) => region.id === selected)

  useEffect(() => {
    let cancelled = false
    const source = URL.createObjectURL(file)
    setUrl(source)
    titleRef.current?.focus()
    void (async () => {
      try {
        let width: number, height: number, bounds: ReviewedStickerBounds[]
        if (initial) {
          const bitmap = await createImageBitmap(file)
          width = bitmap.width
          height = bitmap.height
          bitmap.close()
          bounds = initial
        } else {
          const detected = await detectStickerSheetRegions(file, settings)
          width = detected.width
          height = detected.height
          bounds = detected.bounds
        }
        if (cancelled) return
        setSize({ width, height })
        const next = bounds.map((bound, index) => ({
          ...bound,
          removeBackground: initial?.[index].removeBackground ?? false,
          isolateArtwork: initial?.[index].isolateArtwork ?? false,
          id: crypto.randomUUID()
        }))
        setRegions(next)
        setSelected(next[0]?.id ?? '')
        if (!next.length) setError(t('Add a selection around each sticker.'))
      } catch {
        if (!cancelled) {
          // Detection may fail on touching artwork; manual selection still works.
          const bitmap = await createImageBitmap(file).catch(() => null)
          if (bitmap) {
            if (!cancelled) setSize({ width: bitmap.width, height: bitmap.height })
            bitmap.close()
          }
          if (!cancelled)
            setError(t('Automatic selection failed. Add a selection around each sticker.'))
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
      URL.revokeObjectURL(source)
    }
    // Detection runs once on entry. Existing selections are never replaced by a render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  useEffect(() => {
    let cancelled = false,
      preview = ''
    setPreparedPreview('')
    setPreviewError('')
    const needsPreview = active && (active.removeBackground || active.isolateArtwork)
    setPreviewBusy(!!needsPreview)
    if (!needsPreview) return
    const timer = setTimeout(() => {
      previewJob.current = previewJob.current.then(async () => {
        if (cancelled) return
        try {
          const [crop] = await separateStickerSheet(file, settings, [active])
          if (cancelled) return
          preview = URL.createObjectURL(crop.file)
          setPreparedPreview(preview)
        } catch (failure) {
          if (!cancelled)
            setPreviewError(
              translate(failure instanceof Error ? failure.message : String(failure), language)
            )
        } finally {
          if (!cancelled) setPreviewBusy(false)
        }
      })
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(timer)
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [active, file, settings, language])

  const commit = (next: Region[]) => {
    setPast((current) => [...current.slice(-19), regions])
    setFuture([])
    setRegions(next)
    setError('')
  }
  const change = (patch: Partial<ReviewedStickerBounds>) => {
    if (!active || busy) return
    const bounds = clampStickerBounds({ ...active, ...patch })
    const seeds = active.seeds?.filter(
      (p) =>
        p.x >= bounds.x &&
        p.x < bounds.x + bounds.width &&
        p.y >= bounds.y &&
        p.y < bounds.y + bounds.height
    )
    commit(
      regions.map((region) =>
        region.id === active.id
          ? {
              ...region,
              ...patch,
              ...bounds,
              seeds,
              isolateArtwork: seeds?.length
                ? (patch.isolateArtwork ?? region.isolateArtwork)
                : false
            }
          : region
      )
    )
  }
  const point = (event: React.PointerEvent<SVGElement>) => {
    const matrix = svgRef.current?.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return {
      x: Math.max(0, Math.min(1, p.x / size.width)),
      y: Math.max(0, Math.min(1, p.y / size.height))
    }
  }
  const begin = (event: React.PointerEvent<SVGElement>, region: Region, handle: Handle) => {
    if (busy || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    setSelected(region.id)
    svgRef.current?.setPointerCapture(event.pointerId)
    drag.current = {
      id: region.id,
      handle,
      start: point(event),
      original: region,
      snapshot: regions,
      future
    }
    setPast((current) => [...current.slice(-19), regions])
    setFuture([])
  }
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    const gesture = drag.current
    if (!gesture) return
    const p = point(event),
      dx = p.x - gesture.start.x,
      dy = p.y - gesture.start.y,
      b = gesture.original
    let bounds: ReviewedStickerBounds
    if (gesture.handle === 'move')
      bounds = {
        ...b,
        x: Math.max(0, Math.min(1 - b.width, b.x + dx)),
        y: Math.max(0, Math.min(1 - b.height, b.y + dy))
      }
    else {
      const west = gesture.handle.includes('w'),
        north = gesture.handle.includes('n')
      const left = west ? Math.min(b.x + b.width - 1 / size.width, Math.max(0, b.x + dx)) : b.x
      const top = north ? Math.min(b.y + b.height - 1 / size.height, Math.max(0, b.y + dy)) : b.y
      const right = west
        ? b.x + b.width
        : Math.max(left + 1 / size.width, Math.min(1, b.x + b.width + dx))
      const bottom = north
        ? b.y + b.height
        : Math.max(top + 1 / size.height, Math.min(1, b.y + b.height + dy))
      bounds = { x: left, y: top, width: right - left, height: bottom - top }
    }
    setRegions((current) =>
      current.map((region) => {
        if (region.id !== gesture.id) return region
        const next = clampStickerBounds(bounds)
        const seeds = region.seeds?.filter(
          (p) =>
            p.x >= next.x &&
            p.x < next.x + next.width &&
            p.y >= next.y &&
            p.y < next.y + next.height
        )
        return {
          ...region,
          ...next,
          seeds,
          isolateArtwork: seeds?.length ? region.isolateArtwork : false
        }
      })
    )
  }
  const add = () => {
    const region: Region = {
      id: crypto.randomUUID(),
      x: 0.35,
      y: 0.35,
      width: 0.3,
      height: 0.3,
      removeBackground: false
    }
    commit([...regions, region])
    setSelected(region.id)
  }
  const merge = () => {
    const parts = regions.filter((region) => mergeIds.includes(region.id))
    if (parts.length < 2) return
    const region: Region = {
      ...mergeStickerBounds(parts),
      id: parts[0].id,
      removeBackground: false,
      seeds: parts.every((p) => p.seeds?.length) ? parts.flatMap((p) => p.seeds!) : undefined
    }
    commit(
      regions.flatMap((item) =>
        item.id === region.id ? [region] : mergeIds.includes(item.id) ? [] : [item]
      )
    )
    setMergeIds([])
    setSelected(region.id)
  }
  const split = (axis: 'x' | 'y') => {
    if (!active || busy || regions.length >= 500) return
    const parts = splitStickerBounds(active, axis).map((bounds, index) => ({
      ...bounds,
      id: index ? crypto.randomUUID() : active.id,
      removeBackground: !!active.removeBackground,
      isolateArtwork: false
    }))
    commit(regions.flatMap((region) => (region.id === active.id ? parts : [region])))
    setMergeIds([])
    setSelected(parts[0].id)
  }
  const undo = () => {
    if (!past.length) return
    const next = past[past.length - 1]
    setFuture((current) => [...current, regions])
    setPast(past.slice(0, -1))
    setRegions(next)
    setSelected(next.some((r) => r.id === selected) ? selected : (next[0]?.id ?? ''))
  }
  const redo = () => {
    if (!future.length) return
    const next = future[future.length - 1]
    setPast((current) => [...current, regions])
    setFuture(future.slice(0, -1))
    setRegions(next)
    setSelected(next.some((r) => r.id === selected) ? selected : (next[0]?.id ?? ''))
  }
  const apply = async () => {
    if (busy || !regions.length) return
    setBusy(true)
    setError('')
    try {
      await onApply(regions.map(({ id: _id, ...region }) => region))
    } catch (failure) {
      setError(t(failure instanceof Error ? failure.message : String(failure)))
    } finally {
      setBusy(false)
    }
  }
  const handleSize = Math.max(size.width, size.height) * 0.014

  return (
    <section
      aria-label={t('Review image stickers')}
      aria-busy={busy}
      className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border bg-card p-3 text-foreground"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 ref={titleRef} tabIndex={-1} className="me-auto text-lg font-semibold outline-none">
          {t('Review image stickers')}
        </h2>
        <ActionButton action="undo" size="sm" disabled={busy || !past.length} onClick={undo} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !future.length}
          onClick={redo}
        >
          {t('Redo')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || regions.length >= 500}
          onClick={add}
        >
          {t('Add sticker selection')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || regions.filter((r) => mergeIds.includes(r.id)).length < 2}
          onClick={merge}
        >
          {t('Merge selected parts')}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="w-36 shrink-0 overflow-y-auto rounded-md border p-2 xl:w-44">
          <div
            role="tablist"
            aria-label={t('Sticker selections')}
            aria-orientation="vertical"
            className="space-y-2"
          >
            {regions.map((region, index) => (
              <div key={region.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={mergeIds.includes(region.id)}
                  aria-label={`${t('Select for merge')} ${index + 1}`}
                  onChange={(event) =>
                    setMergeIds((current) =>
                      event.target.checked
                        ? [...current, region.id]
                        : current.filter((id) => id !== region.id)
                    )
                  }
                />
                <Button
                  id={`review-${region.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected === region.id}
                  aria-controls="sticker-selection-panel"
                  tabIndex={selected === region.id ? 0 : -1}
                  variant={selected === region.id ? 'selected' : 'outline'}
                  size="sm"
                  className="min-w-0 flex-1"
                  disabled={busy}
                  onClick={() => setSelected(region.id)}
                  onKeyDown={(event) => {
                    const nextIndex =
                      event.key === 'ArrowDown'
                        ? (index + 1) % regions.length
                        : event.key === 'ArrowUp'
                          ? (index - 1 + regions.length) % regions.length
                          : event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? regions.length - 1
                              : -1
                    if (nextIndex >= 0) {
                      event.preventDefault()
                      setSelected(regions[nextIndex].id)
                      document.getElementById(`review-${regions[nextIndex].id}`)?.focus()
                    }
                  }}
                >
                  {t('Sticker')} {index + 1}
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-md border bg-muted/20">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${size.width} ${size.height}`}
            className="h-full w-full touch-none"
            aria-label={t('Sticker sheet selections')}
            onPointerMove={move}
            onPointerUp={() => {
              drag.current = null
            }}
            onPointerCancel={() => {
              if (drag.current) {
                setRegions(drag.current.snapshot)
                setFuture(drag.current.future)
                setPast((current) => current.slice(0, -1))
                drag.current = null
              }
            }}
          >
            {url && <image href={url} width={size.width} height={size.height} />}
            {[...regions]
              .sort((a, b) => Number(a.id === selected) - Number(b.id === selected))
              .map((region) => (
                <g key={region.id} onPointerDown={(event) => begin(event, region, 'move')}>
                  <rect
                    x={region.x * size.width}
                    y={region.y * size.height}
                    width={region.width * size.width}
                    height={region.height * size.height}
                    fill="transparent"
                    stroke={
                      region.id === selected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))'
                    }
                    strokeWidth={region.id === selected ? 3 : 1}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-move"
                  />
                  <text
                    x={region.x * size.width + handleSize / 2}
                    y={region.y * size.height + handleSize * 1.5}
                    fontSize={handleSize * 1.5}
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--background))"
                    strokeWidth={handleSize * 0.06}
                    paintOrder="stroke"
                    pointerEvents="none"
                  >
                    {regions.findIndex((entry) => entry.id === region.id) + 1}
                  </text>
                  {region.id === selected &&
                    (['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
                      <rect
                        key={handle}
                        x={
                          (region.x + (handle.includes('e') ? region.width : 0)) * size.width -
                          handleSize / 2
                        }
                        y={
                          (region.y + (handle.includes('s') ? region.height : 0)) * size.height -
                          handleSize / 2
                        }
                        width={handleSize}
                        height={handleSize}
                        fill="hsl(var(--primary))"
                        stroke="hsl(var(--background))"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: `${handle}-resize` }}
                        onPointerDown={(event) => begin(event, region, handle)}
                      />
                    ))}
                </g>
              ))}
          </svg>
        </div>
        <div
          id="sticker-selection-panel"
          role="tabpanel"
          aria-labelledby={active ? `review-${active.id}` : undefined}
          className="w-48 shrink-0 space-y-3 overflow-y-auto pe-1 text-sm xl:w-56"
        >
          {active ? (
            <>
              <h3 className="font-medium">
                {t('Sticker')} {regions.findIndex((r) => r.id === active.id) + 1}
              </h3>
              {preparedPreview ? (
                <img
                  src={preparedPreview}
                  alt={t('Prepared sticker preview')}
                  className="h-36 w-full rounded-md border bg-muted/20 object-contain"
                />
              ) : (
                <svg
                  viewBox={`${active.x * size.width} ${active.y * size.height} ${active.width * size.width} ${active.height * size.height}`}
                  className="h-36 w-full rounded-md border bg-muted/20"
                  aria-label={t('Original sticker crop')}
                >
                  <defs>
                    <clipPath id={`crop-preview-${active.id}`}>
                      <rect
                        x={active.x * size.width}
                        y={active.y * size.height}
                        width={active.width * size.width}
                        height={active.height * size.height}
                      />
                    </clipPath>
                  </defs>
                  <image
                    href={url}
                    width={size.width}
                    height={size.height}
                    clipPath={`url(#crop-preview-${active.id})`}
                  />
                </svg>
              )}
              {previewBusy && (
                <p role="status" className="text-xs text-muted-foreground">
                  {t('Preparing preview…')}
                </p>
              )}
              {previewError && (
                <p role="alert" className="text-sm text-destructive">
                  {previewError}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map((key) => {
                  const dimension = key === 'x' || key === 'width' ? size.width : size.height
                  return (
                    <label key={`${active.id}-${key}`}>
                      {t(
                        key === 'x'
                          ? 'Left (px)'
                          : key === 'y'
                            ? 'Top (px)'
                            : key === 'width'
                              ? 'Width (px)'
                              : 'Height (px)'
                      )}
                      <input
                        key={Math.round(active[key] * dimension)}
                        type="number"
                        min={key === 'x' || key === 'y' ? 0 : 1}
                        max={dimension}
                        step="1"
                        disabled={busy}
                        defaultValue={Math.round(active[key] * dimension)}
                        onBlur={(event) => {
                          const value = Number(event.currentTarget.value)
                          if (
                            event.currentTarget.value.trim() &&
                            Number.isFinite(value) &&
                            value >= (key === 'x' || key === 'y' ? 0 : 1)
                          )
                            change({ [key]: value / dimension })
                          else
                            event.currentTarget.value = String(Math.round(active[key] * dimension))
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur()
                        }}
                        className="mt-1 w-full rounded border bg-background p-2"
                      />
                    </label>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-auto min-h-8 whitespace-normal"
                  disabled={busy || regions.length >= 500 || active.width * size.width < 2}
                  onClick={() => split('x')}
                >
                  {t('Split vertically')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-auto min-h-8 whitespace-normal"
                  disabled={busy || regions.length >= 500 || active.height * size.height < 2}
                  onClick={() => split('y')}
                >
                  {t('Split horizontally')}
                </Button>
              </div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={!!active.removeBackground}
                  disabled={busy}
                  onChange={(event) => change({ removeBackground: event.target.checked })}
                />
                {t('Remove background for this sticker')}
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={!!active.isolateArtwork}
                  disabled={busy || !active.seeds?.length}
                  onChange={(event) => change({ isolateArtwork: event.target.checked })}
                  aria-describedby={!active.seeds?.length ? 'sticker-isolation-help' : undefined}
                />
                {t('Exclude neighboring artwork')}
              </label>
              {!active.seeds?.length && (
                <p id="sticker-isolation-help" className="text-xs text-muted-foreground">
                  {t('Isolation is available for detected selections.')}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t(
                  'Original pixels are kept. Use Restore in Mask view after opening the stickers.'
                )}
              </p>
              {initial && (
                <p className="text-xs text-muted-foreground">
                  {t('Changing the crop replaces this sticker’s mask edits.')}
                </p>
              )}
              <ActionButton
                action="delete"
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  const next = regions.filter((region) => region.id !== active.id)
                  commit(next)
                  setSelected(next[0]?.id ?? '')
                }}
              >
                {t('Delete selection')}
              </ActionButton>
            </>
          ) : (
            <p>{t('Add a selection around each sticker.')}</p>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span role="status" className="min-w-0 flex-1 break-all text-xs text-muted-foreground">
          {file.name} · {regions.length} {t('Sticker selections')}
        </span>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          {t('Cancel')}
        </Button>
        <Button
          type="button"
          disabled={busy || previewBusy || !regions.length || !!previewError}
          aria-busy={busy}
          onClick={() => void apply()}
        >
          {t(busy ? 'Preparing stickers…' : 'Open stickers')} {busy ? '' : regions.length}
        </Button>
      </div>
    </section>
  )
}
