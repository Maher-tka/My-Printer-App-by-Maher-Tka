import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useLanguage } from '@/i18n/useLanguage'
import type { BookletPage, BookletSource, BookletScaleMode } from '../types'
import { getSolidFillHex } from '../lib/colorUtils'
import { releasePagePreviewUrl, renderPagePreview } from '../lib/pagePreviewRenderer'

export function BookletPagePreview({
  page,
  pageNumber,
  source,
  scaleMode
}: {
  page: BookletPage
  pageNumber: number
  source?: BookletSource
  scaleMode: BookletScaleMode
}): JSX.Element {
  const { t } = useLanguage()
  const [url, setUrl] = useState(page.thumbnailUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setUrl(page.thumbnailUrl)
    setError(null)
    if (page.sourceType === 'blank' || !source) {
      setLoading(false)
      return
    }
    let active = true
    let rendered: string | undefined
    const controller = new AbortController()
    setLoading(true)
    void renderPagePreview(page, source, {
      quality: 'medium',
      scaleMode,
      signal: controller.signal
    })
      .then((result) => {
        if (!active) {
          releasePagePreviewUrl(result)
          return
        }
        rendered = result
        setUrl(result)
      })
      .catch((cause: unknown) => {
        if (active && !controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Could not render this page.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
      if (rendered) releasePagePreviewUrl(rendered)
    }
  }, [
    page.id,
    page.sourcePageIndex,
    page.thumbnailUrl,
    page.colorHex,
    page.widthMm,
    page.heightMm,
    page.sourceType,
    source,
    scaleMode
  ])
  return (
    <figure
      className="flex h-full max-w-full flex-col items-center justify-center gap-2"
      data-booklet-page-preview={pageNumber}
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <div className="relative min-h-0 flex-1">
          {page.sourceType === 'blank' ? (
            <div
              role="img"
              aria-label={t('Blank page')}
              className="h-full max-w-full rounded-sm border shadow-sm"
              style={{
                aspectRatio: page.widthMm / page.heightMm,
                backgroundColor: getSolidFillHex(page.colorHex)
              }}
            />
          ) : url ? (
            <img
              src={url}
              alt={t('Page') + ' ' + pageNumber}
              className="h-full max-w-full rounded-sm bg-white object-contain shadow-sm"
            />
          ) : (
            <div className="grid h-full w-56 max-w-full place-items-center rounded-sm border bg-background text-sm text-muted-foreground">
              {t('Loading page…')}
            </div>
          )}
          {loading && url && (
            <span
              role="status"
              aria-label={t('Loading page…')}
              className="absolute bottom-2 end-2 rounded-full bg-background/90 p-1"
            >
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            </span>
          )}
        </div>
      )}
      <figcaption className="shrink-0 text-xs text-muted-foreground">
        {t('Page')} {pageNumber} · {page.widthMm.toFixed(1)} × {page.heightMm.toFixed(1)} mm
      </figcaption>
    </figure>
  )
}
