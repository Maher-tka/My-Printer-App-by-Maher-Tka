import type { PaperOrientation, PaperSizeOption, Rect, SheetSettings, SizeMm } from '../types'
import { PRINT_SIZES_MM } from './printSizes'

export const MM_PER_INCH = 25.4
export const PDF_POINTS_PER_INCH = 72
export const DEFAULT_IMAGE_DPI = 300

export function mmToPoints(mm: number): number {
  return (mm / MM_PER_INCH) * PDF_POINTS_PER_INCH
}

export function pointsToMm(points: number): number {
  return (points / PDF_POINTS_PER_INCH) * MM_PER_INCH
}

export function pixelsToMm(pixels: number, dpi = DEFAULT_IMAGE_DPI): number {
  return (pixels / dpi) * MM_PER_INCH
}

export function mmToPixels(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi)
}

export function getPaperSizeMm(settings: SheetSettings): SizeMm {
  const base =
    settings.paperSize === 'custom'
      ? {
          widthMm: Math.max(settings.customWidthMm, 1),
          heightMm: Math.max(settings.customHeightMm, 1)
        }
      : PRINT_SIZES_MM[settings.paperSize]

  return orientSize(base, settings.orientation)
}

export function orientSize(size: SizeMm, orientation: PaperOrientation): SizeMm {
  const width = Math.min(size.widthMm, size.heightMm)
  const height = Math.max(size.widthMm, size.heightMm)

  return orientation === 'portrait'
    ? { widthMm: width, heightMm: height }
    : { widthMm: height, heightMm: width }
}

export function getSlotRects(
  size: SizeMm,
  marginMm: number,
  gapMm: number
): { left: Rect; right: Rect } {
  const safeMargin = Math.max(0, marginMm)
  const safeGap = Math.max(0, gapMm)
  const availableWidth = Math.max(size.widthMm - safeMargin * 2 - safeGap, 1)
  const availableHeight = Math.max(size.heightMm - safeMargin * 2, 1)
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
