import { ArrowLeft, Palette } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type {
  BookletPage,
  BookletSheet,
  BookletSide,
  BookletSlot,
  EmptySheetBoardItem,
  Rect,
  SheetBoardPosition,
  SheetBoardState,
  SheetSettings
} from '../types'
import { getBookletSlotRects, getPrintSizeMm } from '../lib/printSizes'
import { SHEET_BOARD_CARD, getBoardCanvasSize, getSideKey } from '../lib/sheetLayoutState'
import { getReadableTextColor, getSolidFillHex } from '../lib/colorUtils'
import { ColorPickerPopover } from './ColorPickerPopover'
import { DraggableSheetCard } from './DraggableSheetCard'
import { EmptySheetCard } from './EmptySheetCard'
import { SheetHoverActions } from './SheetHoverActions'

interface SheetPreviewProps {
  sheets: BookletSheet[]
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

export function SheetPreview({
  sheets,
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
  const sideMap = new Map(
    sheets.flatMap((sheet) => [
      [getSideKey(sheet.front), sheet.front] as const,
      [getSideKey(sheet.back), sheet.back] as const
    ])
  )
  const visibleItems = boardState.items.filter(
    (item) => item.kind === 'empty-sheet' || sideMap.has(item.sideKey)
  )

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
          />
        </DetailedPreviewShell>
      )
    }

    const side = sideMap.get(inspectedItem.sideKey)

    return side ? (
      <DetailedPreviewShell onClose={onCloseInspect}>
        <DetailedSidePreview side={side} settings={settings} />
      </DetailedPreviewShell>
    ) : (
      <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed bg-muted/35 p-8 text-center">
        <p className="text-sm text-muted-foreground">Selected sheet is no longer available.</p>
      </div>
    )
  }

  const boardSize = getBoardCanvasSize(visibleItems)

  return (
    <div className="min-h-[620px] overflow-visible rounded-lg border bg-[linear-gradient(0deg,rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] bg-[length:24px_24px] p-4">
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
                side={side}
                settings={settings}
                onInspect={() => onInspectItem(item.id)}
                onDelete={() => onDeleteItem(item.id)}
                onDuplicate={() => onDuplicateItem(item.id)}
              />
            </DraggableSheetCard>
          )
        })}
      </div>
    </div>
  )
}

function DetailedPreviewShell({
  children,
  onClose
}: {
  children: ReactNode
  onClose: () => void
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" className="w-fit" onClick={onClose}>
        <ArrowLeft data-icon="inline-start" />
        Back to Montage Board
      </Button>
      {children}
    </div>
  )
}

function BookletSideCard({
  side,
  settings,
  onInspect,
  onDelete,
  onDuplicate
}: {
  side: BookletSide
  settings: SheetSettings
  onInspect: () => void
  onDelete: () => void
  onDuplicate: () => void
}): JSX.Element {
  const rawPaperSize = getPrintSizeMm(settings)
  const paperSize = {
    widthMm: Math.max(rawPaperSize.widthMm, 1),
    heightMm: Math.max(rawPaperSize.heightMm, 1)
  }
  const slots = getPreviewSlots(paperSize)

  return (
    <div className="relative h-[300px] rounded-md bg-card p-3">
      <SheetHoverActions onInspect={onInspect} onDelete={onDelete} onDuplicate={onDuplicate} />
      <div className="mb-2 flex items-center justify-between gap-2 pr-36">
        <span className="truncate text-sm font-semibold">
          Sheet {side.sheetNumber} {side.side === 'front' ? 'Front' : 'Back'}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {side.left.pageNumber} | {side.right.pageNumber}
        </span>
      </div>
      <div
        className="relative mx-auto overflow-hidden rounded-sm border bg-white shadow-sm"
        style={{
          aspectRatio: `${paperSize.widthMm} / ${paperSize.heightMm}`,
          maxHeight: 236
        }}
      >
        <PreviewSlot slot={side.left} rect={slots.left} paperSize={paperSize} />
        <PreviewSlot slot={side.right} rect={slots.right} paperSize={paperSize} />
      </div>
    </div>
  )
}

function getPreviewSlots(paperSize: { widthMm: number; heightMm: number }): {
  left: Rect
  right: Rect
} {
  try {
    return getBookletSlotRects(paperSize)
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
  settings
}: {
  side: BookletSide
  settings: SheetSettings
}): JSX.Element {
  const rawPaperSize = getPrintSizeMm(settings)
  const paperSize = {
    widthMm: Math.max(rawPaperSize.widthMm, 1),
    heightMm: Math.max(rawPaperSize.heightMm, 1)
  }
  const slots = getPreviewSlots(paperSize)

  return (
    <div className="grid min-h-[560px] grid-cols-1 gap-4 rounded-lg border bg-slate-100/70 p-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div
        className="relative mx-auto w-full max-w-[920px] overflow-hidden rounded-sm border bg-white shadow-md"
        style={{
          aspectRatio: `${paperSize.widthMm} / ${paperSize.heightMm}`
        }}
      >
        <PreviewSlot slot={side.left} rect={slots.left} paperSize={paperSize} large />
        <PreviewSlot slot={side.right} rect={slots.right} paperSize={paperSize} large />
      </div>
      <div className="flex flex-col gap-3 rounded-md border bg-card p-4">
        <div>
          <p className="text-sm text-muted-foreground">Selected sheet</p>
          <h3 className="text-lg font-semibold">
            Sheet {side.sheetNumber} {side.side === 'front' ? 'Front' : 'Back'}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoBlock label="Left page" value={side.left.pageNumber} />
          <InfoBlock label="Right page" value={side.right.pageNumber} />
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
  onColorChange
}: {
  item: EmptySheetBoardItem
  recentColors: string[]
  colorPickerOpen: boolean
  onColorOpen: () => void
  onColorClose: () => void
  onColorChange: (colorHex: string) => void
}): JSX.Element {
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
          <p className="text-sm text-muted-foreground">Selected sheet</p>
          <h3 className="text-lg font-semibold">{item.label}</h3>
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Background color</p>
          <p className="mt-1 text-lg font-semibold">{item.colorHex}</p>
        </div>
        <Button type="button" variant="outline" onClick={onColorOpen}>
          <Palette data-icon="inline-start" />
          Color
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

function InfoBlock({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function PreviewSlot({
  slot,
  rect,
  paperSize,
  large = false
}: {
  slot: BookletSlot
  rect: Rect
  paperSize: { widthMm: number; heightMm: number }
  large?: boolean
}): JSX.Element {
  const page = slot.page
  const style = {
    left: `${(rect.x / paperSize.widthMm) * 100}%`,
    bottom: `${(rect.y / paperSize.heightMm) * 100}%`,
    width: `${(rect.width / paperSize.widthMm) * 100}%`,
    height: `${(rect.height / paperSize.heightMm) * 100}%`
  }

  return (
    <div
      className="absolute flex items-center justify-center overflow-hidden border border-dashed border-slate-300 bg-slate-50"
      style={style}
    >
      <PageArtwork page={page} />
      <div
        className={`absolute left-2 top-2 rounded bg-white/90 px-2 py-1 font-bold shadow-sm ${large ? 'text-sm' : 'text-xs'}`}
      >
        Page {slot.pageNumber}
      </div>
    </div>
  )
}

function PageArtwork({ page }: { page: BookletPage }): JSX.Element {
  if (page.sourceType === 'blank') {
    const fillColor = getSolidFillHex(page.colorHex)

    return (
      <div
        className="grid h-full w-full place-items-center text-sm font-semibold"
        style={{
          backgroundColor: fillColor,
          color: getReadableTextColor(fillColor)
        }}
      >
        Blank
      </div>
    )
  }

  if (page.thumbnailUrl) {
    return (
      <img
        src={page.thumbnailUrl}
        alt={page.displayName}
        className="h-full w-full object-contain"
      />
    )
  }

  return <span className="text-sm font-semibold text-muted-foreground">Blank</span>
}
