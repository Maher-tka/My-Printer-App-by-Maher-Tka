import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent
} from 'react'
import {
  ChevronLeft,
  ChevronRight,
  MousePointer2,
  Type,
  Square,
  Highlighter,
  ImagePlus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/ui/action-button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/i18n/useLanguage'
import { withPdf, renderPdfPage } from './conversions'
import { runPdfWorker } from './pdfWorkerClient'
import { getPdfMemoryPolicy } from './memoryPolicy'
import type { PdfInput } from './model'

type ElementKind = 'text' | 'rectangle' | 'highlight' | 'image'
interface Element {
  id: string
  page: number
  kind: ElementKind
  x: number
  y: number
  width: number
  height: number
  text: string
  color: string
  size: number
  image?: string
}
export interface PdfEditorHandle {
  exportPdf: (signal?: AbortSignal) => Promise<Uint8Array>
}

async function paint(
  canvas: HTMLCanvasElement,
  elements: Element[],
  width: number,
  height: number
): Promise<void> {
  const scale = Math.min(2, Math.sqrt(getPdfMemoryPolicy().maxCanvasPixels / (width * height)))
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const context = canvas.getContext('2d')!
  context.scale(scale, scale)
  for (const element of elements) {
    const x = element.x * width,
      y = element.y * height,
      w = element.width * width,
      h = element.height * height
    context.fillStyle = element.color
    context.strokeStyle = element.color
    context.globalAlpha = element.kind === 'highlight' ? 0.3 : 1
    if (element.kind === 'text') {
      context.font = `${element.size}px "Segoe UI", sans-serif`
      context.textBaseline = 'top'
      context.direction = /[\u0600-\u06ff]/.test(element.text) ? 'rtl' : 'ltr'
      context.textAlign = 'start'
      element.text
        .split('\n')
        .forEach((line, index) =>
          context.fillText(
            line,
            context.direction === 'rtl' ? x + w : x,
            y + index * element.size * 1.3,
            w
          )
        )
    } else if (element.kind === 'rectangle') {
      context.lineWidth = 2
      context.strokeRect(x, y, w, h)
    } else if (element.kind === 'highlight') context.fillRect(x, y, w, h)
    else if (element.image) {
      const image = new Image()
      image.src = element.image
      await image.decode()
      context.drawImage(image, x, y, w, h)
    }
  }
  context.globalAlpha = 1
}

export const PdfEditor = forwardRef<
  PdfEditorHandle,
  { input: PdfInput; disabled: boolean; onChanged: () => void }
>(function PdfEditor({ input, disabled, onChanged }, ref) {
  const { t } = useLanguage()
  const [page, setPage] = useState(0),
    [preview, setPreview] = useState<{ url: string; width: number; height: number } | null>(null)
  const [elements, setElements] = useState<Element[]>([]),
    [selected, setSelected] = useState<string | null>(null)
  const [mode, setMode] = useState<ElementKind | 'select'>('select'),
    [text, setText] = useState(''),
    [color, setColor] = useState('#172239'),
    [size, setSize] = useState(18)
  const [error, setError] = useState('')
  const history = useRef<Element[][]>([]),
    overlay = useRef<HTMLCanvasElement>(null),
    imageInput = useRef<HTMLInputElement>(null)
  const drag = useRef<{
    id: string
    x: number
    y: number
    originX: number
    originY: number
    before: Element[]
  } | null>(null)
  const current = elements.filter((element) => element.page === page)
  const active = elements.find((element) => element.id === selected)
  const record = (next: Element[]): void => {
    history.current.push(elements)
    setElements(next)
    onChanged()
  }

  useEffect(() => {
    const controller = new AbortController()
    let url = ''
    setPreview(null)
    setError('')
    void withPdf(
      input.bytes,
      async (pdf) => {
        const rendered = await renderPdfPage(pdf, page, 100, controller.signal)
        if (controller.signal.aborted) return
        url = URL.createObjectURL(
          new Blob([new Uint8Array(rendered.bytes)], { type: 'image/jpeg' })
        )
        setPreview({ url, width: rendered.width, height: rendered.height })
      },
      controller.signal
    ).catch((error) => {
      if (!controller.signal.aborted) setError(String(error.message ?? error))
    })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [input, page])

  useEffect(() => {
    if (!preview) return
    let canceled = false
    const canvas = document.createElement('canvas')
    void paint(canvas, current, preview.width, preview.height)
      .then(() => {
        if (canceled || !overlay.current) return
        overlay.current.width = canvas.width
        overlay.current.height = canvas.height
        overlay.current.getContext('2d')?.drawImage(canvas, 0, 0)
      })
      .catch(() => {
        if (!canceled) setError(t('Could not render this page.'))
      })
      .finally(() => {
        canvas.width = 0
        canvas.height = 0
      })
    return () => {
      canceled = true
    }
  }, [elements, preview, page])

  useImperativeHandle(
    ref,
    () => ({
      exportPdf: async (signal) => {
        const overlays = []
        for (const index of [...new Set(elements.map((element) => element.page))]) {
          signal?.throwIfAborted()
          const dimensions = await withPdf(input.bytes, async (pdf) =>
            (await pdf.getPage(index + 1)).getViewport({ scale: 1 })
          )
          const canvas = document.createElement('canvas')
          try {
            await paint(
              canvas,
              elements.filter((element) => element.page === index),
              dimensions.width,
              dimensions.height
            )
            const blob = await new Promise<Blob>((resolve, reject) =>
              canvas.toBlob(
                (value) =>
                  value ? resolve(value) : reject(new Error('Could not render this page.')),
                'image/png'
              )
            )
            overlays.push({ page: index, png: new Uint8Array(await blob.arrayBuffer()) })
          } finally {
            canvas.width = 0
            canvas.height = 0
          }
        }
        return runPdfWorker({ operation: 'overlay', bytes: input.bytes, overlays }, signal)
      }
    }),
    [input, elements]
  )

  const point = (event: PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    }
  }
  const add = (kind: ElementKind, x = 0.1, y = 0.1, image?: string, ratio = 1): void => {
    if (disabled) return
    if (kind === 'text' && !text.trim()) {
      setError(t('Enter the text to add.'))
      return
    }
    setError('')
    const id = crypto.randomUUID(),
      width = kind === 'text' ? 0.6 : 0.25
    const height =
      kind === 'image' && preview
        ? (width * preview.width) / preview.height / ratio
        : kind === 'text'
          ? Math.min(0.5, (text.split('\n').length * size * 1.3) / (preview?.height ?? 842))
          : 0.07
    record([
      ...elements,
      {
        id,
        page,
        kind,
        x: Math.min(x, 1 - width),
        y: Math.min(y, 1 - height),
        width,
        height,
        text,
        color: kind === 'highlight' ? '#ffd500' : color,
        size,
        image
      }
    ])
    setSelected(id)
    setMode('select')
  }
  const updateActive = (values: Partial<Element>): void => {
    if (active)
      record(
        elements.map((element) => (element.id === active.id ? { ...element, ...values } : element))
      )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" aria-label={t('Editor tools')}>
        {(
          [
            { id: 'select', title: 'Select', icon: MousePointer2 },
            { id: 'text', title: 'Add text', icon: Type },
            { id: 'rectangle', title: 'Add shape', icon: Square },
            { id: 'highlight', title: 'Highlight', icon: Highlighter }
          ] as const
        ).map(({ id, title, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant={mode === id ? 'selected' : 'outline'}
            aria-pressed={mode === id}
            disabled={disabled}
            size="sm"
            onClick={() => setMode(id)}
          >
            <Icon />
            {t(title)}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => imageInput.current?.click()}
        >
          <ImagePlus />
          {t('Add image')}
        </Button>
        <ActionButton
          action="undo"
          size="sm"
          disabled={disabled || !history.current.length}
          onClick={() => {
            const previous = history.current.pop()
            if (previous) {
              setElements(previous)
              setSelected(null)
              onChanged()
            }
          }}
        />
        <ActionButton
          action="delete"
          size="sm"
          disabled={disabled || !active}
          onClick={() => {
            record(elements.filter((element) => element.id !== selected))
            setSelected(null)
          }}
        />
      </div>
      <input
        ref={imageInput}
        type="file"
        hidden
        accept=".jpg,.jpeg,.png"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          try {
            if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.')
            const data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(String(reader.result))
              reader.onerror = reject
              reader.readAsDataURL(file)
            })
            const image = new Image()
            image.src = data
            await image.decode()
            add('image', 0.1, 0.1, data, image.width / image.height)
          } catch (error) {
            setError(String((error as Error).message))
          }
        }}
      />
      {mode !== 'select' && (
        <div className="flex flex-wrap items-end gap-3 rounded-[var(--ui-radius-md)] bg-muted p-3">
          {mode === 'text' && (
            <label className="min-w-40 flex-1 space-y-1 text-xs">
              {t('Text')}
              <Input
                value={text}
                disabled={disabled}
                onChange={(event) => setText(event.target.value)}
              />
            </label>
          )}
          {mode === 'text' && (
            <label className="space-y-1 text-xs">
              {t('Font size')}
              <Input
                className="w-20"
                type="number"
                min={6}
                max={96}
                value={size}
                onChange={(event) => setSize(Math.max(6, Math.min(96, Number(event.target.value))))}
              />
            </label>
          )}
          {mode !== 'highlight' && (
            <label className="space-y-1 text-xs">
              {t('Color')}
              <input
                type="color"
                className="block h-9 w-12"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </label>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !preview}
            onClick={() => add(mode)}
          >
            {t('Add to page')}
          </Button>
        </div>
      )}
      {active && (
        <div className="flex flex-wrap items-end gap-3">
          {active.kind === 'text' && (
            <label className="min-w-32 flex-1 text-xs">
              {t('Text')}
              <Input
                value={active.text}
                disabled={disabled}
                onChange={(event) => updateActive({ text: event.target.value })}
              />
            </label>
          )}
          {(['x', 'y', 'width', 'height'] as const).map((axis) => (
            <label key={axis} className="text-xs">
              {t({ x: 'X (%)', y: 'Y (%)', width: 'Width (%)', height: 'Height (%)' }[axis])}
              <Input
                type="number"
                className="w-20"
                min={axis === 'width' || axis === 'height' ? 1 : 0}
                max={100}
                value={Math.round(active[axis] * 100)}
                disabled={disabled}
                onChange={(event) =>
                  updateActive({
                    [axis]: Math.max(
                      axis === 'width' || axis === 'height' ? 0.01 : 0,
                      Math.min(1, Number(event.target.value) / 100)
                    )
                  })
                }
              />
            </label>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {t(error)}
        </p>
      )}
      <div className="flex items-center justify-center gap-3" dir="ltr">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t('Previous page')}
          disabled={disabled || !page}
          onClick={() => {
            setPage(page - 1)
            setSelected(null)
          }}
        >
          <ChevronLeft />
        </Button>
        <span className="text-xs tabular-nums">
          {page + 1} / {input.pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t('Next page')}
          disabled={disabled || page + 1 >= (input.pages ?? 1)}
          onClick={() => {
            setPage(page + 1)
            setSelected(null)
          }}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="overflow-auto rounded-[var(--ui-radius-lg)] bg-muted p-4" dir="ltr">
        {preview ? (
          <div
            className="relative mx-auto w-full max-w-[600px]"
            style={{ aspectRatio: `${preview.width}/${preview.height}` }}
          >
            <img
              src={preview.url}
              alt={t('PDF page preview')}
              className="block h-full w-full"
              draggable={false}
            />
            <canvas
              ref={overlay}
              role="img"
              aria-label={t('PDF annotations')}
              className="absolute inset-0 h-full w-full touch-none"
              style={{ cursor: disabled ? 'wait' : mode === 'select' ? 'default' : 'crosshair' }}
              onPointerDown={(event) => {
                if (disabled) return
                const { x, y } = point(event)
                if (mode !== 'select') {
                  add(mode, x, y)
                  return
                }
                const hit = [...current]
                  .reverse()
                  .find(
                    (element) =>
                      x >= element.x &&
                      x <= element.x + element.width &&
                      y >= element.y &&
                      y <= element.y + element.height
                  )
                setSelected(hit?.id ?? null)
                if (hit) {
                  drag.current = {
                    id: hit.id,
                    x,
                    y,
                    originX: hit.x,
                    originY: hit.y,
                    before: elements
                  }
                  event.currentTarget.setPointerCapture(event.pointerId)
                }
              }}
              onPointerMove={(event) => {
                if (!drag.current || disabled) return
                const { x, y } = point(event),
                  moving = drag.current
                setElements(
                  elements.map((element) =>
                    element.id === moving.id
                      ? {
                          ...element,
                          x: Math.max(
                            0,
                            Math.min(1 - element.width, moving.originX + x - moving.x)
                          ),
                          y: Math.max(
                            0,
                            Math.min(1 - element.height, moving.originY + y - moving.y)
                          )
                        }
                      : element
                  )
                )
              }}
              onPointerUp={() => {
                if (drag.current) {
                  history.current.push(drag.current.before)
                  drag.current = null
                  onChanged()
                }
              }}
              onPointerCancel={() => {
                if (drag.current) setElements(drag.current.before)
                drag.current = null
              }}
            />
            {active && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute border-2 border-primary"
                style={{
                  left: `${active.x * 100}%`,
                  top: `${active.y * 100}%`,
                  width: `${active.width * 100}%`,
                  height: `${active.height * 100}%`
                }}
              />
            )}
          </div>
        ) : (
          <p role="status" className="p-12 text-center text-muted-foreground">
            {t('Preparing preview…')}
          </p>
        )}
      </div>
      {current.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={t('Page elements')}>
          {current.map((element, index) => (
            <Button
              type="button"
              variant={selected === element.id ? 'selected' : 'outline'}
              size="sm"
              key={element.id}
              aria-pressed={selected === element.id}
              disabled={disabled}
              onClick={() => setSelected(element.id)}
            >
              {index + 1}.{' '}
              {t(
                { text: 'Text', rectangle: 'Shape', highlight: 'Highlight', image: 'Image' }[
                  element.kind
                ]
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
})
