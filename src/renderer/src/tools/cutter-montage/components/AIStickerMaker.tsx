import { useLanguage } from '@/i18n/useLanguage'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ImagePlus, Trash2, ZoomIn, ZoomOut, Scan, Sparkles } from 'lucide-react'
import { bytesToArrayBuffer } from '../lib/sourcePreview'
import type { StickerSendOrder } from '../lib/stickerCutterAdapter'
import {
  paintStickerMaskStroke,
  processSticker,
  rebuildStickerFromMask,
  updateStickerCutline,
  type StickerMaskBrushMode,
  type StickerBackgroundMode,
  type StickerMakerResult,
  type StickerMakerSettings
} from '../lib/stickerMaker'

interface QueueItem {
  id: string
  file: File
  status: 'Waiting' | 'Processing' | 'Ready' | 'Review' | 'Failed' | 'Sent'
  result?: StickerMakerResult
  error?: string
  preview?: string
  originalPreview: string
  initialMask?: Uint8Array
  undoMasks: Uint8Array[]
  redoMasks: Uint8Array[]
  widthMm: number
  quantity: number
  cutOffsetMm?: number
}

type StickerPreviewMode = 'original' | 'result' | 'mask' | 'cut'

function drawMaskPreview(
  canvas: HTMLCanvasElement | null,
  mask: Uint8Array,
  width: number,
  height: number
): void {
  if (!canvas) return
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return
  const image = context.createImageData(width, height)
  for (let index = 0; index < mask.length; index += 1) {
    image.data[index * 4] = mask[index]
    image.data[index * 4 + 1] = mask[index]
    image.data[index * 4 + 2] = mask[index]
    image.data[index * 4 + 3] = 255
  }
  context.putImageData(image, 0, 0)
}

export function AIStickerMaker({
  onSend,
  onClose
}: {
  onSend: (orders: StickerSendOrder[], offsetMm: number) => void
  onClose: () => void
}): JSX.Element {
  const { t } = useLanguage()

  const [items, setItems] = useState<QueueItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [backgroundMode, setBackgroundMode] = useState<StickerBackgroundMode>('auto')
  const [zoom, setZoom] = useState(1)
  const [previewBackground, setPreviewBackground] = useState('checker')
  const [previewSize, setPreviewSize] = useState({ width: 400, height: 400 })
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [previewMode, setPreviewMode] = useState<StickerPreviewMode>('cut')
  const [brushMode, setBrushMode] = useState<StickerMaskBrushMode>('erase')
  const [brushSize, setBrushSize] = useState(32)
  const [brushHardness, setBrushHardness] = useState(0.8)
  const [message, setMessage] = useState('Add JPG, PNG, or WebP artwork.')
  const [settings, setSettings] = useState<StickerMakerSettings>({
    offsetMm: 2,
    threshold: 128,
    smoothing: 1,
    widthMm: 80
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const stopRef = useRef(false)
  const strokeRef = useRef<{
    itemId: string
    mask: Uint8Array
    previous: { x: number; y: number }
  } | null>(null)
  const queueRef = useRef(items)
  queueRef.current = items

  useEffect(() => {
    const element = previewRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setPreviewSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => setZoom(1), [selected])

  useEffect(
    () => () => {
      for (const item of queueRef.current) {
        if (item.preview) URL.revokeObjectURL(item.preview)
        URL.revokeObjectURL(item.originalPreview)
      }
    },
    []
  )

  const addFiles = (files: File[]) => {
    const accepted = files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file.name))
    const next = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'Waiting' as const,
      originalPreview: URL.createObjectURL(file),
      undoMasks: [],
      redoMasks: [],
      widthMm: settings.widthMm,
      quantity: 1
    }))
    setItems((current) => [...current, ...next])
    if (!selected && next[0]) setSelected(next[0].id)
    setMessage(
      `${accepted.length} image(s) added.${accepted.length !== files.length ? ' Unsupported files were skipped.' : ' Choose a background option, then process your images.'}`
    )
  }

  const removeItem = (id: string) => {
    if (busy) return
    const item = items.find((entry) => entry.id === id)
    if (!item) return
    if (item.preview) URL.revokeObjectURL(item.preview)
    URL.revokeObjectURL(item.originalPreview)
    const remaining = items.filter((entry) => entry.id !== id)
    setItems(remaining)
    if (selected === id) setSelected(remaining[0]?.id ?? null)
    setMessage(`Removed ${item.file.name} from the queue.`)
  }

  const processAll = async (selectedOnly = false) => {
    if (busy) return
    const targets = items.filter((item) =>
      selectedOnly
        ? item.id === selected && item.status !== 'Sent'
        : item.status === 'Waiting' || item.status === 'Failed'
    )
    if (!targets.length) return
    setBusy(true)
    stopRef.current = false
    setProgress({ done: 0, total: targets.length })
    let completed = 0
    let failed = 0
    for (let index = 0; index < targets.length; index += 1) {
      if (stopRef.current) break
      const item = targets[index]
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, status: 'Processing', error: undefined } : entry
        )
      )
      setMessage(`Processing ${index + 1} / ${targets.length}: ${item.file.name}`)
      try {
        const result = await processSticker(
          item.file,
          { ...settings, widthMm: item.widthMm },
          setMessage,
          backgroundMode
        )
        const preview = URL.createObjectURL(
          new Blob([bytesToArrayBuffer(result.png)], { type: 'image/png' })
        )
        if (item.preview) URL.revokeObjectURL(item.preview)
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: result.pathData ? 'Ready' : 'Review',
                  result,
                  cutOffsetMm: settings.offsetMm,
                  preview,
                  initialMask: result.contourMask.slice(),
                  undoMasks: [],
                  redoMasks: []
                }
              : entry
          )
        )
      } catch (error) {
        failed += 1
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: 'Failed',
                  error: error instanceof Error ? error.message : String(error)
                }
              : entry
          )
        )
      }
      completed += 1
      setProgress({ done: completed, total: targets.length })
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    }
    setMessage(
      `${stopRef.current ? 'Stopped. ' : ''}${completed - failed} image(s) processed${failed ? `, ${failed} failed — retry or choose Keep original` : ''}. Review each cut path before sending.`
    )
    setProgress(null)
    setBusy(false)
  }

  const changeSettings = (patch: Partial<StickerMakerSettings>) => {
    if (busy) return
    const next = { ...settings, ...patch }
    if (!Number.isFinite(next.offsetMm) || next.offsetMm < 0 || next.offsetMm > 20) return
    setSettings(next)
    setItems((current) =>
      current.map((item) => {
        if (!item.result || item.status === 'Sent' || item.status === 'Failed') return item
        try {
          const result = updateStickerCutline(item.result, { ...next, widthMm: item.widthMm })
          return {
            ...item,
            result,
            cutOffsetMm: next.offsetMm,
            error: undefined,
            status: result.pathData ? 'Ready' : 'Review'
          }
        } catch (error) {
          return {
            ...item,
            status: 'Review',
            error: error instanceof Error ? error.message : String(error)
          }
        }
      })
    )
  }

  const changeSelectedWidth = (widthMm: number) => {
    if (!selected || !Number.isFinite(widthMm) || widthMm < 5 || widthMm > 920) return
    setItems((current) =>
      current.map((item) => {
        if (item.id !== selected || item.status === 'Sent') return item
        if (!item.result || item.status === 'Failed') return { ...item, widthMm }
        const result = updateStickerCutline(item.result, { ...settings, widthMm })
        return {
          ...item,
          widthMm,
          result,
          cutOffsetMm: settings.offsetMm,
          error: undefined,
          status: result.pathData ? 'Ready' : 'Review'
        }
      })
    )
  }

  const changeSelectedQuantity = (quantity: number) => {
    if (!selected || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) return
    setItems((current) =>
      current.map((item) =>
        item.id === selected && item.status !== 'Sent' ? { ...item, quantity } : item
      )
    )
  }

  const commitMask = async (
    item: QueueItem,
    mask: Uint8Array,
    undoMasks: Uint8Array[],
    redoMasks: Uint8Array[]
  ) => {
    if (!item.result) return
    setBusy(true)
    setMessage(`Updating artwork and cutline for ${item.file.name}…`)
    try {
      const result = await rebuildStickerFromMask(item.file, item.result, mask, {
        ...settings,
        widthMm: item.widthMm
      })
      const preview = URL.createObjectURL(
        new Blob([bytesToArrayBuffer(result.png)], { type: 'image/png' })
      )
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                result,
                cutOffsetMm: settings.offsetMm,
                preview,
                undoMasks,
                redoMasks,
                error: undefined,
                status: result.pathData ? 'Ready' : 'Review'
              }
            : entry
        )
      )
      if (item.preview) URL.revokeObjectURL(item.preview)
      setMessage(`Mask and vector cutline updated for ${item.file.name}.`)
    } catch (error) {
      drawMaskPreview(
        maskCanvasRef.current,
        item.result.contourMask,
        item.result.contourWidth,
        item.result.contourHeight
      )
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const getMaskPoint = (
    event: React.PointerEvent<HTMLCanvasElement>,
    result: StickerMakerResult
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(
        0,
        Math.min(
          result.contourWidth - 1,
          ((event.clientX - bounds.left) / bounds.width) * result.contourWidth
        )
      ),
      y: Math.max(
        0,
        Math.min(
          result.contourHeight - 1,
          ((event.clientY - bounds.top) / bounds.height) * result.contourHeight
        )
      )
    }
  }

  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const item = items.find((entry) => entry.id === selected)
    if (
      event.button !== 0 ||
      !item?.result ||
      (item.status !== 'Ready' && item.status !== 'Review') ||
      busy
    )
      return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = getMaskPoint(event, item.result)
    const mask = item.result.contourMask.slice()
    paintStickerMaskStroke(
      mask,
      item.result.contourWidth,
      item.result.contourHeight,
      point,
      point,
      brushSize,
      brushHardness,
      brushMode
    )
    strokeRef.current = { itemId: item.id, mask, previous: point }
    drawMaskPreview(
      maskCanvasRef.current,
      mask,
      item.result.contourWidth,
      item.result.contourHeight
    )
  }

  const continueStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = strokeRef.current
    const item = items.find((entry) => entry.id === stroke?.itemId)
    if (!stroke || !item?.result) return
    const point = getMaskPoint(event, item.result)
    paintStickerMaskStroke(
      stroke.mask,
      item.result.contourWidth,
      item.result.contourHeight,
      stroke.previous,
      point,
      brushSize,
      brushHardness,
      brushMode
    )
    stroke.previous = point
    drawMaskPreview(
      maskCanvasRef.current,
      stroke.mask,
      item.result.contourWidth,
      item.result.contourHeight
    )
  }

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = strokeRef.current
    if (!stroke) return
    continueStroke(event)
    strokeRef.current = null
    const item = items.find((entry) => entry.id === stroke.itemId)
    if (item?.result) {
      void commitMask(
        item,
        stroke.mask,
        [...item.undoMasks.slice(-19), item.result.contourMask.slice()],
        []
      )
    }
  }

  const undoMask = () => {
    const item = items.find((entry) => entry.id === selected)
    if (!item?.result || !item.undoMasks.length || busy) return
    const previous = item.undoMasks[item.undoMasks.length - 1]
    void commitMask(item, previous.slice(), item.undoMasks.slice(0, -1), [
      ...item.redoMasks,
      item.result.contourMask.slice()
    ])
  }

  const redoMask = () => {
    const item = items.find((entry) => entry.id === selected)
    if (!item?.result || !item.redoMasks.length || busy) return
    const next = item.redoMasks[item.redoMasks.length - 1]
    void commitMask(
      item,
      next.slice(),
      [...item.undoMasks, item.result.contourMask.slice()],
      item.redoMasks.slice(0, -1)
    )
  }

  const resetMask = () => {
    const item = items.find((entry) => entry.id === selected)
    if (!item?.result || !item.initialMask || busy) return
    void commitMask(
      item,
      item.initialMask.slice(),
      [...item.undoMasks.slice(-19), item.result.contourMask.slice()],
      []
    )
  }

  const sendReady = () => {
    try {
      onSend(
        items.flatMap((item) =>
          item.result && item.status === 'Ready'
            ? [{ result: item.result, quantity: item.quantity }]
            : []
        ),
        settings.offsetMm
      )
      setItems((current) =>
        current.map((item) => (item.status === 'Ready' ? { ...item, status: 'Sent' } : item))
      )
      setMessage('Ready stickers added and arranged in Cutter Montage.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const active = items.find((item) => item.id === selected)
  const readyCount = items.filter((item) => item.status === 'Ready').length
  const readyCopies = items
    .filter((item) => item.status === 'Ready')
    .reduce((sum, item) => sum + item.quantity, 0)
  const activeOffset = active?.cutOffsetMm ?? settings.offsetMm
  const outerWidthMm = active?.result ? active.result.widthMm + activeOffset * 2 : 1
  const outerHeightMm = active?.result ? active.result.heightMm + activeOffset * 2 : 1
  const aspectRatio = outerWidthMm / outerHeightMm
  const fittedWidth = Math.max(
    1,
    Math.min(previewSize.width - 32, (previewSize.height - 32) * aspectRatio)
  )
  const artworkStyle = active?.result
    ? {
        left: `${(activeOffset / outerWidthMm) * 100}%`,
        top: `${(activeOffset / outerHeightMm) * 100}%`,
        width: `${(active.result.widthMm / outerWidthMm) * 100}%`,
        height: `${(active.result.heightMm / outerHeightMm) * 100}%`
      }
    : { left: '0%', top: '0%', width: '100%', height: '100%' }
  useEffect(() => {
    if (previewMode === 'mask' && active?.result) {
      drawMaskPreview(
        maskCanvasRef.current,
        active.result.contourMask,
        active.result.contourWidth,
        active.result.contourHeight
      )
    }
  }, [active?.result, previewMode])
  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-lg border bg-card p-3"
      aria-label={t('AI Sticker Maker')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('AI Sticker Maker')}
          </h2>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <ImagePlus className="mr-2 h-4 w-4" />
          {t('Add images')}
        </Button>
        {progress && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              stopRef.current = true
              setMessage('Stopping after the current image finishes…')
            }}
          >
            {t('Stop after current')}
          </Button>
        )}
        <Button
          type="button"
          disabled={
            busy || !items.some((item) => item.status === 'Waiting' || item.status === 'Failed')
          }
          onClick={() => void processAll()}
        >
          {busy ? 'Processing…' : 'Process all'}
        </Button>
        <Button type="button" disabled={!readyCount || busy} onClick={sendReady}>
          {t('Send')} {readyCount || ''} {t('to Cutter')}
          {readyCopies > 0 ? ` · ${readyCopies} ${readyCopies === 1 ? 'copy' : 'copies'}` : ''}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          {t('Close')}
        </Button>
      </div>
      <div
        className="flex min-h-0 flex-1 gap-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          addFiles(Array.from(event.dataTransfer.files))
        }}
      >
        <div className="w-44 shrink-0 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-2 xl:w-56">
          <div className="flex items-center justify-between px-1 py-1 text-xs font-medium">
            <span>{t('Artwork queue')}</span>
            <span className="text-muted-foreground">
              {items.length} {items.length === 1 ? 'image' : 'images'}
            </span>
          </div>
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('Drop images here or choose Add images.')}
            </p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center rounded-md border ${selected === item.id ? 'border-primary bg-primary/10' : 'bg-background'}`}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 p-2 text-left text-xs"
                aria-pressed={selected === item.id}
                disabled={busy}
                onClick={() => setSelected(item.id)}
              >
                <img
                  src={item.preview ?? item.originalPreview}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded border bg-white object-contain"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.file.name}</span>
                  <span
                    className={`block ${item.status === 'Ready' ? 'text-emerald-600 dark:text-emerald-400' : item.status === 'Failed' ? 'text-destructive' : 'text-muted-foreground'}`}
                  >
                    {item.status}
                  </span>
                  <span className="text-muted-foreground">
                    {item.widthMm} mm · {item.quantity} {item.quantity === 1 ? 'copy' : 'copies'}
                  </span>
                  {item.error && <span className="block text-destructive">{item.error}</span>}
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={`Remove ${item.file.name}`}
                title="Remove from queue"
                onClick={() => removeItem(item.id)}
                className="mr-1 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border">
          <div
            className="flex shrink-0 flex-wrap gap-1 border-b bg-background p-1"
            aria-label="Sticker preview modes"
          >
            {(['original', 'result', 'mask', 'cut'] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={previewMode === mode ? 'secondary' : 'ghost'}
                aria-pressed={previewMode === mode}
                disabled={busy || (mode !== 'original' && !active?.result)}
                onClick={() => setPreviewMode(mode)}
              >
                {mode === 'cut' ? 'Cut preview' : mode[0].toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 border-b bg-background px-2 py-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={t('Zoom out')}
              disabled={zoom <= 1}
              onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="min-w-10 text-center text-xs tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={t('Zoom in')}
              disabled={zoom >= 4 || !active}
              onClick={() => setZoom((value) => Math.min(4, value + 0.5))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setZoom(1)}>
              <Scan className="mr-1 h-3.5 w-3.5" />
              {t('Fit')}
            </Button>
            <select
              aria-label="Preview background"
              value={previewBackground}
              onChange={(event) => setPreviewBackground(event.target.value)}
              className="ml-auto rounded border bg-background px-2 py-1 text-xs"
            >
              <option value="checker">{t('Transparency grid')}</option>
              <option value="white">{t('White background')}</option>
              <option value="dark">{t('Dark background')}</option>
            </select>
          </div>
          <div
            ref={previewRef}
            className="min-h-0 flex-1 overflow-auto"
            style={{
              background:
                previewBackground === 'checker'
                  ? 'repeating-conic-gradient(#e2e8f0 0 25%, #f8fafc 0 50%) 0 0 / 24px 24px'
                  : previewBackground === 'dark'
                    ? '#18181b'
                    : '#ffffff'
            }}
          >
            <div
              className="flex min-h-full min-w-full items-center justify-center p-4"
              style={{
                width: active ? fittedWidth * zoom + 32 : '100%',
                height: active ? (fittedWidth / aspectRatio) * zoom + 32 : '100%'
              }}
            >
              {active ? (
                <div
                  className="relative shrink-0"
                  style={{
                    width: fittedWidth * zoom,
                    height: (fittedWidth / aspectRatio) * zoom
                  }}
                >
                  {(previewMode === 'original' || !active.result) && (
                    <img
                      src={active.originalPreview}
                      alt={`Original ${active.file.name}`}
                      className="absolute object-contain"
                      style={artworkStyle}
                    />
                  )}
                  {(previewMode === 'result' || previewMode === 'cut') && active.preview && (
                    <img
                      src={active.preview}
                      alt={`Transparent result for ${active.file.name}`}
                      className="absolute object-fill"
                      style={artworkStyle}
                    />
                  )}
                  {previewMode === 'mask' && active.result && (
                    <canvas
                      ref={maskCanvasRef}
                      aria-label="Editable alpha mask"
                      className="absolute cursor-crosshair touch-none"
                      style={artworkStyle}
                      onPointerDown={beginStroke}
                      onPointerMove={continueStroke}
                      onPointerUp={endStroke}
                      onPointerCancel={() => {
                        strokeRef.current = null
                        if (active.result) {
                          drawMaskPreview(
                            maskCanvasRef.current,
                            active.result.contourMask,
                            active.result.contourWidth,
                            active.result.contourHeight
                          )
                        }
                      }}
                    />
                  )}
                  {previewMode === 'cut' && active.result && (
                    <svg
                      viewBox="0 0 1 1"
                      preserveAspectRatio="none"
                      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                      aria-label="Vector cut contour"
                    >
                      <path
                        d={active.result.pathData}
                        fill="none"
                        stroke="#e50093"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="max-w-sm rounded-xl border-2 border-dashed border-slate-300 bg-white/95 p-8 text-center text-slate-700 shadow-sm hover:border-primary"
                >
                  <ImagePlus className="mx-auto mb-3 h-9 w-9 text-primary" />
                  <span className="block text-base font-semibold">
                    {t('Drop your artwork here')}
                  </span>
                  <span className="mt-2 block text-sm">
                    {t('or click to browse JPG, PNG, and WebP images')}
                  </span>
                  <span className="mt-3 block text-xs text-slate-500">
                    {t(
                      'Transparent artwork is ready in seconds. Photos use local AI background removal.'
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>
          {active?.result && (
            <div className="flex flex-wrap justify-between gap-2 border-t bg-background px-3 py-2 text-xs text-muted-foreground">
              <span>
                Artwork: {active.result.widthMm.toFixed(1)} × {active.result.heightMm.toFixed(1)} mm
              </span>
              <span>
                {active.result.widthPx} × {active.result.heightPx} px ·{' '}
                {Math.round(active.result.widthPx / (active.result.widthMm / 25.4))} DPI
              </span>
              {previewMode === 'cut' && (
                <span className="text-pink-600">Pink line = cut contour</span>
              )}
            </div>
          )}
        </div>
        <div className="w-48 shrink-0 space-y-3 overflow-y-auto pr-1 text-sm xl:w-56">
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <label className="block font-medium" htmlFor="sticker-background-mode">
              {t('Background')}
            </label>
            <select
              id="sticker-background-mode"
              disabled={busy}
              value={backgroundMode}
              onChange={(event) => setBackgroundMode(event.target.value as StickerBackgroundMode)}
              className="w-full rounded border bg-background p-2"
            >
              <option value="auto">{t('Auto detect')}</option>
              <option value="remove">{t('Remove with AI')}</option>
              <option value="keep">{t('Keep original')}</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {backgroundMode === 'auto'
                ? 'Preserves transparent images. Removes the background from opaque photos.'
                : backgroundMode === 'keep'
                  ? 'Use existing artwork and transparency. No AI download needed.'
                  : 'Use local AI to isolate the subject, including images with transparency.'}
            </p>
            {active && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={busy || active.status === 'Sent'}
                onClick={() => void processAll(true)}
              >
                {active.result ? 'Reprocess selected' : 'Process selected'}
              </Button>
            )}
            {active?.result && active.status !== 'Sent' && (
              <p className="text-xs text-muted-foreground">
                {t('Reprocessing replaces mask edits for this image.')}
              </p>
            )}
          </div>
          {previewMode === 'mask' && active?.result && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-2">
              <p className="font-medium">{t('Correct mask')}</p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={brushMode === 'erase' ? 'default' : 'outline'}
                  disabled={busy || active.status === 'Sent'}
                  onClick={() => setBrushMode('erase')}
                >
                  {t('Erase')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={brushMode === 'restore' ? 'default' : 'outline'}
                  disabled={busy || active.status === 'Sent'}
                  onClick={() => setBrushMode('restore')}
                >
                  {t('Restore')}
                </Button>
              </div>
              <label className="block">
                {t('Brush size:')} {brushSize} px
                <input
                  type="range"
                  min="4"
                  max="128"
                  value={brushSize}
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                  className="w-full"
                />
              </label>
              <label className="block">
                {t('Hardness:')} {Math.round(brushHardness * 100)}%
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(brushHardness * 100)}
                  onChange={(event) => setBrushHardness(Number(event.target.value) / 100)}
                  className="w-full"
                />
              </label>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !active.undoMasks.length || active.status === 'Sent'}
                  onClick={undoMask}
                >
                  {t('Undo')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !active.redoMasks.length || active.status === 'Sent'}
                  onClick={redoMask}
                >
                  {t('Redo')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !active.initialMask || active.status === 'Sent'}
                  onClick={resetMask}
                >
                  {t('Reset mask')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  'Paint white to keep pixels or black to remove them. The cutline updates when you finish a stroke.'
                )}
              </p>
            </div>
          )}
          <label className="block">
            {t('Artwork width (mm)')}
            <input
              key={`${active?.id}-width-${active?.widthMm}`}
              type="number"
              min="5"
              max="920"
              step="1"
              defaultValue={active?.widthMm ?? settings.widthMm}
              disabled={!active || active.status === 'Sent' || busy}
              onBlur={(event) => {
                const value = Number(event.currentTarget.value)
                if (Number.isFinite(value) && value >= 5 && value <= 920) changeSelectedWidth(value)
                else event.currentTarget.value = String(active?.widthMm ?? settings.widthMm)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
              className="mt-1 w-full rounded border bg-background p-2"
            />
          </label>
          <label className="block">
            {t('Copies')}
            <input
              key={`${active?.id}-copies-${active?.quantity}`}
              type="number"
              min="1"
              max="100000"
              step="1"
              defaultValue={active?.quantity ?? 1}
              disabled={!active || active.status === 'Sent' || busy}
              onBlur={(event) => {
                const value = Number(event.currentTarget.value)
                if (Number.isSafeInteger(value) && value >= 1 && value <= 100000)
                  changeSelectedQuantity(value)
                else event.currentTarget.value = String(active?.quantity ?? 1)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
              className="mt-1 w-full rounded border bg-background p-2"
            />
          </label>
          <label className="block">
            {t('Cut offset (mm)')}
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              key={`offset-${settings.offsetMm}`}
              defaultValue={settings.offsetMm}
              disabled={busy}
              onBlur={(event) => {
                const value = Number(event.currentTarget.value)
                if (
                  event.currentTarget.value.trim() &&
                  Number.isFinite(value) &&
                  value >= 0 &&
                  value <= 20
                )
                  changeSettings({ offsetMm: value })
                else event.currentTarget.value = String(settings.offsetMm)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
              className="mt-1 w-full rounded border bg-background p-2"
            />
          </label>
          <label className="block">
            {t('Alpha threshold')}
            <input
              type="range"
              min="1"
              max="254"
              value={settings.threshold}
              disabled={busy}
              onChange={(event) => changeSettings({ threshold: Number(event.target.value) })}
              className="mt-1 w-full"
            />
            <span>{settings.threshold} / 255</span>
          </label>
          <label className="block">
            {t('Contour smoothing')}
            <select
              value={settings.smoothing}
              disabled={busy}
              onChange={(event) => changeSettings({ smoothing: Number(event.target.value) })}
              className="mt-1 w-full rounded border bg-background p-2"
            >
              <option value={0}>{t('Low')}</option>
              <option value={1}>{t('Medium')}</option>
              <option value={3}>{t('High')}</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            {t('Cut settings apply to all unsent stickers.')}
          </p>
          {active?.result?.warnings.map((warning) => (
            <p key={warning} className="text-amber-700">
              {warning}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            {t('The model downloads once, then runs locally. Artwork stays on this machine.')}
          </p>
        </div>
      </div>
      {progress && (
        <progress
          aria-label="Sticker processing progress"
          value={progress.done}
          max={progress.total}
          className="h-1.5 w-full accent-primary"
        />
      )}
      <p role="status" className="text-xs text-muted-foreground">
        {message}
      </p>
    </section>
  )
}
