import { Badge } from '@/components/ui/badge'
import type { BookletPage, BookletSheet, BookletSlot, Rect, SheetSettings } from '../types'
import { getBookletSlotRects, getPrintSizeMm } from '../lib/printSizes'

interface SheetPreviewProps {
  sheets: BookletSheet[]
  settings: SheetSettings
  pageCountIsValid: boolean
}

export function SheetPreview({
  sheets,
  settings,
  pageCountIsValid
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

  return (
    <div className="flex flex-col gap-4">
      {sheets.map((sheet) => (
        <div key={sheet.sheetNumber} className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="font-semibold">Sheet {sheet.sheetNumber}</h3>
            <Badge variant="secondary">Front / Back</Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SidePreview side={sheet.front} settings={settings} />
            <SidePreview side={sheet.back} settings={settings} />
          </div>
        </div>
      ))}
    </div>
  )
}

function SidePreview({
  side,
  settings
}: {
  side: BookletSheet['front']
  settings: SheetSettings
}): JSX.Element {
  const rawPaperSize = getPrintSizeMm(settings)
  const paperSize = {
    widthMm: Math.max(rawPaperSize.widthMm, 1),
    heightMm: Math.max(rawPaperSize.heightMm, 1)
  }
  const slots = getPreviewSlots(paperSize, settings)

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {side.side === 'front' ? 'Front' : 'Back'}
        </span>
        <span className="text-xs text-muted-foreground">
          {paperSize.widthMm} x {paperSize.heightMm} mm
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
    </div>
  )
}

function getPreviewSlots(
  paperSize: { widthMm: number; heightMm: number },
  settings: SheetSettings
): { left: Rect; right: Rect } {
  try {
    return getBookletSlotRects(paperSize, settings.marginMm, settings.gapMm)
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

function PreviewSlot({
  slot,
  rect,
  paperSize
}: {
  slot: BookletSlot
  rect: Rect
  paperSize: { widthMm: number; heightMm: number }
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
      <div className="absolute left-2 top-2 rounded bg-white/90 px-2 py-1 text-xs font-bold shadow-sm">
        Page {slot.pageNumber}
      </div>
    </div>
  )
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
