import type { PaperOrientation, PaperSizeOption, Rect, SheetSettings, SizeMm } from '../types'

export const PRINT_SIZES_MM: Record<Exclude<PaperSizeOption, 'custom'>, SizeMm> = {
  A4: { widthMm: 210, heightMm: 297 },
  A3: { widthMm: 297, heightMm: 420 },
  SRA3: { widthMm: 320, heightMm: 450 }
}

export const INTERNAL_PAGE_MARGIN_MM = 8
export const INTERNAL_PAGE_GAP_MM = 4

export interface SheetLayoutMm {
  paperSize: SizeMm
  trimSlots: {
    left: Rect
    right: Rect
  }
  renderSlots: {
    left: Rect
    right: Rect
  }
}

export function getPrintSizeMm(settings: SheetSettings): SizeMm {
  const base =
    settings.paperSize === 'custom'
      ? {
          widthMm: settings.customWidthMm,
          heightMm: settings.customHeightMm
        }
      : PRINT_SIZES_MM[settings.paperSize]

  return orientPrintSize(base, settings.orientation)
}

export function getSheetLayoutMm(settings: SheetSettings): SheetLayoutMm {
  const paperSize = getPrintSizeMm(settings)
  const trimSlots = getBookletSlotRects(paperSize)

  return {
    paperSize,
    trimSlots,
    renderSlots: {
      left: trimSlots.left,
      right: trimSlots.right
    }
  }
}

export function getBookletSlotRects(
  size: SizeMm,
  marginMm = INTERNAL_PAGE_MARGIN_MM,
  gapMm = INTERNAL_PAGE_GAP_MM
): { left: Rect; right: Rect } {
  const safeMargin = Math.max(0, marginMm)
  const safeGap = Math.max(0, gapMm)
  const availableWidth = size.widthMm - safeMargin * 2 - safeGap
  const availableHeight = size.heightMm - safeMargin * 2

  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error('Margin and gap are too large for the selected paper size.')
  }

  const slotWidth = availableWidth / 2

  return {
    left: {
      x: safeMargin,
      y: safeMargin,
      width: slotWidth,
      height: availableHeight
    },
    right: {
      x: safeMargin + slotWidth + safeGap,
      y: safeMargin,
      width: slotWidth,
      height: availableHeight
    }
  }
}

export function validatePrintSettings(settings: SheetSettings): string[] {
  const errors: string[] = []

  if (settings.paperSize === 'custom') {
    if (
      !isPositiveFiniteNumber(settings.customWidthMm) ||
      !isPositiveFiniteNumber(settings.customHeightMm)
    ) {
      errors.push('Custom paper width and height must be greater than 0 mm.')
    }
  }

  if (errors.length > 0) {
    return errors
  }

  try {
    getBookletSlotRects(getPrintSizeMm(settings))
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Invalid paper layout settings.')
  }

  return errors
}

export function orientPrintSize(size: SizeMm, orientation: PaperOrientation): SizeMm {
  const width = Math.min(size.widthMm, size.heightMm)
  const height = Math.max(size.widthMm, size.heightMm)

  return orientation === 'portrait'
    ? { widthMm: width, heightMm: height }
    : { widthMm: height, heightMm: width }
}

function isPositiveFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0
}
