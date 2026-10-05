import { useLanguage } from '@/i18n/useLanguage'
import { ArrowLeft, Palette, Trash2, ZoomIn } from 'lucide-react'
import type { ReactNode } from 'react'
import { memo, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import type {
  BookletPage,
  BookletSheet,
  BookletSide,
  BookletSlot,
  BookletSource,
  EmptySheetBoardItem,
  Rect,
  SheetBoardPosition,
  SheetBoardState,
  SheetSettings
} from '../types'
import { getBookletSlotRects, getPrintSizeMm } from '../lib/printSizes'
import { getSheetCreepMm, getSlotCreepTranslationMm } from '../lib/creepCompensation'
import { SHEET_BOARD_CARD, getBoardCanvasSize, getSideKey } from '../lib/sheetLayoutState'
import { ColorPickerPopover } from './ColorPickerPopover'
import { DraggableSheetCard } from './DraggableSheetCard'
import { EmptySheetCard } from './EmptySheetCard'
import { SheetHoverActions } from './SheetHoverActions'
import { BookletPageArtwork, PageInspectionDialog } from './PageInspectionDialog'

interface SheetPreviewProps {
  sheets: BookletSheet[]
  sources: BookletSource[]
  settings: SheetSettings
  pageCountIsValid: boolean
  selectedItemId: string | null
  inspectedItemId: string | null
  boardState: SheetBoardState
  onInspectItem: (itemId: string) => void
  onCloseInspect: () => void
  onMoveItem: (itemId: string, position: SheetBoardPosition) => void
  onDeleteItem: (itemId: string) => void
  onDuplicateItem: (itemId: string) => void
  onEmptySheetColorChange: (itemId: string, colorHex: string) => void
}

export const SheetPreview = memo(function SheetPreview({
  sheets,
  sources,
  settings,
  pageCountIsValid,
  selectedItemId,
  inspectedItemId,
  boardState,
  onInspectItem,
  onCloseInspect,
  onMoveItem,
  onDeleteItem,
  onDuplicateItem,
  onEmptySheetColorChange
}: SheetPreviewProps): JSX.Element {
  const [colorPickerItemId, setColorPickerItemId] = useState<string | null>(null)
  const sourceMap = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources])
  const sideMap = useMemo(
    () =>
      new Map(
        sheets.flatMap((sheet) => [
          [getSideKey(sheet.front), sheet.front] as const,
          [getSideKey(sheet.back), sheet.back] as const
        ])
      ),
    [sheets]
  )
  const visibleItems = useMemo(
    () =>
      boardState.items.filter((item) => item.kind === 'empty-sheet' || sideMap.has(item.sideKey)),
    [boardState.items, sideMap]
  )
  const previewLayout = useMemo(() => getPreviewLayout(settings), [settings])

  if (visibleItems.length === 0) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed bg-muted/35 p-8 text-center">
        <div className="max-w-md">
          <h3 className="text-lg font-semibold">No sheets on the board yet</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Import pages for booklet sheets or add an empty sheet as a workspace placeholder.
          </p>
          {!pageCountIsValid && (
            <p className="mt-3 text-sm font-semibold text-amber-700">
              Add blank pages before booklet preview/export.
            </p>
          )}
        </div>
      </div>
    )
  }

  const inspectedItem = inspectedItemId
    ? visibleItems.find((item) => item.id === inspectedItemId)
    : null

  if (inspectedItem) {
    if (inspectedItem.kind === 'empty-sheet') {
      return (
        <DetailedPreviewShell onClose={onCloseInspect}>
          <DetailedEmptySheetPreview
            item={inspectedItem}
            recentColors={boardState.recentColors}
            colorPickerOpen={colorPickerItemId === inspectedItem.id}
            onColorOpen={() => setColorPickerItemId(inspectedItem.id)}
            onColorClose={() => setColorPickerItemId(null)}
            onColorChange={(colorHex) => onEmptySheetColorChange(inspectedItem.id, colorHex)}
            onDelete={() => {
              onDeleteItem(inspectedItem.id)
              onCloseInspect()
            }}
          />
        </DetailedPreviewShell>
      )
    }

    const side = sideMap.get(inspectedItem.sideKey)

    return side ? (
      <DetailedPreviewShell onClose={onCloseInspect}>
        <DetailedSidePreview side={side} settings={settings} sourceMap={sourceMap} />
      </DetailedPreviewShell>
    ) : (
      <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed bg-muted/35 p-8 text-center">
        <p className="text-sm text-muted-foreground">Selected sheet is no longer available.</p>
      </div>
    )
  }

  const boardSize = getBoardCanvasSize(visibleItems)

  return (
    <div className="min-h-[440px] max-h-[calc(100vh-280px)] overflow-auto rounded-[18px] border border-border/60 bg-[linear-gradient(0deg,rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] bg-[length:24px_24px] p-4">
      <div
        className="relative"
        style={{
          minWidth: Math.max(
            boardSize.width,
            SHEET_BOARD_CARD.width + SHEET_BOARD_CARD.padding * 2
          ),
          minHeight: Math.max(boardSize.height, 560)
        }}
      >
        {visibleItems.map((item) => {
          const selected = item.id === selectedItemId || item.id === inspectedItemId

          if (item.kind === 'empty-sheet') {
            return (
              <DraggableSheetCard
                key={item.id}
                itemId={item.id}
                position={item.position}
                selected={selected}
                onSelect={() => onInspectItem(item.id)}
                onPositionChange={onMoveItem}
              >
                <EmptySheetCard
                  item={item}
                  recentColors={boardState.recentColors}
                  colorPickerOpen={colorPickerItemId === item.id}
                  onInspect={() => onInspectItem(item.id)}
                  onDelete={() => onDeleteItem(item.id)}
                  onDuplicate={() => onDuplicateItem(item.id)}
                  onToggleColorPicker={() =>
                    setColorPickerItemId((current) => (current === item.id ? null : item.id))
                  }
                  onCloseColorPicker={() => setColorPickerItemId(null)}
                  onColorChange={(colorHex) => onEmptySheetColorChange(item.id, colorHex)}
                />
              </DraggableSheetCard>
            )
          }

          const side = sideMap.get(item.sideKey)

          if (!side) {
            return null
          }

          return (
            <DraggableSheetCard
              key={item.id}
              itemId={item.id}
              position={item.position}
              selected={selected}
              onSelect={() => onInspectItem(item.id)}
              onPositionChange={onMoveItem}
            >
              <BookletSideCard
                itemId={item.id}
                side={side}
                paperSize={previewLayout.paperSize}
                slots={previewLayout.slots}
                sourceMap={sourceMap}
                settings={settings}
                onInspectItem={onInspectItem}
                onDeleteItem={onDeleteItem}
                onDuplicateItem={onDuplicateItem}
              />
            </DraggableSheetCard>
          )
        })}
      </div>
    </div>
  )
})

function DetailedPreviewShell({
  children,
  onClose
}: {
  children: ReactNode
  onClose: () => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" className="w-fit" onClick={onClose}>
        <ArrowLeft data-icon="inline-start" />
        {t('Back to Montage Board')}
      </Button>
      {children}
    </div>
  )
}

const BookletSideCard = memo(function BookletSideCard({
  itemId,
  side,
  paperSize,
  slots,
  sourceMap,
  settings,
  onInspectItem,
  onDeleteItem,
  onDuplicateItem
}: {
  itemId: string
  side: BookletSide
  paperSize: { widthMm: number; heightMm: number }
  slots: { left: Rect; right: Rect }
  sourceMap: ReadonlyMap<string, BookletSource>
  settings: SheetSettings
  onInspectItem: (itemId: string) => void
  onDeleteItem: (itemId: string) => void
  onDuplicateItem: (itemId: string) => void
}): JSX.Element {
  const creepAmountMm = getSheetCreepMm(side, settings.creep)

  return (
    <div className="relative h-[300px] rounded-md bg-card p-3">
      <SheetHoverActions
        onInspect={() => onInspectItem(itemId)}
        onDelete={() => onDeleteItem(itemId)}
        onDuplicate={() => onDuplicateItem(itemId)}
      />
      <div className="mb-2 flex items-center justify-between gap-2 pr-36">
        <span className="truncate text-sm font-semibold">
          Sheet {side.sheetNumber} {side.side === 'front' ? 'Front' : 'Back'}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {side.left.pageNumber} | {side.right.pageNumber}
          {settings.creep.enabled ? ` · ${creepAmountMm.toFixed(2)} mm` : ''}
        </span>
      </div>
      <div
        className="relative mx-auto overflow-hidden rounded-sm border bg-white shadow-sm"
        style={{
          aspectRatio: `${paperSize.widthMm} / ${paperSize.heightMm}`,
          maxHeight: 236
        }}
      >
        <PreviewSlot
          slot={side.left}
          rect={slots.left}
          paperSize={paperSize}
          source={side.left.page.sourceId ? sourceMap.get(side.left.page.sourceId) : undefined}
          scaleMode={settings.scaleMode}
          creepTranslationMm={getSlotCreepTranslationMm(side, 'left', settings.creep)}
          showCreepOverlay={settings.creep.enabled && settings.creep.showOverlay}
        />
        <PreviewSlot
          slot={side.right}
          rect={slots.right}
          paperSize={paperSize}
          source={side.right.page.sourceId ? sourceMap.get(side.right.page.sourceId) : undefined}
          scaleMode={settings.scaleMode}
          creepTranslationMm={getSlotCreepTranslationMm(side, 'right', settings.creep)}
          showCreepOverlay={settings.creep.enabled && settings.creep.showOverlay}
        />
        {settings.creep.enabled && settings.creep.showOverlay ? (
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-20 h-full border-l border-dashed border-sky-500"
            title="Saddle-stitch spine"
          />
        ) : null}
      </div>
    </div>
  )
})

function getPreviewLayout(settings: SheetSettings): {
  paperSize: { widthMm: number; heightMm: number }
  slots: { left: Rect; right: Rect }
} {
  const rawPaperSize = getPrintSizeMm(settings)
  const paperSize = {
    widthMm: Math.max(rawPaperSize.widthMm, 1),
    heightMm: Math.max(rawPaperSize.heightMm, 1)
  }
  return { paperSize, slots: getPreviewSlots(paperSize, settings) }
}

function getPreviewSlots(
  paperSize: { widthMm: number; heightMm: number },
  settings: SheetSettings
): {
  left: Rect
  right: Rect
} {
  try {
    return getBookletSlotRects(paperSize, settings.outerMarginMm, settings.pageGapMm)
  } catch {
    return {
      left: { x: 0, y: 0, width: paperSize.widthMm / 2, height: paperSize.heightMm },
      right: {
        x: paperSize.widthMm / 2,
        y: 0,
        width: paperSize.widthMm / 2,
        height: paperSize.heightMm
      }
    }
  }
}

function DetailedSidePreview({
  side,
  settings,
  sourceMap
}: {
  side: BookletSide
  settings: SheetSettings
  sourceMap: ReadonlyMap<string, BookletSource>
}): JSX.Element {
  const { t } = useLanguage()

  const rawPaperSize = getPrintSizeMm(settings)
  const paperSize = {
    widthMm: Math.max(rawPaperSize.widthMm, 1),
    heightMm: Math.max(rawPaperSize.heightMm, 1)
  }
  const slots = getPreviewSlots(paperSize, settings)
  const creepAmountMm = getSheetCreepMm(side, settings.creep)

  return (
    <div className="grid min-h-[560px] grid-cols-1 gap-4 rounded-lg border bg-slate-100/70 p-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div
        className="relative mx-auto w-full max-w-[920px] overflow-hidden rounded-sm border bg-white shadow-md"
        style={{
          aspectRatio: `${paperSize.widthMm} / ${paperSize.heightMm}`
        }}
      >
        <PreviewSlot
          slot={side.left}
          rect={slots.left}
          paperSize={paperSize}
          source={side.left.page.sourceId ? sourceMap.get(side.left.page.sourceId) : undefined}
          scaleMode={settings.scaleMode}
          creepTranslationMm={getSlotCreepTranslationMm(side, 'left', settings.creep)}
          showCreepOverlay={settings.creep.enabled && settings.creep.showOverlay}
          large
        />
        <PreviewSlot
          slot={side.right}
          rect={slots.right}
          paperSize={paperSize}
          source={side.right.page.sourceId ? sourceMap.get(side.right.page.sourceId) : undefined}
          scaleMode={settings.scaleMode}
          creepTranslationMm={getSlotCreepTranslationMm(side, 'right', settings.creep)}
          showCreepOverlay={settings.creep.enabled && settings.creep.showOverlay}
          large
        />
        {settings.creep.enabled && settings.creep.showOverlay ? (
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-20 h-full border-l-2 border-dashed border-sky-500"
            title={t('Saddle-stitch spine')}
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-3 rounded-md border bg-card p-4">
        <div>
          <p className="text-sm text-muted-foreground">{t('Selected sheet')}</p>
          <h3 className="text-lg font-semibold">
            {t('Sheet')} {side.sheetNumber} {side.side === 'front' ? t('Front') : t('Back')}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoBlock label={t('Left page')} value={side.left.pageNumber} />
          <InfoBlock label={t('Right page')} value={side.right.pageNumber} />
          <InfoBlock
            label={t('Physical sheet')}
            value={`${side.sheetNumber} / ${side.physicalSheetCount}`}
          />
          <InfoBlock label={t('Creep compensation')} value={`${creepAmountMm.toFixed(2)} mm`} />
        </div>
      </div>
    </div>
  )
}

function DetailedEmptySheetPreview({
  item,
  recentColors,
  colorPickerOpen,
  onColorOpen,
  onColorClose,
  onColorChange,
  onDelete
}: {
  item: EmptySheetBoardItem
  recentColors: string[]
  colorPickerOpen: boolean
  onColorOpen: () => void
  onColorClose: () => void
  onColorChange: (colorHex: string) => void
  onDelete: () => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <div className="grid min-h-[560px] grid-cols-1 gap-4 rounded-lg border bg-slate-100/70 p-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div
        className="relative mx-auto w-full max-w-[920px] rounded-sm border shadow-md"
        style={{
          aspectRatio: '297 / 210',
          backgroundColor: item.colorHex
        }}
      />
      <div className="relative flex flex-col gap-3 rounded-md border bg-card p-4">
        <div>
          <p className="text-sm text-muted-foreground">{t('Selected sheet')}</p>
          <h3 className="text-lg font-semibold">{t(item.label)}</h3>
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">{t('Background color')}</p>
          <p className="mt-1 text-lg font-semibold">{item.colorHex}</p>
        </div>
        <Button type="button" variant="outline" onClick={onColorOpen}>
          <Palette data-icon="inline-start" />
          {t('Color')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 data-icon="inline-start" />
          {t('Delete this empty sheet')}
        </Button>
        {colorPickerOpen && (
          <ColorPickerPopover
            colorHex={item.colorHex}
            recentColors={recentColors}
            onChange={onColorChange}
            onClose={onColorClose}
          />
        )}
      </div>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: number | string }): JSX.Element {
  const { t } = useLanguage()

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{t(label)}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function PreviewSlot({
  slot,
  rect,
  paperSize,
  source,
  scaleMode,
  creepTranslationMm = 0,
  showCreepOverlay = false,
  large = false
}: {
  slot: BookletSlot
  rect: Rect
  paperSize: { widthMm: number; heightMm: number }
  source?: BookletSource
  scaleMode: SheetSettings['scaleMode']
  creepTranslationMm?: number
  showCreepOverlay?: boolean
  large?: boolean
}): JSX.Element {
  const { t } = useLanguage()

  const page = slot.page
  const [inspectionOpen, setInspectionOpen] = useState(false)
  const style = {
    left: `${(rect.x / paperSize.widthMm) * 100}%`,
    bottom: `${(rect.y / paperSize.heightMm) * 100}%`,
    width: `${(rect.width / paperSize.widthMm) * 100}%`,
    height: `${(rect.height / paperSize.heightMm) * 100}%`
  }
  const artworkTranslationPercent =
    page.sourceType === 'blank' || !Number.isFinite(creepTranslationMm)
      ? 0
      : (creepTranslationMm / Math.max(rect.width, 1)) * 100

  return (
    <>
      <div
        data-no-drag="true"
        className="group/page absolute flex cursor-zoom-in items-center justify-center overflow-hidden border border-dashed border-slate-300 bg-slate-50 outline-none transition hover:ring-2 hover:ring-inset hover:ring-primary/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        style={style}
        role="button"
        tabIndex={0}
        title={`Double-click to inspect page ${slot.pageNumber}`}
        aria-label={`Inspect page ${slot.pageNumber}`}
        onDoubleClick={(event) => {
          event.stopPropagation()
          setInspectionOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setInspectionOpen(true)
          }
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `translateX(${artworkTranslationPercent}%)` }}
        >
          <BookletPageArtwork page={page} />
        </div>
        {showCreepOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-10 border border-rose-500/90">
            <span className="absolute bottom-1 left-1 rounded bg-rose-600/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              Trim · {Math.abs(creepTranslationMm).toFixed(2)} mm toward spine
            </span>
          </div>
        ) : null}
        <div
          className={`absolute left-2 top-2 rounded bg-white/90 px-2 py-1 font-bold shadow-sm ${large ? 'text-sm' : 'text-xs'}`}
        >
          {t('Page')} {slot.pageNumber}
        </div>
        <div className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-slate-950/75 text-white opacity-0 shadow transition-opacity group-hover/page:opacity-100 group-focus/page:opacity-100">
          <ZoomIn className="size-4" aria-hidden="true" />
        </div>
      </div>
      {inspectionOpen ? (
        <PageInspectionDialog
          page={page}
          pageNumber={slot.pageNumber}
          source={source}
          scaleMode={scaleMode}
          onClose={() => setInspectionOpen(false)}
        />
      ) : null}
    </>
  )
}
