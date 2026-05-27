export type PerformancePresetId = 'low-end' | 'balanced' | 'high-quality'

export interface PerformanceRenderSettings {
  thumbnailMaxSizePx: number
  thumbnailJpegQuality: number
  previewMaxWidthPx: number
  previewMaxHeightPx: number
  fullPage3dMaxWidthPx: number
  fullPage3dMaxHeightPx: number
  fullPage3dJpegQuality: number
  renderConcurrency: number
  pdfImportBatchSize: number
  disableHeavyAnimations: boolean
  lazy3dLargeProjectPageLimit: number
}

export interface PerformanceMemorySettings {
  previewCanvasPixelBudget: number
  exportCanvasPixelBudget: number
  objectUrlCacheLimit: number
}

export interface PerformanceSettings {
  preset: PerformancePresetId
  label: string
  description: string
  render: PerformanceRenderSettings
  memory: PerformanceMemorySettings
}

export interface LargeProjectInfo {
  pageCount: number
  totalBytes?: number
}
