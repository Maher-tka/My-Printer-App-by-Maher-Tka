import { useLanguage } from '@/i18n/useLanguage'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileText,
  GripVertical,
  Palette,
  RotateCcw,
  Trash2
} from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/ui/action-button'
import { releasePagePreviewUrl, renderPagePreview } from '../lib/pagePreviewRenderer'
import { cn } from '@/lib/utils'
import { getReadableTextColor, getSolidFillHex } from '../lib/colorUtils'
import type { BookletPage, BookletSource, SheetSettings } from '../types'
import { ColorPickerPopover } from './ColorPickerPopover'
import { PageInspectionDialog } from './PageInspectionDialog'

interface PageManagerProps {
  isBusy?: boolean
  pages: BookletPage[]
  sources: BookletSource[]
  scaleMode: SheetSettings['scaleMode']
  selectedPageId: string | null
  blanksNeeded: number
  pageCountIsValid: boolean
  recentColors: string[]
  onSelectPage: (pageId: string) => void
  onAddBlankPage: (afterPageId?: string | null) => void
  onAutoAddBlankPages: () => void
  onReorderPages: (activeId: string, overId: string | null) => void
  onResetOrder: (blankMode: 'keep' | 'remove') => void
  onDeletePage: (pageId: string) => void
  onBlankPageColorChange: (pageId: string, colorHex: string) => void
}

export const PageManager = memo(function PageManager({
  isBusy = false,
  pages,
  sources,
  scaleMode,
  selectedPageId,
  blanksNeeded,
  pageCountIsValid,
  recentColors,
  onSelectPage,
  onAddBlankPage,
  onAutoAddBlankPages,
  onReorderPages,
  onResetOrder,
  onDeletePage,
  onBlankPageColorChange
}: PageManagerProps): JSX.Element {
  const { t } = useLanguage()
  const scrollRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDetailsElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  const selectedIndex = Math.max(
    0,
    pages.findIndex((page) => page.id === selectedPageId)
  )
  const [pageDraft, setPageDraft] = useState(String(selectedIndex + 1))
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [colorPickerPageId, setColorPickerPageId] = useState<string | null>(null)
  const [inspectedPage, setInspectedPage] = useState<{
    page: BookletPage
    pageNumber: number
  } | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const pageIds = useMemo(() => pages.map((page) => page.id), [pages])
  const sourceMap = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources])
  const activePage = pages.find((page) => page.id === activePageId)
  const colorPickerPage = pages.find(
    (page) => page.id === colorPickerPageId && page.sourceType === 'blank'
  )
  useEffect(() => {
    if (inspectedPage && !pages.some((page) => page.id === inspectedPage.page.id))
      setInspectedPage(null)
  }, [inspectedPage, pages])
  useEffect(() => {
    setPageDraft(String(selectedIndex + 1))
    if (activePageId || expanded) return
    const viewport = scrollRef.current
    const selected = viewport?.querySelector<HTMLElement>('[data-page-id="' + selectedPageId + '"]')
    if (!viewport || !selected) return
    const bounds = viewport.getBoundingClientRect()
    const item = selected.getBoundingClientRect()
    if (item.left < bounds.left) viewport.scrollLeft += item.left - bounds.left
    else if (item.right > bounds.right) viewport.scrollLeft += item.right - bounds.right
  }, [activePageId, expanded, selectedIndex, selectedPageId, pages.length])
  useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport) return
    const onWheel = (event: WheelEvent): void => {
      if (expanded || event.ctrlKey || event.shiftKey || event.deltaX || !event.deltaY) return
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientWidth : 1)
      const before = viewport.scrollLeft
      viewport.scrollLeft += delta
      if (viewport.scrollLeft !== before) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [expanded])
  const focusPage = (id: string): void => {
    requestAnimationFrame(() =>
      scrollRef.current
        ?.querySelector<HTMLElement>('[data-page-id="' + id + '"] [data-page-select]')
        ?.focus({ preventScroll: !expanded })
    )
  }
  const selectIndex = (index: number, focus = false): void => {
    const page = pages[Math.max(0, Math.min(pages.length - 1, index))]
    if (!page || isBusy) return
    onSelectPage(page.id)
    if (focus) focusPage(page.id)
  }
  const jump = (): void => {
    const value = Number(pageDraft)
    if (Number.isInteger(value) && value >= 1 && value <= pages.length) selectIndex(value - 1)
    else setPageDraft(String(selectedIndex + 1))
  }
  const deletePage = (id: string): void => {
    if (isBusy) return
    const index = pages.findIndex((page) => page.id === id)
    const next = pages[index + 1] ?? pages[index - 1]
    onDeletePage(id)
    if (id === selectedPageId && next) onSelectPage(next.id)
    const focusId = id === selectedPageId ? next?.id : selectedPageId
    if (focusId) focusPage(focusId)
  }
  const resetOrder = (mode: 'keep' | 'remove'): void => {
    onResetOrder(mode)
    menuRef.current?.removeAttribute('open')
    menuRef.current?.querySelector('summary')?.focus({ preventScroll: true })
  }
  return (
    <section
      aria-label={t('Booklet pages')}
      data-page-order-panel="true"
      data-page-carousel-expanded={expanded}
      className="min-w-0 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t('Pages')}</h3>
          <output
            aria-label={t('Selected page')}
            className="text-xs tabular-nums text-muted-foreground"
          >
            {pages.length ? selectedIndex + 1 : 0} / {pages.length}
          </output>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            ref={expandRef}
            action={expanded ? 'collapse' : 'expand'}
            size="sm"
            disabled={isBusy || !pages.length}
            aria-expanded={expanded}
            aria-controls="booklet-page-thumbnails"
            onClick={() => {
              setExpanded((current) => !current)
              if (scrollRef.current) scrollRef.current.scrollLeft = 0
            }}
          >
            {t(expanded ? 'Collapse pages' : 'Expand pages')}
          </ActionButton>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={t('Previous page')}
            disabled={isBusy || !pages.length || selectedIndex === 0}
            onClick={() => selectIndex(selectedIndex - 1)}
          >
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <input
            type="number"
            min={1}
            max={pages.length}
            aria-label={t('Jump to page')}
            disabled={isBusy || !pages.length}
            value={pages.length ? pageDraft : ''}
            className="h-[var(--ui-control-compact)] w-16 rounded-[var(--ui-radius-md)] border border-input bg-background px-2 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => setPageDraft(event.target.value)}
            onBlur={jump}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                jump()
              }
            }}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={t('Next page')}
            disabled={isBusy || !pages.length || selectedIndex === pages.length - 1}
            onClick={() => selectIndex(selectedIndex + 1)}
          >
            <ChevronRight className="rtl:rotate-180" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => onAddBlankPage(selectedPageId)}
          >
            <FilePlus2 />
            {t('Add blank page')}
          </Button>
          {blanksNeeded > 0 && (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isBusy}
              onClick={onAutoAddBlankPages}
            >
              {t('Auto blanks')}
            </Button>
          )}
          <details ref={menuRef} className="relative">
            <summary className="flex h-[var(--ui-control-compact)] cursor-pointer items-center rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-background px-3 text-xs font-medium">
              {t('Page actions')}
            </summary>
            <div className="absolute end-0 top-full z-[var(--ui-z-overlay)] mt-2 flex w-56 flex-col gap-2 rounded-[var(--ui-radius-lg)] border bg-popover p-3 shadow-elevated">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy || !pages.length}
                onClick={() => resetOrder('keep')}
              >
                <RotateCcw />
                {t('Reset to original order')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBusy || !pages.some((page) => page.sourceType === 'blank')}
                onClick={() => resetOrder('remove')}
              >
                {t('Remove blanks and reset')}
              </Button>
            </div>
          </details>
        </div>
      </div>
      {!pageCountIsValid && pages.length > 0 && (
        <p
          role="alert"
          className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {t('Booklet page count must be divisible by 4. Add blank pages before export.')}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => setActivePageId(String(event.active.id))}
        onDragEnd={(event) => {
          onReorderPages(String(event.active.id), event.over ? String(event.over.id) : null)
          setActivePageId(null)
        }}
        onDragCancel={() => setActivePageId(null)}
      >
        <SortableContext
          items={pageIds}
          strategy={expanded ? rectSortingStrategy : horizontalListSortingStrategy}
        >
          <div
            ref={scrollRef}
            id="booklet-page-thumbnails"
            data-page-thumbnails="true"
            dir="ltr"
            aria-label={t('Page thumbnails')}
            tabIndex={0}
            className={cn(
              'mt-3 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              expanded ? 'overflow-visible' : 'overflow-x-auto overflow-y-hidden'
            )}
            onKeyDown={(event) => {
              if (
                event.defaultPrevented ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                (event.target instanceof HTMLElement && event.target.closest('[data-drag-handle]'))
              )
                return
              if (expanded && event.key === 'Escape') {
                event.preventDefault()
                setExpanded(false)
                expandRef.current?.focus({ preventScroll: true })
                return
              }
              const columns = Math.max(
                1,
                Math.floor(((scrollRef.current?.clientWidth ?? 128) + 8) / 136)
              )
              const index =
                event.key === 'ArrowRight'
                  ? selectedIndex + 1
                  : event.key === 'ArrowLeft'
                    ? selectedIndex - 1
                    : expanded && event.key === 'ArrowDown'
                      ? selectedIndex + columns
                      : expanded && event.key === 'ArrowUp'
                        ? selectedIndex - columns
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? pages.length - 1
                            : undefined
              if (index !== undefined) {
                event.preventDefault()
                selectIndex(index, true)
              }
            }}
          >
            <div
              className={
                expanded
                  ? 'grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-2'
                  : 'flex w-max min-w-full gap-2'
              }
            >
              {pages.map((page, index) => (
                <SortablePageCard
                  key={page.id}
                  page={page}
                  index={index}
                  selected={page.id === selectedPageId}
                  isBusy={isBusy}
                  expanded={expanded}
                  source={page.sourceId ? sourceMap.get(page.sourceId) : undefined}
                  onSelect={() => onSelectPage(page.id)}
                  onDelete={() => deletePage(page.id)}
                  onColor={() => setColorPickerPageId(page.id)}
                  onInspect={() => setInspectedPage({ page, pageNumber: index + 1 })}
                />
              ))}
            </div>
            {!pages.length && (
              <p className="py-2 text-xs text-muted-foreground">{t('No pages loaded')}</p>
            )}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activePage && (
            <div className="w-32 rounded-[var(--ui-radius-md)] border border-primary bg-card p-2 shadow-elevated">
              <Thumbnail page={activePage} label={t('Page')} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {colorPickerPage && (
        <div
          className="fixed inset-0 z-[var(--ui-z-overlay)] grid place-items-center bg-slate-950/25 p-4"
          onClick={() => setColorPickerPageId(null)}
        >
          <div className="w-[330px] max-w-[calc(100vw-2rem)]">
            <ColorPickerPopover
              colorHex={getSolidFillHex(colorPickerPage.colorHex)}
              recentColors={recentColors}
              title={t('Blank page fill')}
              description="Solid exact RGB hex, exported at 100% opacity"
              placement="static"
              onChange={(colorHex) => onBlankPageColorChange(colorPickerPage.id, colorHex)}
              onClose={() => setColorPickerPageId(null)}
            />
          </div>
        </div>
      )}
      {inspectedPage && (
        <PageInspectionDialog
          page={inspectedPage.page}
          pageNumber={inspectedPage.pageNumber}
          source={
            inspectedPage.page.sourceId ? sourceMap.get(inspectedPage.page.sourceId) : undefined
          }
          scaleMode={scaleMode}
          onClose={() => setInspectedPage(null)}
        />
      )}
    </section>
  )
})

const SortablePageCard = memo(function SortablePageCard({
  page,
  index,
  selected,
  isBusy,
  expanded,
  source,
  onSelect,
  onDelete,
  onColor,
  onInspect
}: {
  page: BookletPage
  index: number
  selected: boolean
  isBusy: boolean
  expanded: boolean
  source?: BookletSource
  onSelect: () => void
  onDelete: () => void
  onColor: () => void
  onInspect: () => void
}): JSX.Element {
  const { t } = useLanguage()
  const label = t('Page') + ' ' + (index + 1)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
    disabled: isBusy
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    willChange: isDragging ? 'transform' : undefined,
    contain: 'layout paint',
    contentVisibility: isDragging ? 'visible' : 'auto',
    containIntrinsicSize: '128px 202px'
  }
  return (
    <article
      ref={setNodeRef}
      style={style}
      data-page-card="true"
      data-page-id={page.id}
      data-current-order={index + 1}
      className={cn(
        'relative min-w-0 shrink-0 rounded-[var(--ui-radius-md)] border bg-muted/25 p-2',
        expanded ? 'w-full' : 'w-32',
        selected && 'border-primary ring-2 ring-primary/20',
        isDragging && 'z-20 opacity-35'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant="toolbar"
          data-drag-handle="true"
          className="cursor-grab active:cursor-grabbing"
          aria-label={t('Reorder page') + ' ' + (index + 1)}
          disabled={isBusy}
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </Button>
        <span className="text-xs font-semibold tabular-nums" data-page-label="true">
          {index + 1}
        </span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t('Delete page') + ' ' + (index + 1)}
          disabled={isBusy}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="relative">
        <div
          role="button"
          aria-label={t('Select page') + ' ' + (index + 1)}
          aria-pressed={selected}
          aria-disabled={isBusy}
          tabIndex={isBusy ? -1 : 0}
          data-page-select="true"
          className="cursor-pointer rounded-[var(--ui-radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={t('Double-click to inspect page')}
          onClick={() => {
            if (!isBusy) onSelect()
          }}
          onDoubleClick={() => {
            if (!isBusy) onInspect()
          }}
          onKeyDown={(event) => {
            if (isBusy || (event.key !== 'Enter' && event.key !== ' ')) return
            event.preventDefault()
            if (event.ctrlKey || event.metaKey) onInspect()
            else onSelect()
          }}
        >
          <Thumbnail page={page} label={label} source={source} />
        </div>
        {page.sourceType === 'blank' && (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="absolute bottom-1 end-1"
            disabled={isBusy}
            aria-label={t('Change page color') + ' ' + (index + 1)}
            onClick={onColor}
          >
            <Palette />
          </Button>
        )}
      </div>
    </article>
  )
})

function Thumbnail({
  page,
  label,
  source
}: {
  page: BookletPage
  label: string
  source?: BookletSource
}): JSX.Element {
  const { t } = useLanguage()
  const ref = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState(page.thumbnailUrl)
  useEffect(() => {
    setUrl(page.thumbnailUrl)
    if (page.thumbnailUrl || page.sourceType === 'blank' || !source || !ref.current) return
    const controller = new AbortController()
    let active = true
    let rendered: string | undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        void renderPagePreview(page, source, {
          quality: 'thumbnail',
          scaleMode: 'fit',
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
          .catch(() => {})
      },
      { rootMargin: '96px' }
    )
    observer.observe(ref.current)
    return () => {
      active = false
      controller.abort()
      observer.disconnect()
      if (rendered) releasePagePreviewUrl(rendered)
    }
  }, [page.id, page.thumbnailUrl, page.sourcePageIndex, source])
  const fill = getSolidFillHex(page.colorHex)
  return (
    <div
      ref={ref}
      className="relative grid h-36 place-items-center overflow-hidden rounded-[var(--ui-radius-sm)] border bg-white"
      style={
        page.sourceType === 'blank'
          ? { backgroundColor: fill, color: getReadableTextColor(fill) }
          : undefined
      }
    >
      {url ? (
        <img
          src={url}
          alt={label}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain p-1"
        />
      ) : page.sourceType === 'blank' ? (
        <span className="text-xs font-medium">{t('Blank')}</span>
      ) : (
        <FileText className="size-5 text-muted-foreground" />
      )}
    </div>
  )
}
