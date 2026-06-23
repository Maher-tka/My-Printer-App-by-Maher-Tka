import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FilePlus2, FileText, GripVertical, Image, Palette, RotateCcw, Trash2 } from 'lucide-react'
import { memo, useMemo, useState, type CSSProperties } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getReadableTextColor, getSolidFillHex } from '../lib/colorUtils'
import type { BookletPage } from '../types'
import { ColorPickerPopover } from './ColorPickerPopover'

interface PageManagerProps {
  pages: BookletPage[]
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

export function PageManager({
  pages,
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
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [colorPickerPageId, setColorPickerPageId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 2 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )
  const pageIds = useMemo(() => pages.map((page) => page.id), [pages])
  const selectedPage = selectedPageId
    ? pages.find((page) => page.id === selectedPageId)
    : null
  const activePage = activePageId
    ? pages.find((page) => page.id === activePageId)
    : null
  const colorPickerPage = colorPickerPageId
    ? pages.find((page) => page.id === colorPickerPageId && page.sourceType === 'blank')
    : null

  return (
    <section className="rounded-lg border bg-card p-4" data-page-order-panel="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Page Order</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Total pages: <span className="font-semibold text-foreground">{pages.length}</span>
            {selectedPage && (
              <span className="ml-2">
                Selected: <span className="font-medium text-foreground">{getPageLabel(selectedPage)}</span>
              </span>
            )}
          </p>
        </div>
        <Badge variant={pageCountIsValid ? 'success' : 'warning'}>
          {pageCountIsValid ? 'Booklet ready' : `${blanksNeeded} blank needed`}
        </Badge>
      </div>

      {!pageCountIsValid && pages.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Booklet page count must be divisible by 4. Add blank pages before export.
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAddBlankPage(selectedPageId)}
        >
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onResetOrder('keep')}
          disabled={pages.length === 0}
        >
          <RotateCcw data-icon="inline-start" />
          Reset to Original Order
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onResetOrder('remove')}
          disabled={!pages.some((page) => page.sourceType === 'blank')}
        >
          Remove blanks + reset
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => handleDragStart(event, setActivePageId)}
        onDragEnd={(event) => {
          handleDragEnd(event, onReorderPages)
          setActivePageId(null)
        }}
        onDragCancel={() => setActivePageId(null)}
      >
        <SortableContext items={pageIds} strategy={rectSortingStrategy}>
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(154px,1fr))] gap-3">
            {pages.map((page, index) => (
              <SortablePageCard
                key={page.id}
                page={page}
                index={index}
                selected={page.id === selectedPageId}
                onSelectPage={onSelectPage}
                onDeletePage={onDeletePage}
                onToggleColorPicker={(pageId) =>
                  setColorPickerPageId((current) => (current === pageId ? null : pageId))
                }
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activePage ? <PageDragPreview page={activePage} /> : null}
        </DragOverlay>
      </DndContext>

      {colorPickerPage && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/25 p-4"
          onClick={() => setColorPickerPageId(null)}
        >
          <div className="w-[330px] max-w-[calc(100vw-2rem)]">
            <ColorPickerPopover
              colorHex={getSolidFillHex(colorPickerPage.colorHex)}
              recentColors={recentColors}
              title="Blank page fill"
              description="Solid exact RGB hex, exported at 100% opacity"
              placement="static"
              onChange={(colorHex) => onBlankPageColorChange(colorPickerPage.id, colorHex)}
              onClose={() => setColorPickerPageId(null)}
            />
          </div>
        </div>
      )}
    </section>
  )
}

const SortablePageCard = memo(function SortablePageCard({
  page,
  index,
  selected,
  onSelectPage,
  onDeletePage,
  onToggleColorPicker
}: {
  page: BookletPage
  index: number
  selected: boolean
  onSelectPage: (pageId: string) => void
  onDeletePage: (pageId: string) => void
  onToggleColorPicker: (pageId: string) => void
}): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: page.id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    willChange: 'transform',
    touchAction: 'none',
    contain: 'layout paint' as const,
    contentVisibility: isDragging ? 'visible' : 'auto',
    containIntrinsicSize: '154px 260px'
  }
  const SourceIcon = page.sourceType === 'image' ? Image : FileText
  const isBlank = page.sourceType === 'blank'

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-page-card="true"
      data-page-id={page.id}
      data-current-order={index + 1}
      className={`relative rounded-md border bg-muted/25 p-2 shadow-sm transition-[border-color,box-shadow,opacity] ${
        selected ? 'border-primary ring-2 ring-primary/20' : ''
      } ${isDragging ? 'z-20 opacity-35' : ''}`}
      onClick={() => onSelectPage(page.id)}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          data-drag-handle="true"
          className="inline-flex size-8 cursor-grab items-center justify-center rounded border bg-background text-muted-foreground active:cursor-grabbing"
          aria-label={`Drag ${getPageLabel(page)}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Badge variant="secondary">Current #{index + 1}</Badge>
        {isBlank && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            title="Blank page fill color"
            onClick={(event) => {
              event.stopPropagation()
              onToggleColorPicker(page.id)
            }}
            aria-label={`Change fill color for ${getPageLabel(page)}`}
          >
            <Palette />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={(event) => {
            event.stopPropagation()
            onDeletePage(page.id)
          }}
          aria-label={`Delete ${getPageLabel(page)}`}
        >
          <Trash2 />
        </Button>
      </div>

      <BlankOrThumbnailPreview page={page} />

      <div className="mt-2 min-w-0">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <SourceIcon className="h-3.5 w-3.5" />
          <span>{page.sourceType === 'blank' ? 'Blank' : page.sourceType.toUpperCase()}</span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold" data-page-label="true">
          {getPageLabel(page)}
        </p>
        {isBlank && (
          <p className="truncate text-xs font-medium text-muted-foreground">
            Fill: {getSolidFillHex(page.colorHex)}
          </p>
        )}
        {page.sourceFileName && page.sourceType === 'pdf' && (
          <p className="truncate text-xs text-muted-foreground">{page.sourceFileName}</p>
        )}
      </div>
    </article>
  )
})

function BlankOrThumbnailPreview({ page }: { page: BookletPage }): JSX.Element {
  const fillColor = getSolidFillHex(page.colorHex)
  const textColor = getReadableTextColor(fillColor)

  return (
    <div
      className="aspect-[3/4] overflow-hidden rounded-md border bg-white"
      style={page.sourceType === 'blank' ? { backgroundColor: fillColor } : undefined}
    >
      {page.thumbnailUrl ? (
        <img
          src={page.thumbnailUrl}
          alt={page.displayName}
          className="h-full w-full object-contain"
          draggable={false}
        />
      ) : (
        <div
          className="grid h-full place-items-center text-sm font-semibold"
          style={page.sourceType === 'blank' ? { color: textColor } : undefined}
        >
          Blank
        </div>
      )}
    </div>
  )
}

function PageDragPreview({ page }: { page: BookletPage }): JSX.Element {
  const SourceIcon = page.sourceType === 'image' ? Image : FileText

  return (
    <div className="w-[154px] rounded-md border border-primary bg-card p-2 shadow-2xl ring-2 ring-primary/15">
      <BlankOrThumbnailPreview page={page} />
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <SourceIcon className="h-3.5 w-3.5" />
        <span className="truncate font-semibold text-foreground">{getPageLabel(page)}</span>
      </div>
    </div>
  )
}

function handleDragStart(
  event: DragStartEvent,
  setActivePageId: (pageId: string | null) => void
): void {
  setActivePageId(String(event.active.id))
}

function handleDragEnd(
  event: DragEndEvent,
  onReorderPages: (activeId: string, overId: string | null) => void
): void {
  onReorderPages(String(event.active.id), event.over ? String(event.over.id) : null)
}

function getPageLabel(page: BookletPage): string {
  if (page.sourceType === 'pdf') {
    return `PDF Page ${page.originalPageNumber ?? page.sourcePageIndex ?? page.currentOrderIndex + 1}`
  }

  if (page.sourceType === 'image') {
    return page.sourceFileName ?? page.displayName
  }

  return page.label || 'Blank Page'
}
