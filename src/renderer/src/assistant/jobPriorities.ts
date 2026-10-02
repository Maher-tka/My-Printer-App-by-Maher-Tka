import { calculateJobQuote } from '@/jobs/jobQuote'
import type { PrinterJob } from '@/jobs/jobTypes'
import { getDeadlineState, localDateKey } from '@/jobs/jobWorkflow'

export interface JobPriority {
  job: PrinterJob
  urgency: 'overdue' | 'today' | 'upcoming' | 'none'
  reason: string
  nextStep: string
  rank: number
}

export function prioritizeJobs(
  jobs: PrinterJob[],
  today = localDateKey(new Date())
): JobPriority[] {
  return jobs
    .filter((job) => job.status !== 'delivered' && job.status !== 'canceled')
    .map((job): JobPriority => {
      const deadline = getDeadlineState(job, today)
      const urgency = deadline === 'complete' ? 'none' : deadline
      const reason =
        urgency === 'overdue'
          ? `Overdue · ${job.deadline}`
          : urgency === 'today'
            ? 'Due today'
            : job.deadline
              ? `Due ${job.deadline}`
              : 'No deadline set'
      let nextStep: string
      switch (job.status) {
        case 'waiting-customer-approval':
          nextStep = 'Follow up on customer approval before printing.'
          break
        case 'ready-to-print':
          nextStep = job.exportPaths.length
            ? 'Review the exported file and confirm printer settings.'
            : 'Prepare and export the production file before printing.'
          break
        case 'printing':
          nextStep = 'Check print progress and inspect the first finished sheet.'
          break
        case 'printed':
          nextStep =
            calculateJobQuote(job.quote).remainingAmount > 0
              ? 'Arrange collection and confirm the remaining payment.'
              : 'Arrange collection or delivery with the customer.'
          break
        default:
          nextStep = !job.deadline
            ? 'Set a delivery date, then confirm the quote and artwork.'
            : 'Confirm the quote and artwork with the customer.'
      }
      return {
        job,
        urgency,
        reason,
        nextStep,
        rank: urgency === 'overdue' ? 0 : urgency === 'today' ? 1 : urgency === 'upcoming' ? 2 : 3
      }
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (a.job.deadline ?? '').localeCompare(b.job.deadline ?? '') ||
        a.job.createdAt.localeCompare(b.job.createdAt) ||
        a.job.id.localeCompare(b.job.id)
    )
}
