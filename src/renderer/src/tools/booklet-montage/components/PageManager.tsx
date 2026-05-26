import { ArrowDown, ArrowUp, FilePlus2, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BookletPage } from '../types'

interface PageManagerProps {
  pages: BookletPage[]
  blanksNeeded: number
  pageCountIsValid: boolean
  onAddBlankPage: () => void
  onAutoAddBlankPages: () => void
  onMovePage: (pageId: string, direction: -1 | 1) => void
  onDeletePage: (pageId: string) => void
}

export function PageManager({
  pages,
  blanksNeeded,
  pageCountIsValid,
  onAddBlankPage,
  onAutoAddBlankPages,
  onMovePage,
  onDeletePage
}: PageManagerProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Page Manager</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Total pages: <span className="font-semibold text-foreground">{pages.length}</span>
          </p>
        </div>
        <Badge variant={pageCountIsValid ? 'success' : 'warning'}>
          {pageCountIsValid ? 'Booklet ready' : `${blanksNeeded} blank needed`}
        </Badge>
      </div>

      {!pageCountIsValid && pages.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Booklet page count must be divisible by 4. Add blank pages before export.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onAddBlankPage}>
          <FilePlus2 data-icon="inline-start" />
          Add Blank Page
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onAutoAddBlankPages}
          disabled={blanksNeeded === 0}
        >
          Auto add blank pages
        </Button>
      </div>

      <div className="grid max-h-[540px] grid-cols-2 gap-3 overflow-auto pr-1 xl:grid-cols-1 2xl:grid-cols-2">
        {pages.map((page, index) => (
          <article key={page.id} className="rounded-md border bg-muted/30 p-3">
            <div className="aspect-[3/4] overflow-hidden rounded-md border bg-white">
              {page.thumbnailUrl ? (
                <img
                  src={page.thumbnailUrl}
                  alt={page.displayName}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="grid h-full place-items-center text-sm font-semibold text-muted-foreground">
                  Blank
                </div>
              )}
            </div>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Page {index + 1}</p>
                <p className="truncate text-xs text-muted-foreground">{page.displayName}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === 0}
                  onClick={() => onMovePage(page.id, -1)}
                  aria-label={`Move page ${index + 1} up`}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === pages.length - 1}
                  onClick={() => onMovePage(page.id, 1)}
                  aria-label={`Move page ${index + 1} down`}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => onDeletePage(page.id)}
                  aria-label={`Delete page ${index + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
