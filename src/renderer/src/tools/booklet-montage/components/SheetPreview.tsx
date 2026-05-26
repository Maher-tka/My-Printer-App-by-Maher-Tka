import type { BookletPage, BookletSheet, BookletSide, BookletSlot, Rect, SheetSettings } from '../types'
import { getBookletSlotRects, getPrintSizeMm } from '../lib/printSizes'

interface SheetPreviewProps {
  sheets: BookletSheet[]
  settings: SheetSettings
  pageCountIsValid: boolean
  viewMode: 'montage' | 'sheet'
  selectedSideKey: string | null
  onSelectSide: (sideKey: string) => void
}

export function SheetPreview({
  sheets,
  settings,
  pageCountIsValid,
  viewMode,
  selectedSideKey,
  onSelectSide
}: SheetPreviewProps): JSX.Element {
  if (sheets.length === 0) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed bg-muted/35 p-8 text-center">
        <div className="max-w-md">
          <h3 className="text-lg font-semibold">No imposed sheets yet</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Import pages and make the total page count divisible by 4 to generate a
            2D booklet preview.
          </p>
          {!pageCountIsValid && (
            <p className="mt-3 text-sm font-semibold text-amber-700">
              Add blank pages before preview/export.
            </p>
          )}
        </div>
      </div>
    )
  }

  const sides = sheets.flatMap((sheet) => [sheet.front, sheet.back])
  const selectedSide =
    sides.find((side) => getSideKey(side) === selectedSideKey) ?? sides[0]

  if (viewMode === 'sheet') {
    return <DetailedSidePreview side={selectedSide} settings={settings} />
  }

  return (
    <div className="max-h-[calc(100vh-260px)] min-h-[560px] overflow-auto rounded-lg border bg-slate-100/70 p-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        {sides.map((side) => (
          <SidePreview
            key={getSideKey(side)}
            side={side}
            settings={settings}
            selected={getSideKey(side) === selectedSideKey}
            onSelect={() => onSelectSide(getSideKey(side))}
          />
      ))}
      </div>
    </div>
  )
}

function SidePreview({
  side,
  settings,
  selected,
  onSelect
}: {
  side: BookletSide
  settings: SheetSettings
  selected: boolean
  onSelect: () => void
}): JSX.Element {
  const rawPaperSize = getPrintSizeMm(settings)
  const paperSize = {
    widthMm: Math.max(rawPaperSize.widthMm, 1),
    heightMm: Math.max(rawPaperSize.heightMm, 1)
  }
  const slots = getPreviewSlots(paperSize, settings)

  return (
    <button
      type="button"
      className={`rounded-md border bg-card p-3 text-left shadow-sm transition hover:border-primary/50 ${
        selected ? 'border-primary ring-2 ring-primary/20' : ''
      }`}
      onClick={onSelect}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          Sheet {side.sheetNumber} {side.side === 'front' ? 'Front' : 'Back'}
        </span>
        <span className="text-xs text-muted-foreground">
          {side.left.pageNumber} | {side.right.pageNumber}
        </span>
      </div>
      <div
        className="relative mx-auto overflow-hidden rounded-sm border bg-white shadow-sm"
        style={{
          aspectRatio: `${paperSize.widthMm} / ${paperSize.heightMm}`,
          maxHeight: 280
        }}
      >
        <PreviewSlot slot={side.left} rect={slots.left} paperSize={paperSize} />
        <PreviewSlot slot={side.right} rect={slots.right} paperSize={paperSize} />
      </div>
    </button>
  )
}

function getPreviewSlots(
  paperSize: { widthMm: number; heightMm: number },
  settings: SheetSettings
): { left: Rect; right: Rect } {
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
  const slots = getPreviewSlots(paperSize, settings)

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
      <div className={`absolute left-2 top-2 rounded bg-white/90 px-2 py-1 font-bold shadow-sm ${large ? 'text-sm' : 'text-xs'}`}>
        Page {slot.pageNumber}
      </div>
    </div>
  )
}

function getSideKey(side: BookletSide): string {
  return `${side.sheetNumber}-${side.side}`
}

function PageArtwork({ page }: { page: BookletPage }): JSX.Element {
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
