import type { PerformancePresetId, PerformanceSettings } from './performanceTypes'

const STORAGE_KEY = 'my-printer-app.performance-preset'

export const PERFORMANCE_PRESETS: Record<PerformancePresetId, PerformanceSettings> = {
  'low-end': {
    preset: 'low-end',
    label: 'Low-end PC',
    description: 'Best for older printer-shop computers. Uses smaller previews and one render at a time.',
    render: {
      thumbnailMaxSizePx: 220,
      thumbnailJpegQuality: 0.58,
      previewMaxWidthPx: 620,
      previewMaxHeightPx: 840,
      fullPage3dMaxWidthPx: 760,
      fullPage3dMaxHeightPx: 980,
      fullPage3dJpegQuality: 0.78,
      renderConcurrency: 1,
      pdfImportBatchSize: 3,
      disableHeavyAnimations: true,
      lazy3dLargeProjectPageLimit: 32
    },
    memory: {
      previewCanvasPixelBudget: 18_000_000,
      exportCanvasPixelBudget: 65_000_000,
      objectUrlCacheLimit: 120
    }
  },
  balanced: {
    preset: 'balanced',
    label: 'Balanced',
    description: 'Good default for daily shop work. Keeps previews clear without pushing memory too hard.',
    render: {
      thumbnailMaxSizePx: 320,
      thumbnailJpegQuality: 0.72,
      previewMaxWidthPx: 900,
      previewMaxHeightPx: 1200,
      fullPage3dMaxWidthPx: 1100,
      fullPage3dMaxHeightPx: 1450,
      fullPage3dJpegQuality: 0.88,
      renderConcurrency: 2,
      pdfImportBatchSize: 6,
      disableHeavyAnimations: false,
      lazy3dLargeProjectPageLimit: 72
    },
    memory: {
      previewCanvasPixelBudget: 40_000_000,
      exportCanvasPixelBudget: 80_000_000,
      objectUrlCacheLimit: 220
    }
  },
  'high-quality': {
    preset: 'high-quality',
    label: 'High Quality',
    description: 'Sharper previews for stronger PCs. Export still renders one sheet at a time.',
    render: {
      thumbnailMaxSizePx: 420,
      thumbnailJpegQuality: 0.82,
      previewMaxWidthPx: 1200,
      previewMaxHeightPx: 1600,
      fullPage3dMaxWidthPx: 1450,
      fullPage3dMaxHeightPx: 1900,
      fullPage3dJpegQuality: 0.94,
      renderConcurrency: 3,
      pdfImportBatchSize: 8,
      disableHeavyAnimations: false,
      lazy3dLargeProjectPageLimit: 120
    },
    memory: {
      previewCanvasPixelBudget: 70_000_000,
      exportCanvasPixelBudget: 120_000_000,
      objectUrlCacheLimit: 320
    }
  }
}

const listeners = new Set<() => void>()
let currentPreset = readStoredPreset()

export function getPerformanceSettingsSnapshot(): PerformanceSettings {
  return PERFORMANCE_PRESETS[currentPreset]
}

export function getPerformancePreset(): PerformancePresetId {
  return currentPreset
}

export function setPerformancePreset(preset: PerformancePresetId): void {
  if (!PERFORMANCE_PRESETS[preset] || preset === currentPreset) {
    return
  }

  currentPreset = preset

  try {
    window.localStorage.setItem(STORAGE_KEY, preset)
  } catch {
    // Local storage is only a convenience; the app can still run with memory state.
  }

  for (const listener of listeners) {
    listener()
  }
}

export function subscribePerformanceSettings(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function readStoredPreset(): PerformancePresetId {
  if (typeof window === 'undefined') {
    return 'balanced'
  }

  try {
    const value = window.localStorage.getItem(STORAGE_KEY)

    if (value && value in PERFORMANCE_PRESETS) {
      return value as PerformancePresetId
    }
  } catch {
    return 'balanced'
  }

  return 'balanced'
}
