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
import { usePerformanceSettings } from '@/performance/usePerformanceSettings'
import { getPerformanceBadgeTone, shouldRequireManual3dLoad } from '@/performance/renderQuality'
import type { BookletPage, BookletSource, SheetSettings } from '../types'
import {
  clearPagePreviewCache,
  getBookPageAspectRatio,
  releasePagePreviewUrl,
  renderPagePreview
} from '../lib/pagePreviewRenderer'
import { BookFlipPage } from './BookFlipPage'

interface BookFlipPreviewProps {
  orderedPages: BookletPage[]
  sources: BookletSource[]
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
  sources,
  settings
}: BookFlipPreviewProps): JSX.Element {
  const pages = useMemo(
    () =>
      [...orderedPages].sort((first, second) => first.currentOrderIndex - second.currentOrderIndex),
    [orderedPages]
  )
  const pageKey = useMemo(
    () => pages.map((page) => `${page.id}:${page.thumbnailUrl ?? 'blank'}`).join('|'),
    [pages]
  )

  return (
    <BookFlipErrorBoundary key={pageKey}>
      <BookFlipPreviewContent
        orderedPages={pages}
        pageKey={pageKey}
        settings={settings}
        sources={sources}
      />
    </BookFlipErrorBoundary>
  )
}

function BookFlipPreviewContent({
  orderedPages,
  pageKey,
  settings,
  sources
}: {
  orderedPages: BookletPage[]
  pageKey: string
  settings: SheetSettings
  sources: BookletSource[]
}): JSX.Element {
  const bookRef = useRef<FlipBookRef | null>(null)
  const rtlInteractionRef = useRef<HTMLDivElement | null>(null)
  const rtlPointerIdRef = useRef<number | null>(null)
  const previewUrlsRef = useRef<Record<string, string>>({})
  const { settings: performanceSettings } = usePerformanceSettings()
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [previewsReady, setPreviewsReady] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewUrlsByPageId, setPreviewUrlsByPageId] = useState<Record<string, string>>({})
  const [load3dRequested, setLoad3dRequested] = useState(false)
  const dimensions = useMemo(
    () => getFlipPageDimensions(settings, orderedPages[0]),
    [orderedPages, settings]
  )
  const sourceMap = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources])
  const isRtl = settings.readingDirection === 'rtl'
  const projectInfo = useMemo(
    () => ({
      pageCount: orderedPages.length,
      totalBytes: sources.reduce((total, source) => total + source.bytes.byteLength, 0)
    }),
    [orderedPages.length, sources]
  )
  const shouldWaitForManual3dLoad =
    shouldRequireManual3dLoad(projectInfo, performanceSettings) && !load3dRequested
  const previewUrlsKey = useMemo(
    () =>
      orderedPages
        .map((page) => `${page.id}:${previewUrlsByPageId[page.id] ?? 'pending'}`)
        .join('|'),
    [orderedPages, previewUrlsByPageId]
  )
  const bookRenderKey = `${pageKey}:${previewUrlsKey}:${dimensions.width}x${dimensions.height}:${settings.readingDirection}:${settings.scaleMode}:${performanceSettings.preset}`

  useEffect(() => {
    setCurrentPageIndex(0)
  }, [bookRenderKey])

  useEffect(() => {
    setLoad3dRequested(false)
  }, [pageKey, performanceSettings.preset])

  useEffect(() => {
    previewUrlsRef.current = previewUrlsByPageId
  }, [previewUrlsByPageId])

  useEffect(() => {
    return () => {
      for (const url of Object.values(previewUrlsRef.current)) {
        releasePagePreviewUrl(url)
      }

      previewUrlsRef.current = {}
      void clearPagePreviewCache()
    }
  }, [])

  useEffect(() => {
    let canceled = false
    const abortController = new AbortController()

    if (orderedPages.length === 0 || shouldWaitForManual3dLoad) {
      setPreviewsReady(true)
      setPreviewError(null)
      setPreviewUrlsByPageId((current) => {
        for (const url of Object.values(current)) {
          releasePagePreviewUrl(url)
        }

        return {}
      })

      return () => {
        canceled = true
        abortController.abort()
      }
    }

    setPreviewsReady(false)
    setPreviewError(null)

    async function renderPreviews(): Promise<void> {
      const entries: Array<readonly [string, string]> = []

      for (const page of orderedPages) {
        if (canceled) {
          return
        }

        const source = page.sourceId ? sourceMap.get(page.sourceId) : undefined
        const url = await renderPagePreview(page, source, {
          quality: 'fullPage3d',
          targetWidthPx: dimensions.width * getPreviewPixelScale(),
          targetHeightPx: dimensions.height * getPreviewPixelScale(),
          scaleMode: settings.scaleMode,
          signal: abortController.signal
        })

        entries.push([page.id, url] as const)
        setPreviewUrlsByPageId((current) => ({ ...current, [page.id]: url }))
      }

      if (!canceled) {
        if (canceled) {
          return
        }

        const nextUrls = Object.fromEntries(entries)

        setPreviewUrlsByPageId((current) => {
          for (const [pageId, url] of Object.entries(current)) {
            if (nextUrls[pageId] !== url) {
              releasePagePreviewUrl(url)
            }
          }

          return nextUrls
        })
        setPreviewsReady(true)
      }
    }

    renderPreviews().catch((error) => {
      if (canceled) {
        return
      }

      setPreviewError(getPreviewErrorMessage(error))
      setPreviewsReady(false)
    })

    return () => {
      canceled = true
      abortController.abort()
    }
  }, [
    dimensions.height,
    dimensions.width,
    orderedPages,
    settings.scaleMode,
    shouldWaitForManual3dLoad,
    sourceMap
  ])

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

  if (shouldWaitForManual3dLoad) {
    return (
      <section
        className="rounded-lg border bg-slate-50 p-6 text-center"
        data-book-flip-preview="manual-load"
      >
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
          <Badge variant={getPerformanceBadgeTone(performanceSettings.preset)}>
            {performanceSettings.label}
          </Badge>
          <h3 className="text-lg font-semibold text-slate-950">3D Book Preview is paused</h3>
          <p className="text-sm leading-6 text-slate-600">
            3D Book Preview may be slower on low-end PCs. This project has {orderedPages.length}{' '}
            pages, so the app will wait before rendering full-page previews.
          </p>
          <Button type="button" onClick={() => setLoad3dRequested(true)}>
            Load 3D Preview
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section
      className="rounded-lg border bg-slate-50 shadow-sm"
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
            <Badge variant={isRtl ? 'warning' : 'secondary'}>{isRtl ? 'RTL Arabic' : 'LTR'}</Badge>
            <Badge variant={getPerformanceBadgeTone(performanceSettings.preset)}>
              {performanceSettings.label}
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

      <div className="min-h-[660px] overflow-visible bg-[radial-gradient(circle_at_center,#ffffff_0%,#eef3f8_52%,#dce5ef_100%)] p-6">
        <div className="mx-auto flex w-full min-w-0 flex-col items-center justify-center gap-4">
          {!previewsReady ? (
            <div className="grid h-[560px] w-[760px] place-items-center rounded-lg border border-dashed bg-white/70 text-sm font-medium text-slate-600">
              {previewError
                ? 'Interactive book preview unavailable. Use Montage View for print accuracy.'
                : 'Preparing interactive book preview...'}
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
                      previewUrl={previewUrlsByPageId[page.id] ?? page.thumbnailUrl}
                      readingDirection={settings.readingDirection}
                      scaleMode={settings.scaleMode}
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
            {isRtl ? ' RTL Arabic mode is active.' : ''} Montage Mode remains the print-accurate
            layout.
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

function getFlipPageDimensions(
  settings: SheetSettings,
  firstPage?: BookletPage
): { width: number; height: number } {
  const ratio = getBookPageAspectRatio(settings, firstPage)
  const height = 540
  const width = Math.round(height * ratio)

  return {
    width: Math.max(260, Math.min(width, 460)),
    height
  }
}

function getPreviewPixelScale(): number {
  if (typeof window === 'undefined') {
    return 2
  }

  return Math.max(1.5, Math.min(window.devicePixelRatio || 2, 2))
}

function getPreviewErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not render 3D book previews.'
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
