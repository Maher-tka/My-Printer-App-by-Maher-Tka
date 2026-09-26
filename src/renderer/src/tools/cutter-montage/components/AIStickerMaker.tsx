import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { bytesToArrayBuffer } from '../lib/sourcePreview'
import type { StickerSendOrder } from '../lib/stickerCutterAdapter'
import {
  paintStickerMaskStroke,
  processSticker,
  rebuildStickerFromMask,
  updateStickerCutline,
  type StickerMaskBrushMode,
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
  const [items, setItems] = useState<QueueItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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
  const strokeRef = useRef<{
    itemId: string
    mask: Uint8Array
    previous: { x: number; y: number }
  } | null>(null)
  const queueRef = useRef(items)
  queueRef.current = items

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
    if (accepted.length !== files.length) setMessage('Unsupported files were skipped.')
  }

  const processAll = async () => {
    if (busy) return
    setBusy(true)
    const targets = items.filter((item) => item.status === 'Waiting' || item.status === 'Failed')
    for (let index = 0; index < targets.length; index += 1) {
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
          setMessage
        )
        const preview = URL.createObjectURL(
          new Blob([bytesToArrayBuffer(result.png)], { type: 'image/png' })
        )
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: result.pathData ? 'Ready' : 'Review',
                  result,
                  preview,
                  initialMask: result.contourMask.slice(),
                  undoMasks: [],
                  redoMasks: []
                }
              : entry
          )
        )
      } catch (error) {
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
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    }
    setMessage(`Processed ${targets.length} image(s). Review each cut path before sending.`)
    setBusy(false)
  }

  const changeSettings = (patch: Partial<StickerMakerSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    setItems((current) =>
      current.map((item) => {
        if (!item.result || item.status === 'Sent') return item
        try {
          const result = updateStickerCutline(item.result, { ...next, widthMm: item.widthMm })
          return { ...item, result, status: result.pathData ? 'Ready' : 'Review' }
        } catch (error) {
          return { ...item, error: error instanceof Error ? error.message : String(error) }
        }
      })
    )
  }

  const changeSelectedWidth = (widthMm: number) => {
    if (!selected || !Number.isFinite(widthMm) || widthMm < 5 || widthMm > 920) return
    setItems((current) =>
      current.map((item) => {
        if (item.id !== selected || item.status === 'Sent') return item
        if (!item.result) return { ...item, widthMm }
        const result = updateStickerCutline(item.result, { ...settings, widthMm })
        return { ...item, widthMm, result, status: result.pathData ? 'Ready' : 'Review' }
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
    if (!item?.result || (item.status !== 'Ready' && item.status !== 'Review') || busy) return
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
  const outerWidthMm = active?.result ? active.result.widthMm + settings.offsetMm * 2 : 1
  const outerHeightMm = active?.result ? active.result.heightMm + settings.offsetMm * 2 : 1
  const artworkStyle = active?.result
    ? {
        left: `${(settings.offsetMm / outerWidthMm) * 100}%`,
        top: `${(settings.offsetMm / outerHeightMm) * 100}%`,
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
      aria-label="AI Sticker Maker"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">AI Sticker Maker</h2>
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
          Add images
        </Button>
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
          Send {readyCount || ''} to Cutter
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          Close
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
        <div className="w-52 shrink-0 space-y-1 overflow-y-auto rounded-md border p-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">Drop images here or choose Add images.</p>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`w-full rounded-md border p-2 text-left text-xs ${selected === item.id ? 'border-primary bg-primary/10' : ''}`}
              onClick={() => setSelected(item.id)}
            >
              <span className="block truncate font-medium">{item.file.name}</span>
              <span>
                {item.status} · {item.widthMm} mm · {item.quantity} copies
              </span>
              {item.error && <span className="block text-destructive">{item.error}</span>}
            </button>
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
                disabled={mode !== 'original' && !active?.result}
                onClick={() => setPreviewMode(mode)}
              >
                {mode === 'cut' ? 'Cut preview' : mode[0].toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"
            style={{
              background: 'repeating-conic-gradient(#eee 0 25%, white 0 50%) 0 0 / 24px 24px'
            }}
          >
            {active ? (
              <div
                className="relative h-auto max-h-[55vh] w-full max-w-[50vw]"
                style={{
                  aspectRatio: active.result ? `${outerWidthMm} / ${outerHeightMm}` : '1 / 1'
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
                      strokeWidth=".003"
                    />
                  </svg>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select an image to preview its original, transparent result, mask, and cut path.
              </p>
            )}
          </div>
        </div>
        <div className="w-48 shrink-0 space-y-3 overflow-y-auto text-sm">
          {previewMode === 'mask' && active?.result && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-2">
              <p className="font-medium">Correct mask</p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={brushMode === 'erase' ? 'default' : 'outline'}
                  disabled={busy || active.status === 'Sent'}
                  onClick={() => setBrushMode('erase')}
                >
                  Erase
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={brushMode === 'restore' ? 'default' : 'outline'}
                  disabled={busy || active.status === 'Sent'}
                  onClick={() => setBrushMode('restore')}
                >
                  Restore
                </Button>
              </div>
              <label className="block">
                Brush size: {brushSize} px
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
                Hardness: {Math.round(brushHardness * 100)}%
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
                  Undo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !active.redoMasks.length || active.status === 'Sent'}
                  onClick={redoMask}
                >
                  Redo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !active.initialMask || active.status === 'Sent'}
                  onClick={resetMask}
                >
                  Reset AI
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Paint white to keep pixels or black to remove them. The cutline updates when you
                finish a stroke.
              </p>
            </div>
          )}
          <label className="block">
            Artwork width for {active?.file.name ?? 'selected sticker'} (mm)
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
            Copies for {active?.file.name ?? 'selected sticker'}
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
            Cut offset (mm)
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={settings.offsetMm}
              onChange={(event) => changeSettings({ offsetMm: Number(event.target.value) })}
              className="mt-1 w-full rounded border bg-background p-2"
            />
          </label>
          <label className="block">
            Alpha threshold
            <input
              type="range"
              min="1"
              max="254"
              value={settings.threshold}
              onChange={(event) => changeSettings({ threshold: Number(event.target.value) })}
              className="mt-1 w-full"
            />
            <span>{settings.threshold} / 255</span>
          </label>
          <label className="block">
            Contour smoothing
            <select
              value={settings.smoothing}
              onChange={(event) => changeSettings({ smoothing: Number(event.target.value) })}
              className="mt-1 w-full rounded border bg-background p-2"
            >
              <option value={0}>Low</option>
              <option value={1}>Medium</option>
              <option value={3}>High</option>
            </select>
          </label>
          {active?.result?.warnings.map((warning) => (
            <p key={warning} className="text-amber-700">
              {warning}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            The model downloads once, then runs locally. Artwork stays on this machine.
          </p>
        </div>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {message}
      </p>
    </section>
  )
}
