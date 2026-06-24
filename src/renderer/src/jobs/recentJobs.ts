import type { PrinterJob } from './jobTypes'

export function sortRecentJobs(jobs: PrinterJob[]): PrinterJob[] {
  return [...jobs].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
}

export function getRecentJobs(jobs: PrinterJob[], limit = 20): PrinterJob[] {
  return sortRecentJobs(jobs).slice(0, Math.max(0, limit))
}
