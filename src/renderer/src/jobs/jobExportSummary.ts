import type { PrinterJob } from './jobTypes'

export function createJobExportSummary(job: PrinterJob): string {
  return [
    `Job: ${job.jobTitle}`,
    `Customer: ${job.customerName || 'Not set'}`,
    `Phone: ${job.phoneNumber || 'Not set'}`,
    `Tool: ${job.tool}`,
    `Status: ${job.status}`,
    `Quantity: ${job.quote.quantity}`,
    `Final price: ${job.quote.finalPrice.toFixed(2)}`,
    `Deposit: ${job.quote.depositPaid.toFixed(2)}`,
    `Remaining: ${job.quote.remainingAmount.toFixed(2)}`,
    `Notes: ${job.notes || 'None'}`
  ].join('\n')
}
