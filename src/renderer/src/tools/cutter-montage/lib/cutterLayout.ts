import type { CutterSheetSettings } from '../types'

export const DEFAULT_CUTTER_SHEET: CutterSheetSettings = {
  widthCm: 95,
  heightCm: 120,
  rollWidthCm: 100,
  unit: 'cm',
  safeMarginCm: 1.5,
  spacingMm: 3,
  snapToGrid: true,
  gridStepCm: 0.5,
  allowRotation: true,
  preserveManualPositions: false,
  showGrid: true,
  preferSameDesignGrouping: true,
  fillDirection: 'left-to-right',
  sortStrategy: 'largest-first'
}

export function getSheetWarnings(settings: CutterSheetSettings): string[] {
  const warnings: string[] = []

  if (settings.widthCm >= 98) {
    warnings.push(
      'Sheet width is close to the 100 cm roll width. 95-97 cm is recommended for machine clearance.'
    )
  }

  if (settings.heightCm > 150) {
    warnings.push('Sheet height is above 150 cm. Check material handling before cutting.')
  }

  if (settings.widthCm <= 0 || settings.heightCm <= 0) {
    warnings.push('Sheet size must be greater than zero.')
  }

  return warnings
}

export function clampSheetHeight(heightCm: number): number {
  return Math.max(30, Math.min(heightCm, 220))
}

export function clampSheetWidth(widthCm: number): number {
  return Math.max(20, Math.min(widthCm, 110))
}

export function getSafeArea(settings: CutterSheetSettings): {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
} {
  const margin = Math.max(settings.safeMarginCm, 0)

  return {
    xCm: margin,
    yCm: margin,
    widthCm: Math.max(settings.widthCm - margin * 2, 1),
    heightCm: Math.max(settings.heightCm - margin * 2, 1)
  }
}
