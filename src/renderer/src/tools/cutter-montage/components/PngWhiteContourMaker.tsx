import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/i18n/useLanguage'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/ui/action-button'
import { LiveNumberInput } from './LiveNumberInput'
import { bytesToArrayBuffer } from '../lib/sourcePreview'
import {
  createPngWhiteContour,
  DEFAULT_PNG_WHITE_CONTOUR,
  type PngWhiteContourSettings
} from '../lib/pngWhiteContour'
import type { StickerMakerResult } from '../lib/stickerMaker'
import type { StickerSendOrder } from '../lib/stickerCutterAdapter'
import type { PngContourImport, PngContourInput } from '../lib/pngContourHandoff'

interface ContourItem {
  id: string
  file: File
  quantity: number
  widthMm: number
  origin?: PngContourInput
  result?: StickerMakerResult
  preview?: string
  error?: string
  sent?: boolean
}

export function PngWhiteContourMaker({
  onSend,
  active = true,
  clearSignal = 0,
  incoming,
  onStateChange
}: {
  onSend: (orders: StickerSendOrder[], offsetMm: number) => void
  active?: boolean
  clearSignal?: number
  incoming?: PngContourImport | null
  onStateChange?: (state: { busy: boolean; hasContent: boolean }) => void
}): JSX.Element {
  const { t } = useLanguage()
  const [items, setItems] = useState<ContourItem[]>([])
  const [settings, setSettings] = useState(DEFAULT_PNG_WHITE_CONTOUR)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [message, setMessage] = useState('Import transparent PNG images to create white contours.')
  const fileInput = useRef<HTMLInputElement>(null)
  const stop = useRef(false)
  const queue = useRef(items)
  queue.current = items
  const importButton = useRef<HTMLButtonElement>(null)
  const consumedImport = useRef<string | null>(null)
  useEffect(() => {
    return () => {
      stop.current = true
      for (const item of queue.current) if (item.preview) URL.revokeObjectURL(item.preview)
    }
  }, [])
  useEffect(() => {
    if (active) importButton.current?.focus()
  }, [active])
  useEffect(() => {
    onStateChange?.({ busy, hasContent: items.length > 0 })
  }, [busy, items.length, onStateChange])
  useEffect(() => {
    if (!clearSignal) return
    for (const item of queue.current) if (item.preview) URL.revokeObjectURL(item.preview)
    setItems([])
    setMessage('Import transparent PNG images to create white contours.')
  }, [clearSignal])

  const generate = async (targets: ContourItem[]) => {
    if (busy || !targets.length) return
    setBusy(true)
    stop.current = false
    setProgress({ done: 0, total: targets.length })
    const targetIds = new Set(targets.map((item) => item.id))
    let bytes = queue.current
      .filter((item) => !targetIds.has(item.id))
      .reduce((sum, item) => sum + (item.result?.png.length ?? 0), 0)
    try {
      for (const [index, item] of targets.entries()) {
        if (stop.current) break
        try {
          const result = await createPngWhiteContour(item.file, {
            ...settings,
            widthMm: item.widthMm
          })
          if (stop.current) break
          if (bytes + result.png.length > 200 * 1024 * 1024)
            throw new Error('The bordered artwork exceeds 200 MB. Use fewer or smaller PNG images.')
          bytes += result.png.length
          const preview = URL.createObjectURL(
            new Blob([bytesToArrayBuffer(result.png)], { type: 'image/png' })
          )
          if (item.preview) URL.revokeObjectURL(item.preview)
          setItems((current) =>
            current.map((value) =>
              value.id === item.id ? { ...value, result, preview, error: undefined } : value
            )
          )
        } catch (error) {
          if (stop.current) break
          if (item.preview) URL.revokeObjectURL(item.preview)
          setItems((current) =>
            current.map((value) =>
              value.id === item.id
                ? {
                    ...value,
                    result: undefined,
                    preview: undefined,
                    error: error instanceof Error ? error.message : String(error)
                  }
                : value
            )
          )
        }
        setProgress({ done: index + 1, total: targets.length })
        // Let the UI paint and accept cancellation between files.
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      setMessage(
        stop.current
          ? 'Contour preparation stopped.'
          : 'Review the white border and pink cut lines before sending to Cutter.'
      )
    } finally {
      setBusy(false)
    }
  }

  const addFiles = async (files: File[]) => {
    if (busy || !files.length) return
    if (queue.current.length + files.length > 100) {
      setMessage('Import up to 100 PNG images at a time.')
      return
    }
    const added = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      quantity: 1,
      widthMm: settings.widthMm
    }))
    setItems((current) => [...current, ...added])
    await generate(added)
  }
  useEffect(() => {
    if (!active || busy || !incoming || consumedImport.current === incoming.id) return
    consumedImport.current = incoming.id
    const existing = queue.current
    const newCount = incoming.stickers.filter(
      (input) => !existing.some((item) => item.origin?.sourceId === input.sourceId)
    ).length
    if (existing.length + newCount > 100) {
      setMessage('Import up to 100 PNG images at a time.')
      return
    }
    const updated = [...existing]
    const targets: ContourItem[] = []
    for (const input of incoming.stickers) {
      const index = updated.findIndex((item) => item.origin?.sourceId === input.sourceId)
      const previous = updated[index]
      if (
        previous?.result &&
        previous.origin?.artworkVersion === input.artworkVersion &&
        previous.origin.widthMm === input.widthMm &&
        previous.origin.quantity === input.quantity
      )
        continue
      if (previous?.preview) URL.revokeObjectURL(previous.preview)
      const item: ContourItem = {
        id: previous?.id ?? crypto.randomUUID(),
        file: input.file,
        widthMm: input.widthMm,
        quantity: input.quantity,
        origin: input
      }
      if (index >= 0) updated[index] = item
      else updated.push(item)
      targets.push(item)
    }
    setItems(updated)
    setSettings((current) => ({
      ...current,
      widthMm: updated.find((item) => !item.sent)?.widthMm ?? updated[0]?.widthMm ?? current.widthMm
    }))
    void generate(targets)
  }, [active, incoming, busy])
  const changeSettings = (patch: Partial<PngWhiteContourSettings>) => {
    const next = { ...settings, ...patch }
    next.insetMm = Math.min(next.insetMm, Number((next.borderMm - 0.2).toFixed(3)))
    setSettings(next)
    for (const item of items) if (!item.sent && item.preview) URL.revokeObjectURL(item.preview)
    setItems((current) =>
      current.map((item) =>
        item.sent
          ? item
          : {
              ...item,
              widthMm: patch.widthMm ?? item.widthMm,
              result: undefined,
              preview: undefined,
              error: undefined
            }
      )
    )
    setMessage('Settings changed. Update contours before sending to Cutter.')
  }
  const ready = items.filter((item) => item.result && !item.sent)
  const pending = items.filter((item) => !item.result && !item.sent)
  const mixedWidths =
    new Set(items.filter((item) => !item.sent).map((item) => item.widthMm)).size > 1
  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-[var(--ui-radius-lg)] border bg-card p-3"
      aria-label={t('PNG white contour')}
      aria-busy={busy}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="me-auto text-lg font-semibold">{t('PNG white contour')}</h2>
        <input
          ref={fileInput}
          type="file"
          accept=".png,image/png"
          multiple
          className="hidden"
          aria-label={t('Import PNG images')}
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
        <ActionButton
          ref={importButton}
          action="import"
          variant={items.length ? 'outline' : 'default'}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {t('Import PNG images')}
        </ActionButton>
        <Button
          type="button"
          variant={pending.length && !ready.length ? 'default' : 'outline'}
          disabled={busy || !pending.length}
          onClick={() => void generate(pending)}
        >
          {t('Update contours')}
        </Button>
        <Button
          type="button"
          variant={ready.length && !pending.length ? 'default' : 'outline'}
          disabled={busy || !ready.length || !!pending.length}
          onClick={() => {
            onSend(
              ready.map((item) => ({ result: item.result!, quantity: item.quantity, offsetMm: 0 })),
              0
            )
            setItems((current) =>
              current.map((item) => (item.result ? { ...item, sent: true } : item))
            )
            setMessage('Contours sent to Cutter.')
          }}
        >
          {t('Send to Cutter')} ({ready.length})
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="space-y-4 rounded-[var(--ui-radius-lg)] border bg-background p-4 md:w-60 md:shrink-0 md:overflow-y-auto">
          {(
            [
              ['widthMm', 'Artwork width (mm)', 5, 900],
              ['borderMm', 'White border (mm)', 0.5, 20],
              [
                'insetMm',
                'Cut safety inset (mm)',
                0.2,
                Number((settings.borderMm - 0.2).toFixed(3))
              ]
            ] as const
          ).map(([key, label, min, max]) => (
            <label className="block text-sm" key={key}>
              {t(label)}
              <LiveNumberInput
                aria-describedby={key === 'insetMm' ? 'png-contour-safety' : undefined}
                value={settings[key]}
                min={min}
                max={max}
                step={0.1}
                disabled={busy}
                onValueChange={(value) => changeSettings({ [key]: value })}
                className="mt-1 w-full rounded-md border bg-background p-2"
              />
            </label>
          ))}
          {mixedWidths && (
            <p className="text-xs text-muted-foreground">
              {t(
                'Sticker widths are preserved. Changing artwork width applies it to all unsent stickers.'
              )}
            </p>
          )}
          <p id="png-contour-safety" className="text-xs text-muted-foreground">
            {t(
              'The cut line stays inside the white border, leaving white bleed outside the cut to absorb alignment errors.'
            )}
          </p>
          {busy && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                stop.current = true
              }}
            >
              {t('Stop')}
            </Button>
          )}
        </div>
        <div
          className="min-w-0 flex-1 space-y-3 md:overflow-y-auto"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void addFiles(Array.from(event.dataTransfer.files))
          }}
        >
          {!items.length && (
            <p className="rounded-[var(--ui-radius-lg)] border border-dashed p-8 text-center text-muted-foreground">
              {t('Import transparent PNG images to create white contours.')}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="min-w-0 space-y-2 rounded-[var(--ui-radius-lg)] border bg-background p-3"
              >
                <div className="flex items-start gap-2">
                  <h3 className="min-w-0 flex-1 break-words text-sm font-medium">
                    {item.file.name}
                  </h3>
                  <ActionButton
                    action="delete"
                    size="icon-sm"
                    iconOnly
                    disabled={busy}
                    onClick={() => {
                      if (item.preview) URL.revokeObjectURL(item.preview)
                      setItems((current) => current.filter((value) => value.id !== item.id))
                    }}
                  />
                </div>
                {item.result && item.preview && (
                  <>
                    <div
                      className="flex h-52 items-center justify-center overflow-hidden rounded-md bg-muted p-2"
                      dir="ltr"
                    >
                      <svg
                        role="img"
                        aria-label={t('White border and cut preview')}
                        viewBox={`0 0 ${item.result.widthPx} ${item.result.heightPx}`}
                        className="h-full w-full"
                      >
                        <image
                          href={item.preview}
                          width={item.result.widthPx}
                          height={item.result.heightPx}
                        />
                        <path
                          d={item.result.pathData}
                          transform={`scale(${item.result.widthPx} ${item.result.heightPx})`}
                          fill="none"
                          stroke="#e6007e"
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('Artwork')}:{' '}
                      <span dir="ltr">
                        {item.result.widthMm.toFixed(1)} × {item.result.heightMm.toFixed(1)} mm
                      </span>
                    </p>
                    {item.result.warnings.map((warning) => (
                      <p key={warning} role="status" className="text-xs text-muted-foreground">
                        {t(warning)}
                      </p>
                    ))}
                  </>
                )}
                {item.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {t(item.error)}
                  </p>
                )}
                {!item.result && !item.error && (
                  <p className="text-sm text-muted-foreground">
                    {t(busy ? 'Preparing…' : 'Update contours')}
                  </p>
                )}
                <label className="flex items-center gap-2 text-sm">
                  {t('Copies')}
                  <LiveNumberInput
                    value={item.quantity}
                    integer
                    min={1}
                    max={100000}
                    disabled={busy || item.sent}
                    onValueChange={(quantity) =>
                      setItems((current) =>
                        current.map((value) =>
                          value.id === item.id ? { ...value, quantity } : value
                        )
                      )
                    }
                    className="w-24 rounded-md border bg-background p-2"
                  />
                </label>
                {item.sent && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {t('Sent')}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
      {busy && (
        <progress
          aria-label={t('Preparing contours')}
          value={progress.done}
          max={progress.total || 1}
          className="h-2 w-full accent-primary"
        />
      )}
      <p role="status" className="text-xs text-muted-foreground">
        {t(message)} {busy ? `${progress.done}/${progress.total}` : ''}
      </p>
    </section>
  )
}
