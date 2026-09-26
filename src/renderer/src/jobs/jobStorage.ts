import type { PrinterJob } from './jobTypes'

export const JOB_STORAGE_KEY = 'my-printer-app.jobs.v1'
export const JOB_STORAGE_EVENT = 'my-printer-app:jobs-changed'
export const MAX_STORED_JOBS = 1000

const JOB_TOOLS = new Set(['booklet', 'cutter', 'hardcover', 'sequential'])
const JOB_STATUSES = new Set([
  'draft',
  'waiting-customer-approval',
  'ready-to-print',
  'printing',
  'printed',
  'delivered',
  'canceled'
])

export function readStoredJobs(): PrinterJob[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(JOB_STORAGE_KEY) ?? '[]')
    return normalizeStoredJobs(parsed)
  } catch {
    return []
  }
}

export function writeStoredJobs(jobs: PrinterJob[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(normalizeStoredJobs(jobs)))
  window.dispatchEvent(new CustomEvent(JOB_STORAGE_EVENT))
}

export function upsertStoredJob(job: PrinterJob): PrinterJob[] {
  const current = readStoredJobs()
  const next = [job, ...current.filter((item) => item.id !== job.id)]
  writeStoredJobs(next)
  return next
}

export function normalizeStoredJobs(value: unknown): PrinterJob[] {
  return Array.isArray(value) ? value.filter(isPrinterJob).slice(0, MAX_STORED_JOBS) : []
}

export function isPrinterJob(value: unknown): value is PrinterJob {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<PrinterJob>
  const quote = item.quote
  return Boolean(
    isNonEmptyString(item.id) &&
    isNonEmptyString(item.tool) &&
    JOB_TOOLS.has(item.tool) &&
    isNonEmptyString(item.jobTitle) &&
    typeof item.customerName === 'string' &&
    typeof item.phoneNumber === 'string' &&
    typeof item.notes === 'string' &&
    isNonEmptyString(item.createdAt) &&
    isNonEmptyString(item.updatedAt) &&
    isNonEmptyString(item.status) &&
    JOB_STATUSES.has(item.status) &&
    Array.isArray(item.exportPaths) &&
    item.exportPaths.every((path) => typeof path === 'string') &&
    quote &&
    isFiniteNumber(quote.materialCost) &&
    isFiniteNumber(quote.printCost) &&
    isFiniteNumber(quote.finishingCost) &&
    isFiniteNumber(quote.designCost) &&
    isFiniteNumber(quote.quantity) &&
    isFiniteNumber(quote.discount) &&
    isFiniteNumber(quote.finalPrice) &&
    isFiniteNumber(quote.depositPaid) &&
    isFiniteNumber(quote.remainingAmount)
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
