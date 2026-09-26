import type { PrinterJob, PrinterJobStatus } from './jobTypes'

export const JOB_STATUS_OPTIONS: Array<{ value: PrinterJobStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'waiting-customer-approval', label: 'Waiting approval' },
  { value: 'ready-to-print', label: 'Ready to print' },
  { value: 'printing', label: 'Printing' },
  { value: 'printed', label: 'Printed' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'canceled', label: 'Canceled' }
]

export const BOARD_STATUSES = JOB_STATUS_OPTIONS.filter(({ value }) => value !== 'canceled')

export function statusLabel(status: PrinterJobStatus): string {
  return JOB_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
}

export function getDeadlineState(
  job: PrinterJob,
  today = localDateKey(new Date())
): 'none' | 'overdue' | 'today' | 'upcoming' | 'complete' {
  if (!job.deadline) return 'none'
  if (job.status === 'delivered' || job.status === 'canceled') return 'complete'
  if (job.deadline < today) return 'overdue'
  if (job.deadline === today) return 'today'
  return 'upcoming'
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
