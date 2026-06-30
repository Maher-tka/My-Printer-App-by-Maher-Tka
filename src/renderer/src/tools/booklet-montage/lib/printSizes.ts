import type { PaperOrientation, PaperSizeOption, Rect, SheetSettings, SizeMm } from '../types'

export const PRINT_SIZES_MM: Record<Exclude<PaperSizeOption, 'custom'>, SizeMm> = {
  A4: { widthMm: 210, heightMm: 297 },
  A3: { widthMm: 297, heightMm: 420 },
  SRA3: { widthMm: 320, heightMm: 450 }
}

export const DEFAULT_OUTER_MARGIN_MM = 0
export const DEFAULT_PAGE_GAP_MM = 0

export const DEFAULT_SHEET_SETTINGS: SheetSettings = {
  paperSize: 'A4',
  orientation: 'landscape',
  outputMode: 'front-back-pairs',
  customWidthMm: 297,
  customHeightMm: 210,
  scaleMode: 'fit',
  readingDirection: 'ltr',
  outerMarginMm: DEFAULT_OUTER_MARGIN_MM,
  pageGapMm: DEFAULT_PAGE_GAP_MM,
  cropMarks: false,
  registrationMarks: false,
  exportQuality: 'standard'
}

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

export function normalizeSheetSettings(settings: Partial<SheetSettings>): SheetSettings {
  return {
    ...DEFAULT_SHEET_SETTINGS,
    ...settings,
    paperSize: isPaperSize(settings.paperSize)
      ? settings.paperSize
      : DEFAULT_SHEET_SETTINGS.paperSize,
    orientation: settings.orientation === 'portrait' ? 'portrait' : 'landscape',
    outputMode: 'front-back-pairs',
    customWidthMm: positiveOrDefault(settings.customWidthMm, DEFAULT_SHEET_SETTINGS.customWidthMm),
    customHeightMm: positiveOrDefault(
      settings.customHeightMm,
      DEFAULT_SHEET_SETTINGS.customHeightMm
    ),
    scaleMode: isScaleMode(settings.scaleMode)
      ? settings.scaleMode
      : DEFAULT_SHEET_SETTINGS.scaleMode,
    readingDirection: settings.readingDirection === 'rtl' ? 'rtl' : 'ltr',
    outerMarginMm: nonNegativeOrDefault(
      settings.outerMarginMm,
      DEFAULT_SHEET_SETTINGS.outerMarginMm
    ),
    pageGapMm: nonNegativeOrDefault(settings.pageGapMm, DEFAULT_SHEET_SETTINGS.pageGapMm),
    cropMarks: settings.cropMarks === true,
    registrationMarks: settings.registrationMarks === true,
    exportQuality: settings.exportQuality === 'high' ? 'high' : 'standard'
  }
}

export function getSheetLayoutMm(settings: SheetSettings): SheetLayoutMm {
  const paperSize = getPrintSizeMm(settings)
  const trimSlots = getBookletSlotRects(paperSize, settings.outerMarginMm, settings.pageGapMm)

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
  marginMm = DEFAULT_OUTER_MARGIN_MM,
  gapMm = DEFAULT_PAGE_GAP_MM
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

  if (!isNonNegativeFiniteNumber(settings.outerMarginMm)) {
    errors.push('Outer margin must be 0 mm or greater.')
  }
  if (!isNonNegativeFiniteNumber(settings.pageGapMm)) {
    errors.push('Page gap must be 0 mm or greater.')
  }

  if (errors.length > 0) {
    return errors
  }

  try {
    getBookletSlotRects(getPrintSizeMm(settings), settings.outerMarginMm, settings.pageGapMm)
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

function isNonNegativeFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function positiveOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && isPositiveFiniteNumber(value) ? value : fallback
}

function nonNegativeOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && isNonNegativeFiniteNumber(value) ? value : fallback
}

function isPaperSize(value: unknown): value is PaperSizeOption {
  return value === 'A4' || value === 'A3' || value === 'SRA3' || value === 'custom'
}

function isScaleMode(value: unknown): value is SheetSettings['scaleMode'] {
  return value === 'fit' || value === 'original' || value === 'stretch'
}
