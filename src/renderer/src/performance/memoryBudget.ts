import type { PerformanceSettings } from './performanceTypes'

export function getCanvasPixelBudget(
  settings: PerformanceSettings,
  purpose: string
): number {
  return isExportPurpose(purpose)
    ? settings.memory.exportCanvasPixelBudget
    : settings.memory.previewCanvasPixelBudget
}

export function assertWithinCanvasBudget(
  width: number,
  height: number,
  purpose: string,
  settings: PerformanceSettings
): void {
  const pixelCount = width * height
  const budget = getCanvasPixelBudget(settings, purpose)

  if (pixelCount > budget) {
    throw new Error(
      `Out of memory risk while ${purpose}. Use Low-end PC mode, reduce preview quality, or lower custom dimensions.`
    )
  }
}

function isExportPurpose(purpose: string): boolean {
  return /export/i.test(purpose)
}
