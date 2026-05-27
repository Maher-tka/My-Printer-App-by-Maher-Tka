import type {
  LargeProjectInfo,
  PerformancePresetId,
  PerformanceSettings
} from './performanceTypes'

const LARGE_PROJECT_BYTES = 80 * 1024 * 1024
const LARGE_PROJECT_PAGE_COUNT = 64

export function getRenderConcurrency(settings: PerformanceSettings): number {
  return Math.max(1, Math.min(settings.render.renderConcurrency, 3))
}

export function isLargeProject(project: LargeProjectInfo): boolean {
  return (
    project.pageCount >= LARGE_PROJECT_PAGE_COUNT ||
    (project.totalBytes !== undefined && project.totalBytes >= LARGE_PROJECT_BYTES)
  )
}

export function getLargeProjectWarning(project: LargeProjectInfo): string | null {
  return isLargeProject(project)
    ? 'Large project detected. Low-end PC mode is recommended.'
    : null
}

export function shouldRequireManual3dLoad(
  project: LargeProjectInfo,
  settings: PerformanceSettings
): boolean {
  return (
    settings.preset === 'low-end' &&
    project.pageCount > settings.render.lazy3dLargeProjectPageLimit
  )
}

export function getPerformanceBadgeTone(preset: PerformancePresetId): 'warning' | 'secondary' | 'success' {
  if (preset === 'low-end') {
    return 'warning'
  }

  if (preset === 'high-quality') {
    return 'success'
  }

  return 'secondary'
}
