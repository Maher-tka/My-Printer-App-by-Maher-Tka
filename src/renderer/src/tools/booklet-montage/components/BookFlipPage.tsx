import { forwardRef, memo, useEffect, useState } from 'react'
import type { BookletPage, BookletReadingDirection } from '../types'

interface BookFlipPageProps {
  page: BookletPage
  pageNumber: number
  readingDirection: BookletReadingDirection
  width: number
  height: number
}

const BookFlipPageBase = forwardRef<HTMLDivElement, BookFlipPageProps>(
  function BookFlipPageBase({
    page,
    pageNumber,
    readingDirection,
    width,
    height
  }, ref): JSX.Element {
    const [imageState, setImageState] = useState<'idle' | 'loading' | 'loaded' | 'failed'>(
      page.thumbnailUrl ? 'loading' : 'idle'
    )
    const isBlank = page.sourceType === 'blank'
    const pageLabel = getBookFlipPageLabel(page, pageNumber)

    useEffect(() => {
      setImageState(page.thumbnailUrl ? 'loading' : 'idle')
    }, [page.id, page.thumbnailUrl])

    return (
      <div
        ref={ref}
        className="book-flip-page relative overflow-hidden bg-white text-slate-950 shadow-sm"
        style={{ width, height }}
        data-book-flip-page="true"
        data-page-id={page.id}
        data-page-label={pageLabel}
        data-page-number={pageNumber}
        data-source-type={page.sourceType}
      >
        <div
          className="relative h-full w-full"
          style={{ transform: readingDirection === 'rtl' ? 'scaleX(-1)' : undefined }}
        >
          <div className="relative flex h-full w-full items-center justify-center bg-white">
            {isBlank ? (
              <div className="grid h-full w-full place-items-center bg-white text-sm font-semibold text-slate-400">
                Blank Page
              </div>
            ) : page.thumbnailUrl ? (
              <>
                {imageState === 'loading' && (
                  <div className="absolute inset-0 grid place-items-center bg-slate-50 text-sm text-slate-500">
                    Loading page...
                  </div>
                )}
                {imageState === 'failed' ? (
                  <div className="grid h-full w-full place-items-center bg-red-50 px-6 text-center text-sm font-medium text-red-700">
                    Page preview failed
                  </div>
                ) : (
                  <img
                    src={page.thumbnailUrl}
                    alt={pageLabel}
                    className={`h-full w-full object-cover transition-opacity ${
                      imageState === 'loaded' ? 'opacity-100' : 'opacity-0'
                    }`}
                    draggable={false}
                    onLoad={() => setImageState('loaded')}
                    onError={() => setImageState('failed')}
                  />
                )}
              </>
            ) : (
              <div className="grid h-full w-full place-items-center bg-slate-50 px-6 text-center text-sm font-semibold text-slate-500">
                Preview image unavailable
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute bottom-2 right-2 z-20 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur">
            #{pageNumber}
          </div>
        </div>
      </div>
    )
  }
)

BookFlipPageBase.displayName = 'BookFlipPage'

export const BookFlipPage = memo(BookFlipPageBase)

function getBookFlipPageLabel(page: BookletPage, pageNumber: number): string {
  if (page.sourceType === 'pdf') {
    return `PDF Page ${page.originalPageNumber ?? pageNumber}`
  }

  if (page.sourceType === 'image') {
    return page.sourceFileName ?? page.displayName
  }

  return page.label || 'Blank Page'
}
