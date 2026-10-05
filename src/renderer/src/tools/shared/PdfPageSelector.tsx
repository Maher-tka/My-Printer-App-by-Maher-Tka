import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { useLanguage } from '@/i18n/useLanguage'
import { Button } from '@/components/ui/button'

export interface PdfPageThumbnail {
  pageNumber: number
  thumbnailDataUrl: string
}

export function PdfPageSelector({
  title,
  pageCount,
  selectedPageNumber,
  selectedLabel,
  previews = [],
  disabled = false,
  itemLabel = 'Page',
  showScrollButtons = true,
  onSelect,
  onLoadMore
}: {
  title: string
  pageCount: number
  selectedPageNumber: number
  selectedLabel: string
  previews?: PdfPageThumbnail[]
  disabled?: boolean
  itemLabel?: 'Page' | 'Artboard'
  showScrollButtons?: boolean
  onSelect: (page: number) => void
  onLoadMore?: (start: number) => void
}): JSX.Element {
  const { t } = useLanguage()
  const [pageDraft, setPageDraft] = useState(String(selectedPageNumber))
  const scrollRef = useRef<HTMLDivElement>(null)
  const sorted = [...previews].sort((a, b) => a.pageNumber - b.pageNumber)
  const loaded = new Set(sorted.map((page) => page.pageNumber))
  let missing: number | undefined
  for (let page = 1; page <= pageCount; page++)
    if (!loaded.has(page)) {
      missing = page
      break
    }
  const items = loaded.has(selectedPageNumber)
    ? sorted
    : [...sorted, { pageNumber: selectedPageNumber, thumbnailDataUrl: '' }].sort(
        (a, b) => a.pageNumber - b.pageNumber
      )

  useEffect(() => {
    setPageDraft(String(selectedPageNumber))
  }, [selectedPageNumber])
  useEffect(() => {
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="${selectedPageNumber}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [previews.length, selectedPageNumber])
  const commit = () => {
    const page = Number(pageDraft)
    if (Number.isInteger(page) && page >= 1 && page <= pageCount) {
      if (page !== selectedPageNumber) onSelect(page)
    } else setPageDraft(String(selectedPageNumber))
  }
  const scroll = (delta: number) => scrollRef.current?.scrollBy({ left: delta, behavior: 'auto' })
  const jumpLabel = t(itemLabel === 'Artboard' ? 'Jump to artboard' : 'Jump to page')
  return (
    <div className="min-w-0 space-y-3" role="group" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">{title}</p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t(itemLabel)} {selectedPageNumber} / {pageCount}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2">
        <Button
          size="icon"
          variant="outline"
          aria-label={`${title}: ${t(itemLabel === 'Artboard' ? 'Previous artboard' : 'Previous page')}`}
          disabled={disabled || selectedPageNumber <= 1}
          onClick={() => onSelect(selectedPageNumber - 1)}
        >
          <ChevronLeft className="rtl:rotate-180" />
        </Button>
        <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
          {jumpLabel}
          <input
            type="number"
            aria-label={`${title}: ${jumpLabel}`}
            min={1}
            max={pageCount}
            value={pageDraft}
            disabled={disabled}
            className="h-[var(--ui-control-standard)] w-full rounded-[var(--ui-radius-md)] border border-input bg-background px-3 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => setPageDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
          />
        </label>
        <Button
          size="icon"
          variant="outline"
          aria-label={`${title}: ${t(itemLabel === 'Artboard' ? 'Next artboard' : 'Next page')}`}
          disabled={disabled || selectedPageNumber >= pageCount}
          onClick={() => onSelect(selectedPageNumber + 1)}
        >
          <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>
      <div className="flex min-w-0 items-stretch gap-2" dir="ltr">
        {showScrollButtons && (
          <Button
            size="icon"
            variant="outline"
            aria-label={`${title}: ${t('Scroll thumbnails left')}`}
            disabled={disabled}
            onClick={() => scroll(-200)}
          >
            <ChevronLeft />
          </Button>
        )}
        <div
          ref={scrollRef}
          className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-2"
          tabIndex={0}
          aria-label={`${title}: ${t('Page thumbnails')}`}
        >
          <div className="flex w-max gap-2">
            {items.map((page) => (
              <Button
                key={page.pageNumber}
                size="sm"
                variant={page.pageNumber === selectedPageNumber ? 'selected' : 'outline'}
                className="h-auto w-24 shrink-0 flex-col gap-1 p-2"
                data-page-number={page.pageNumber}
                aria-label={`${title}: ${t(itemLabel)} ${page.pageNumber}`}
                aria-pressed={page.pageNumber === selectedPageNumber}
                disabled={disabled}
                onClick={() => onSelect(page.pageNumber)}
              >
                <span className="flex h-20 w-full items-center justify-center overflow-hidden rounded-[var(--ui-radius-sm)] bg-muted">
                  {page.thumbnailDataUrl ? (
                    <img
                      src={page.thumbnailDataUrl}
                      alt={`${t(itemLabel)} ${page.pageNumber}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <FileText className="size-5 text-muted-foreground" />
                  )}
                </span>
                <span className="text-xs">
                  {t(itemLabel)} {page.pageNumber}
                </span>
                {page.pageNumber === selectedPageNumber && (
                  <span className="flex max-w-full items-center gap-1 whitespace-normal text-xs">
                    <Check className="size-3 shrink-0" />
                    {t(selectedLabel)}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
        {showScrollButtons && (
          <Button
            size="icon"
            variant="outline"
            aria-label={`${title}: ${t('Scroll thumbnails right')}`}
            disabled={disabled}
            onClick={() => scroll(200)}
          >
            <ChevronRight />
          </Button>
        )}
      </div>
      {missing && onLoadMore && (
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onLoadMore(missing!)}
        >
          {t('Load more pages')}
        </Button>
      )}
    </div>
  )
}
