import type { HardcoverPdfPagePosition } from '../types'

export const DEFAULT_PDF_PAGE_POSITION: HardcoverPdfPagePosition = {
  xPercent: 0,
  yPercent: 0
}

const MAX_POSITION_PERCENT = 40

export function normalizePdfPagePosition(
  position: Partial<HardcoverPdfPagePosition> | undefined
): HardcoverPdfPagePosition {
  return {
    xPercent: clampPercent(position?.xPercent),
    yPercent: clampPercent(position?.yPercent)
  }
}

export function nudgePdfPagePosition(
  position: Partial<HardcoverPdfPagePosition> | undefined,
  deltaXPercent: number,
  deltaYPercent: number
): HardcoverPdfPagePosition {
  const current = normalizePdfPagePosition(position)
  return normalizePdfPagePosition({
    xPercent: current.xPercent + deltaXPercent,
    yPercent: current.yPercent + deltaYPercent
  })
}

export function dragPdfPagePosition(
  startPosition: Partial<HardcoverPdfPagePosition> | undefined,
  deltaXPixels: number,
  deltaYPixels: number,
  zoneWidthPixels: number,
  zoneHeightPixels: number
): HardcoverPdfPagePosition {
  const current = normalizePdfPagePosition(startPosition)
  if (zoneWidthPixels <= 0 || zoneHeightPixels <= 0) return current

  return normalizePdfPagePosition({
    xPercent: current.xPercent + (deltaXPixels / zoneWidthPixels) * 100,
    yPercent: current.yPercent - (deltaYPixels / zoneHeightPixels) * 100
  })
}

export function isCenteredPdfPagePosition(
  position: Partial<HardcoverPdfPagePosition> | undefined
): boolean {
  const normalized = normalizePdfPagePosition(position)
  return normalized.xPercent === 0 && normalized.yPercent === 0
}

function clampPercent(value: number | undefined): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(-MAX_POSITION_PERCENT, Math.min(MAX_POSITION_PERCENT, Math.round(numeric)))
}
