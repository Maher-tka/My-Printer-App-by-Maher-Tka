import assert from 'node:assert/strict'
import { calculateJobQuote } from './jobQuote'
import { getDeadlineState, localDateKey, statusLabel } from './jobWorkflow'
import type { PrinterJob } from './jobTypes'

const job: PrinterJob = {
  id: 'job-test',
  tool: 'booklet',
  customerName: 'Customer',
  phoneNumber: '',
  jobTitle: 'Test',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  status: 'ready-to-print',
  deadline: '2026-08-09',
  notes: '',
  exportPaths: [],
  quote: {
    materialCost: 0,
    printCost: 0,
    finishingCost: 0,
    designCost: 0,
    quantity: 1,
    discount: 0,
    finalPrice: 0,
    depositPaid: 0,
    remainingAmount: 0
  }
}

assert.equal(getDeadlineState(job, '2026-08-10'), 'overdue')
assert.equal(getDeadlineState({ ...job, deadline: '2026-08-10' }, '2026-08-10'), 'today')
assert.equal(getDeadlineState({ ...job, status: 'delivered' }, '2026-08-10'), 'complete')
assert.equal(statusLabel('waiting-customer-approval'), 'Waiting approval')
assert.match(localDateKey(new Date(2026, 7, 10)), /^2026-08-10$/)

console.log('Shop job workflow tests passed.')

const priced = calculateJobQuote({
  ...job.quote,
  materialCost: 0.1,
  printCost: 0.2,
  quantity: 3,
  depositPaid: 0.2
})
assert.equal(priced.finalPrice, 0.9)
assert.equal(priced.remainingAmount, 0.7)
const invalid = calculateJobQuote({
  ...job.quote,
  materialCost: NaN,
  printCost: Infinity,
  quantity: -3,
  depositPaid: -2
})
assert.equal(invalid.finalPrice, 0)
assert.equal(invalid.materialCost, 0)
assert.equal(invalid.printCost, 0)
assert.equal(invalid.quantity, 1)
assert.equal(invalid.depositPaid, 0)
assert.equal(calculateJobQuote({ ...job.quote, quantity: 2.9 }).quantity, 2)
assert.equal(calculateJobQuote({ ...job.quote, materialCost: 5, discount: 10 }).finalPrice, 0)
assert.equal(
  calculateJobQuote({ ...job.quote, materialCost: 5, depositPaid: 10 }).remainingAmount,
  0
)
