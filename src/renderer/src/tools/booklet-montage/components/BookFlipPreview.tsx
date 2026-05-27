import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react'
import HTMLFlipBook from 'react-pageflip'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BookletPage, SheetSettings } from '../types'
import { getBookletSlotRects, getPrintSizeMm } from '../lib/printSizes'
import { BookFlipPage } from './BookFlipPage'

interface BookFlipPreviewProps {
  orderedPages: BookletPage[]
  settings: SheetSettings
}

interface PageFlipApi {
  flipNext: (corner?: 'top' | 'bottom') => void
  flipPrev: (corner?: 'top' | 'bottom') => void
  turnToPage: (pageIndex: number) => void
  getCurrentPageIndex: () => number
  startUserTouch?: (point: FlipPoint) => void
  userMove?: (point: FlipPoint, isTouch: boolean) => void
  userStop?: (point: FlipPoint, isSwipe?: boolean) => void
}

interface FlipBookRef {
  pageFlip: () => PageFlipApi | undefined
}

interface FlipPoint {
  x: number
  y: number
}

interface FlipEvent {
  data?: number
}

interface BookFlipErrorBoundaryProps {
  children: ReactNode
}

interface BookFlipErrorBoundaryState {
  hasError: boolean
}

export function BookFlipPreview({
  orderedPages,
  settings
}: BookFlipPreviewProps): JSX.Element {
  const pages = useMemo(
    () =>
      [...orderedPages].sort(
        (first, second) => first.currentOrderIndex - second.currentOrderIndex
      ),
    [orderedPages]
  )
  const pageKey = useMemo(
    () => pages.map((page) => `${page.id}:${page.thumbnailUrl ?? 'blank'}`).join('|'),
    [pages]
  )

  return (
    <BookFlipErrorBoundary key={pageKey}>
      <BookFlipPreviewContent orderedPages={pages} pageKey={pageKey} settings={settings} />
    </BookFlipErrorBoundary>
  )
}

function BookFlipPreviewContent({
  orderedPages,
  pageKey,
  settings
}: {
  orderedPages: BookletPage[]
  pageKey: string
  settings: SheetSettings
}): JSX.Element {
  const bookRef = useRef<FlipBookRef | null>(null)
  const rtlInteractionRef = useRef<HTMLDivElement | null>(null)
  const rtlPointerIdRef = useRef<number | null>(null)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [previewsReady, setPreviewsReady] = useState(false)
  const dimensions = useMemo(() => getFlipPageDimensions(settings), [settings])
  const isRtl = settings.readingDirection === 'rtl'
  const bookRenderKey = `${pageKey}:${dimensions.width}x${dimensions.height}:${settings.readingDirection}`

  useEffect(() => {
    setCurrentPageIndex(0)
  }, [bookRenderKey])

  useEffect(() => {
    let canceled = false
    const previewUrls = orderedPages
      .map((page) => page.thumbnailUrl)
      .filter((url): url is string => Boolean(url))

    if (previewUrls.length === 0) {
      setPreviewsReady(true)
      return () => {
        canceled = true
      }
    }

    setPreviewsReady(false)
    Promise.allSettled(previewUrls.map(loadImage)).then(() => {
      if (!canceled) {
        setPreviewsReady(true)
      }
    })

    return () => {
      canceled = true
    }
  }, [pageKey, orderedPages])

  const getRtlPointerPoint = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): FlipPoint | null => {
      const surface = rtlInteractionRef.current

      if (!surface) {
        return null
      }

      const rect = surface.getBoundingClientRect()

      if (rect.width <= 0 || rect.height <= 0) {
        return null
      }

      return {
        x: clamp(rect.right - event.clientX, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height)
      }
    },
    []
  )

  const handleRtlPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isRtl || !previewsReady) {
        return
      }

      const flip = bookRef.current?.pageFlip()
      const point = getRtlPointerPoint(event)

      if (!flip?.startUserTouch || !point) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      rtlPointerIdRef.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      flip.startUserTouch(point)
    },
    [getRtlPointerPoint, isRtl, previewsReady]
  )

  const handleRtlPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (rtlPointerIdRef.current !== event.pointerId) {
        return
      }

      const flip = bookRef.current?.pageFlip()
      const point = getRtlPointerPoint(event)

      if (!flip?.userMove || !point) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      flip.userMove(point, false)
    },
    [getRtlPointerPoint]
  )

  const stopRtlPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (rtlPointerIdRef.current !== event.pointerId) {
        return
      }

      const flip = bookRef.current?.pageFlip()
      const point = getRtlPointerPoint(event)

      event.preventDefault()
      event.stopPropagation()

      if (flip?.userStop && point) {
        flip.userStop(point, false)
      }

      rtlPointerIdRef.current = null

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    [getRtlPointerPoint]
  )

  if (orderedPages.length === 0) {
    return (
      <section
        className="grid min-h-[480px] place-items-center rounded-lg border bg-slate-50 p-8 text-center"
        data-book-flip-preview="empty"
      >
        <div className="max-w-md">
          <Badge variant="secondary">3D Book Mode</Badge>
          <h3 className="mt-4 text-lg font-semibold text-slate-950">No book pages yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            Add PDF pages, image pages, or blank pages in Sheet Mode to preview the booklet.
          </p>
        </div>
      </section>
    )
  }

  const canGoPrevious = currentPageIndex > 0
  const canGoNext = currentPageIndex < orderedPages.length - 1

  return (
    <section
      className="overflow-hidden rounded-lg border bg-slate-50 shadow-sm"
      data-book-flip-preview="ready"
      data-current-page={currentPageIndex + 1}
      data-page-count={orderedPages.length}
      data-reading-direction={settings.readingDirection}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-950">3D Book Mode</h3>
            <Badge variant="secondary">Interactive</Badge>
            <Badge variant={isRtl ? 'warning' : 'secondary'}>
              {isRtl ? 'RTL Arabic' : 'LTR'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Page {Math.min(currentPageIndex + 1, orderedPages.length)} of {orderedPages.length}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              bookRef.current?.pageFlip()?.turnToPage(0)
              setCurrentPageIndex(0)
            }}
            disabled={!canGoPrevious}
          >
            <RotateCcw data-icon="inline-start" />
            Reset to First Page
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => bookRef.current?.pageFlip()?.flipPrev(isRtl ? 'top' : 'bottom')}
            disabled={!canGoPrevious}
          >
            <ChevronLeft data-icon="inline-start" />
            Previous Page
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => bookRef.current?.pageFlip()?.flipNext(isRtl ? 'top' : 'bottom')}
            disabled={!canGoNext}
          >
            Next Page
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </div>

      <div className="min-h-[660px] overflow-auto bg-[radial-gradient(circle_at_center,#ffffff_0%,#eef3f8_52%,#dce5ef_100%)] p-6">
        <div className="mx-auto flex min-w-[820px] flex-col items-center justify-center gap-4">
          {!previewsReady ? (
            <div className="grid h-[560px] w-[760px] place-items-center rounded-lg border border-dashed bg-white/70 text-sm font-medium text-slate-600">
              Preparing interactive book preview...
            </div>
          ) : (
            <div
              className="relative rounded-xl bg-slate-900/5 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.18)]"
              style={{
                minWidth: dimensions.width * 2 + 96,
                minHeight: dimensions.height + 80
              }}
            >
              <div
                className="book-flip-direction-stage relative shadow-[0_20px_70px_rgba(15,23,42,0.18)]"
                style={{
                  width: dimensions.width * 2,
                  height: dimensions.height,
                  margin: '0 auto',
                  transform: isRtl ? 'scaleX(-1)' : undefined,
                  transformOrigin: 'center center'
                }}
                data-reading-direction={settings.readingDirection}
              >
                <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px -translate-x-1/2 bg-black/15" />
                <HTMLFlipBook
                  key={bookRenderKey}
                  ref={bookRef}
                  className="book-flip-instance"
                  style={{
                    width: dimensions.width * 2,
                    height: dimensions.height,
                    margin: '0 auto'
                  }}
                  startPage={0}
                  size="fixed"
                  width={dimensions.width}
                  height={dimensions.height}
                  minWidth={dimensions.width}
                  maxWidth={dimensions.width}
                  minHeight={dimensions.height}
                  maxHeight={dimensions.height}
                  drawShadow
                  flippingTime={760}
                  usePortrait={false}
                  startZIndex={10}
                  autoSize={false}
                  maxShadowOpacity={0.42}
                  showCover
                  mobileScrollSupport={false}
                  clickEventForward
                  useMouseEvents
                  swipeDistance={14}
                  showPageCorners
                  disableFlipByClick={false}
                  renderOnlyPageLengthChange={false}
                  onFlip={(event: FlipEvent) => {
                    if (typeof event.data === 'number') {
                      setCurrentPageIndex(event.data)
                    }
                  }}
                  onInit={(event: FlipEvent) => {
                    if (typeof event.data === 'number') {
                      setCurrentPageIndex(event.data)
                    }
                  }}
                  onUpdate={() => {
                    const nextPage = bookRef.current?.pageFlip()?.getCurrentPageIndex() ?? 0
                    setCurrentPageIndex(nextPage)
                  }}
                >
                  {orderedPages.map((page, index) => (
                    <BookFlipPage
                      key={page.id}
                      page={page}
                      pageNumber={index + 1}
                      readingDirection={settings.readingDirection}
                      width={dimensions.width}
                      height={dimensions.height}
                    />
                  ))}
                </HTMLFlipBook>
                {isRtl && (
                  <div
                    ref={rtlInteractionRef}
                    aria-label="RTL book page drag surface"
                    className="absolute inset-0 z-30 cursor-grab touch-none active:cursor-grabbing"
                    data-rtl-flip-input="true"
                    role="presentation"
                    style={{ touchAction: 'none' }}
                    onPointerDown={handleRtlPointerDown}
                    onPointerMove={handleRtlPointerMove}
                    onPointerUp={stopRtlPointerDrag}
                    onPointerCancel={stopRtlPointerDrag}
                  />
                )}
              </div>
            </div>
          )}

          <p className="max-w-xl text-center text-sm text-slate-600">
            Drag a page corner or page edge with the mouse, then release it to flip.
            {isRtl ? ' RTL Arabic mode is active.' : ''} Montage Mode remains the
            print-accurate layout.
          </p>
        </div>
      </div>
    </section>
  )
}

class BookFlipErrorBoundary extends Component<
  BookFlipErrorBoundaryProps,
  BookFlipErrorBoundaryState
> {
  state: BookFlipErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): BookFlipErrorBoundaryState {
    return { hasError: true }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section
          className="grid min-h-[420px] place-items-center rounded-lg border border-amber-200 bg-amber-50 p-8 text-center text-amber-950"
          data-book-flip-preview="fallback"
        >
          <div className="max-w-md">
            <h3 className="text-lg font-semibold">Interactive book preview unavailable</h3>
            <p className="mt-2 text-sm">
              Interactive book preview unavailable. Use Montage View for print accuracy.
            </p>
          </div>
        </section>
      )
    }

    return this.props.children
  }
}

function getFlipPageDimensions(settings: SheetSettings): { width: number; height: number } {
  try {
    const paperSize = getPrintSizeMm(settings)
    const slot = getBookletSlotRects(paperSize).left
    const ratio = Math.max(0.45, Math.min(slot.width / slot.height, 1.2))
    const height = 540
    const width = Math.round(height * ratio)

    return {
      width: Math.max(280, Math.min(width, 430)),
      height
    }
  } catch {
    return { width: 360, height: 540 }
  }
}

function loadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image()

    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = url
  })
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
