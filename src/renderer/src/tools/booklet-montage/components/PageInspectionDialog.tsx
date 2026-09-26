import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { getReadableTextColor, getSolidFillHex } from '../lib/colorUtils'
import { releasePagePreviewUrl, renderPagePreview } from '../lib/pagePreviewRenderer'
import type { BookletPage, BookletScaleMode, BookletSource } from '../types'

export function PageInspectionDialog({
  page,
  pageNumber,
  source,
  scaleMode = 'fit',
  onClose
}: {
  page: BookletPage
  pageNumber: number
  source?: BookletSource
  scaleMode?: BookletScaleMode
  onClose: () => void
}): ReactNode {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState(page.thumbnailUrl)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(page.sourceType !== 'blank' && Boolean(source))

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  useEffect(() => {
    if (page.sourceType === 'blank' || !source) {
      setPreviewUrl(page.thumbnailUrl)
      setPreviewError(
        page.sourceType !== 'blank' && !page.thumbnailUrl
          ? 'The original source is not available for a full-quality preview.'
          : null
      )
      setIsRendering(false)
      return
    }

    let active = true
    let renderedUrl: string | undefined
    const controller = new AbortController()
    setIsRendering(true)
    setPreviewError(null)

    void renderPagePreview(page, source, {
      quality: 'fullPage3d',
      scaleMode,
      signal: controller.signal
    })
      .then((url) => {
        if (!active) {
          releasePagePreviewUrl(url)
          return
        }
        renderedUrl = url
        setPreviewUrl(url)
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return
        setPreviewError(error instanceof Error ? error.message : 'Could not render this page.')
      })
      .finally(() => {
        if (active) setIsRendering(false)
      })

    return () => {
      active = false
      controller.abort()
      if (renderedUrl) releasePagePreviewUrl(renderedUrl)
    }
  }, [page, scaleMode, source])

  const widthMm = Math.max(page.widthMm, 1)
  const heightMm = Math.max(page.heightMm, 1)
  const aspectRatio = widthMm / heightMm

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950/90 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Page ${pageNumber} inspection`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="mx-auto mb-4 flex w-full max-w-6xl items-center justify-between gap-4 text-white">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-300">
            Page inspection
          </p>
          <h3 className="truncate text-lg font-semibold">
            Page {pageNumber} · {page.displayName}
          </h3>
          <p className="text-xs text-slate-300">
            {widthMm.toFixed(1)} × {heightMm.toFixed(1)} mm
          </p>
        </div>
        <Button
          ref={closeButtonRef}
          type="button"
          size="icon"
          variant="outline"
          className="shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          onClick={onClose}
          aria-label="Close page inspection"
          title="Close (Esc)"
        >
          <X />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          className="relative overflow-hidden rounded-sm border border-white/25 bg-white shadow-2xl"
          aria-busy={isRendering}
          style={{
            aspectRatio: `${widthMm} / ${heightMm}`,
            width: `min(88vw, calc(78vh * ${aspectRatio}))`,
            maxHeight: '78vh'
          }}
        >
          <BookletPageArtwork page={page} previewUrl={previewUrl} />
          {isRendering ? (
            <div
              className="absolute inset-x-0 bottom-0 bg-slate-950/70 px-3 py-2 text-center text-xs font-medium text-white"
              role="status"
              aria-live="polite"
            >
              Rendering full-quality preview…
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-4 text-center text-xs text-slate-300" aria-live="polite">
        {previewError ? <p className="mb-1 text-amber-300">{previewError}</p> : null}
        <p>Press Esc or click outside the page to close</p>
      </div>
    </div>,
    document.body
  )
}

export function BookletPageArtwork({
  page,
  previewUrl = page.thumbnailUrl
}: {
  page: BookletPage
  previewUrl?: string
}): JSX.Element {
  if (page.sourceType === 'blank') {
    const fillColor = getSolidFillHex(page.colorHex)
    return (
      <div
        className="grid h-full w-full place-items-center text-sm font-semibold"
        style={{ backgroundColor: fillColor, color: getReadableTextColor(fillColor) }}
      >
        Blank
      </div>
    )
  }

  if (previewUrl) {
    return (
      <img
        src={previewUrl}
        alt={page.displayName}
        className="h-full w-full object-contain"
        draggable={false}
      />
    )
  }

  return <span className="text-sm font-semibold text-muted-foreground">Preview unavailable</span>
}
