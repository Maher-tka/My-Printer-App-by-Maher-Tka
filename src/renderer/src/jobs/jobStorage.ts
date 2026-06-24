import type { PrinterJob } from './jobTypes'

const JOB_STORAGE_KEY = 'my-printer-app.jobs.v1'
const MAX_JOBS = 100

export function readStoredJobs(): PrinterJob[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(JOB_STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isPrinterJob).slice(0, MAX_JOBS) : []
  } catch {
    return []
  }
}

export function writeStoredJobs(jobs: PrinterJob[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(jobs.slice(0, MAX_JOBS)))
}

export function upsertStoredJob(job: PrinterJob): PrinterJob[] {
  const current = readStoredJobs()
  const next = [job, ...current.filter((item) => item.id !== job.id)]
  writeStoredJobs(next)
  return next
}

function isPrinterJob(value: unknown): value is PrinterJob {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<PrinterJob>
  return Boolean(
    item.id && item.tool && item.jobTitle && item.createdAt && item.updatedAt && item.quote
  )
}
