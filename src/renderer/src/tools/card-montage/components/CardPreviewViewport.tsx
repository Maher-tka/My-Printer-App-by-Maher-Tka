import { useLanguage } from '@/i18n/useLanguage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PreviewZoomControls } from '@/components/ui/preview-zoom-controls'
import type { CardArtwork } from '../types'
import type { getCardLayout } from '../lib/layout'
import { CardSheetPreview } from './CardSheetPreview'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const PADDING = 20
const GAP = 16

export function CardPreviewViewport({
  sides,
  front,
  back,
  layout
}: {
  sides: ('front' | 'back')[]
  front: CardArtwork | null
  back: CardArtwork | null
  layout: ReturnType<typeof getCardLayout>
}): JSX.Element {
  const { t } = useLanguage()

  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const zoomRef = useRef(1)
  const [zoom, setZoom] = useState(1)
  const [viewportSize, setViewportSize] = useState({ width: 600, height: 500 })
  const paired = sides.length === 2
  const fitWidth = Math.max(
    1,
    Math.min(
      (viewportSize.width - PADDING * 2 - (paired ? GAP : 0)) / sides.length,
      ((viewportSize.height - PADDING * 2 - (paired ? 32 : 0)) * layout.sheetWidthMm) /
        layout.sheetHeightMm,
      590
    )
  )

  const changeZoom = useCallback((requested: number, point?: { x: number; y: number }) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(requested * 100) / 100))
    if (next === zoomRef.current) return
    const viewport = viewportRef.current
    const canvas = canvasRef.current
    if (!viewport || !canvas) return
    const bounds = viewport.getBoundingClientRect()
    const old = canvas.getBoundingClientRect()
    const anchor = point ?? {
      x: bounds.left + viewport.clientWidth / 2,
      y: bounds.top + viewport.clientHeight / 2
    }
    const fractionX = Math.max(0, Math.min(1, (anchor.x - old.left) / old.width))
    const fractionY = Math.max(0, Math.min(1, (anchor.y - old.top) / old.height))
    zoomRef.current = next
    setZoom(next)
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      if (!viewportRef.current || !canvasRef.current) return
      const updated = canvasRef.current.getBoundingClientRect()
      viewport.scrollLeft += updated.left + updated.width * fractionX - anchor.x
      viewport.scrollTop += updated.top + updated.height * fractionY - anchor.y
    })
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const resize = () =>
      setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(viewport)
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || !event.deltaY) return
      event.preventDefault()
      event.stopPropagation()
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1)
      changeZoom(zoomRef.current * Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.002), {
        x: event.clientX,
        y: event.clientY
      })
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      observer.disconnect()
      viewport.removeEventListener('wheel', onWheel)
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [changeZoom])

  const resetZoom = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    zoomRef.current = 1
    setZoom(1)
    viewportRef.current?.scrollTo({ left: 0, top: 0 })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PreviewZoomControls
          zoom={zoom}
          zoomOutDisabled={zoom <= MIN_ZOOM}
          zoomInDisabled={zoom >= MAX_ZOOM}
          onZoomOut={() => changeZoom(zoomRef.current - 0.25)}
          onZoomIn={() => changeZoom(zoomRef.current + 0.25)}
          onFit={resetZoom}
        />
        <p className="text-xs text-muted-foreground">{t('Ctrl + scroll to zoom')}</p>
      </div>
      <div
        ref={viewportRef}
        dir="ltr"
        tabIndex={0}
        role="region"
        aria-label="Scrollable card sheet preview"
        className="h-[calc(100vh-340px)] min-h-[260px] max-h-[750px] overflow-auto overscroll-contain rounded-xl border bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ overflowAnchor: 'none' }}
      >
        <div className="min-h-full min-w-full w-max p-5">
          <div
            ref={canvasRef}
            className="mx-auto grid items-start gap-4"
            style={{
              width: fitWidth * zoom * sides.length + (paired ? GAP : 0),
              gridTemplateColumns: `repeat(${sides.length}, minmax(0, 1fr))`
            }}
          >
            {sides.map((side) => (
              <CardSheetPreview
                key={side}
                side={side}
                artwork={side === 'front' ? front : back}
                layout={layout}
                showLabel={paired}
                sheetWidthPx={fitWidth * zoom}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
