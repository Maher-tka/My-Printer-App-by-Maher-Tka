import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { assertWithinCanvasBudget } from '../../../performance/memoryBudget'
import { getPerformanceSettingsSnapshot } from '../../../performance/performanceSettings'
import type { PiecePreset } from '../types'
import {
  addSolidBackground,
  assertBackgroundDimensions,
  removeEdgeBackground
} from '../lib/artworkBackground'

export interface ArtworkBackgroundResult {
  bytes: Uint8Array
  previewDataUrl: string
  widthPx: number
  heightPx: number
}

interface ArtworkBackgroundToolsProps {
  piece: PiecePreset
  onApply: (pieceId: string, result: ArtworkBackgroundResult) => void
}

function loadImage(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const cleanup = (): void => {
      signal.removeEventListener('abort', abort)
      image.onload = null
      image.onerror = null
    }
    const abort = (): void => {
      cleanup()
      image.src = ''
      reject(new DOMException('Canceled', 'AbortError'))
    }
    image.onload = () => {
      cleanup()
      resolve(image)
    }
    image.onerror = () => {
      cleanup()
      reject(new Error('Could not load this artwork for background editing.'))
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    else image.src = url
  })
}

export function ArtworkBackgroundTools({
  piece,
  onApply
}: ArtworkBackgroundToolsProps): JSX.Element {
  const [color, setColor] = useState('#ffffff')
  const [tolerance, setTolerance] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const operation = useRef<AbortController>()
  const previewUrl = piece.artwork.previewUrl || piece.previewUrl
  const current = useRef({ id: piece.id, previewUrl })
  current.current = { id: piece.id, previewUrl }

  useEffect(() => {
    setBusy(false)
    setError(undefined)
    return () => {
      operation.current?.abort()
      operation.current = undefined
    }
  }, [piece.id, previewUrl])

  const apply = async (mode: 'remove' | 'add'): Promise<void> => {
    if (operation.current) return
    const controller = new AbortController()
    operation.current = controller
    const pieceId = piece.id
    const isCurrent = (): boolean =>
      !controller.signal.aborted &&
      current.current.id === pieceId &&
      current.current.previewUrl === previewUrl
    let canvas: HTMLCanvasElement | undefined
    setBusy(true)
    setError(undefined)
    try {
      const image = await loadImage(previewUrl, controller.signal)
      if (!isCurrent()) return
      const widthPx = image.naturalWidth
      const heightPx = image.naturalHeight
      assertBackgroundDimensions(widthPx, heightPx)
      assertWithinCanvasBudget(
        widthPx,
        heightPx,
        'editing artwork background',
        getPerformanceSettingsSnapshot()
      )
      canvas = document.createElement('canvas')
      canvas.width = widthPx
      canvas.height = heightPx
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('The image editor is unavailable.')
      context.drawImage(image, 0, 0)
      const imageData = context.getImageData(0, 0, widthPx, heightPx)
      const pixels =
        mode === 'remove'
          ? await removeEdgeBackground(
              imageData.data,
              widthPx,
              heightPx,
              color,
              tolerance,
              controller.signal
            )
          : addSolidBackground(imageData.data, color)
      if (!isCurrent()) return
      imageData.data.set(pixels)
      context.putImageData(imageData, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas!.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error('Could not save the background edit.')),
          'image/png'
        )
      })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      if (!isCurrent()) return
      const previewDataUrl = canvas.toDataURL('image/png')
      onApply(pieceId, { bytes, previewDataUrl, widthPx, heightPx })
    } catch (caught) {
      if (isCurrent())
        setError(caught instanceof Error ? caught.message : 'Background editing failed.')
    } finally {
      if (canvas) {
        canvas.width = 1
        canvas.height = 1
      }
      if (operation.current === controller) {
        operation.current = undefined
        if (isCurrent()) setBusy(false)
      }
    }
  }

  return (
    <section className="rounded-lg border bg-card p-3" aria-busy={busy}>
      <h4 className="text-sm font-semibold">Background</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Remove a solid color from the edges, or add color behind transparent artwork.
      </p>
      <fieldset disabled={busy} className="mt-3 space-y-3">
        <label className="flex items-center justify-between gap-2 text-xs">
          Background color
          <input
            type="color"
            aria-label="Background color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-8 w-12 cursor-pointer rounded border"
          />
        </label>
        <label className="block text-xs">
          Removal tolerance: {tolerance}%
          <input
            type="range"
            aria-label="Background removal tolerance"
            min={0}
            max={100}
            value={tolerance}
            onChange={(event) => setTolerance(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>
        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void apply('remove')}
          >
            Remove solid background
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void apply('add')}
          >
            Add background color
          </Button>
        </div>
      </fieldset>
      {piece.sourceKind !== 'image' && (
        <p className="mt-2 text-xs text-muted-foreground">
          Background edits convert this artwork preview to PNG at its current resolution.
        </p>
      )}
      {busy && (
        <p className="mt-2 text-xs" role="status">
          Updating artwork…
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
