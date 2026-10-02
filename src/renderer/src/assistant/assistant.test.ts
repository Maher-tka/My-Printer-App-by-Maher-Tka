import assert from 'node:assert/strict'
import { findCustomerJobs, findProductionTasks, normalizeSearch } from './taskMatching'
import { prioritizeJobs } from './jobPriorities'
import type { PrinterJob } from '@/jobs/jobTypes'

for (const [query, expected] of [
  ['I want to print 500 raffle tickets', 'sequential-number'],
  ['please make stickers for me', 'cutter-montage'],
  ['stikers', 'cutter-montage'],
  ['a folded booklet', 'booklet-montage'],
  ['couverture mémoire', 'hardcover-cover'],
  ['étiquettes autocollantes', 'cutter-montage'],
  ['ملصقات', 'cutter-montage'],
  ['ترقيم تذاكر', 'sequential-number'],
  ['customer deposit', 'jobs'],
  ['reprint previous output', 'exports']
]) {
  assert.equal(findProductionTasks(query)[0]?.route, expected, query)
}
for (const query of ['', '   ', '!!!', 'please help me', 'pizza delivery']) {
  assert.deepEqual(findProductionTasks(query), [], `No fabricated match for ${query}`)
}
assert.equal(normalizeSearch('MÉMOIRE / étiquette'), 'memoire etiquette')
assert.deepEqual(
  new Set(findProductionTasks('tickets and stickers').map((task) => task.route)),
  new Set(['sequential-number', 'cutter-montage'])
)

const base: PrinterJob = {
  id: 'base',
  tool: 'booklet',
  customerName: 'Amélie',
  phoneNumber: '+216 20 123 456',
  jobTitle: 'Graduation booklet',
  createdAt: '2026-09-01',
  updatedAt: '2026-09-01',
  status: 'draft',
  notes: '',
  exportPaths: [],
  quote: {
    materialCost: 10,
    printCost: 0,
    finishingCost: 0,
    designCost: 0,
    quantity: 2,
    discount: 0,
    finalPrice: 0,
    depositPaid: 5,
    remainingAmount: 0
  }
}
const jobs: PrinterJob[] = [
  { ...base, id: 'undated' },
  { ...base, id: 'future', deadline: '2026-10-05' },
  { ...base, id: 'today', deadline: '2026-09-29', status: 'waiting-customer-approval' },
  { ...base, id: 'overdue', deadline: '2026-09-28', status: 'ready-to-print' },
  { ...base, id: 'delivered', deadline: '2026-09-01', status: 'delivered' },
  { ...base, id: 'canceled', deadline: '2026-09-01', status: 'canceled' }
]
const original = structuredClone(jobs)
const ranked = prioritizeJobs(jobs, '2026-09-29')
assert.deepEqual(
  ranked.map(({ job }) => job.id),
  ['overdue', 'today', 'future', 'undated']
)
assert.match(ranked[0].nextStep, /export/)
assert.match(ranked[1].nextStep, /approval before printing/)
assert.equal(
  prioritizeJobs(jobs, '2026-09-30').find(({ job }) => job.id === 'today')?.urgency,
  'overdue'
)
assert.equal(
  prioritizeJobs([{ ...base, deadline: '2026-09-29' }], '2026-09-29')[0].urgency,
  'today'
)
assert.match(
  prioritizeJobs([{ ...base, status: 'printed' }])[0].nextStep,
  /remaining payment/,
  'Recalculate the balance instead of trusting stale totals'
)
assert.doesNotMatch(
  prioritizeJobs([{ ...base, status: 'printed', quote: { ...base.quote, depositPaid: 20 } }])[0]
    .nextStep,
  /payment/
)
assert.match(
  prioritizeJobs([{ ...base, status: 'ready-to-print', exportPaths: ['output.pdf'] }])[0].nextStep,
  /printer settings/
)
assert.deepEqual(prioritizeJobs([], '2026-09-29'), [])

assert.equal(findCustomerJobs([base], 'amelie booklet')[0]?.id, 'base')
assert.equal(findCustomerJobs([base], '20123456')[0]?.id, 'base')
assert.equal(findCustomerJobs([base], '+216-20-123-456')[0]?.id, 'base')
assert.deepEqual(findCustomerJobs([base], 'Amelie stickers'), [])
assert.deepEqual(findCustomerJobs([base], 'Ameliee'), [], 'Do not fuzzy-match customer identity')
assert.deepEqual(findCustomerJobs([base], '!!!'), [])
assert.deepEqual(findCustomerJobs([base], ''), [])
assert.deepEqual(
  findCustomerJobs(
    [
      { ...base, id: 'old' },
      { ...base, id: 'new', updatedAt: '2026-09-29' }
    ],
    'amelie'
  ).map(({ id }) => id),
  ['new', 'old']
)
assert.deepEqual(jobs, original, 'Suggestions and search must not change saved job data')
console.log('Task matching, customer search, and job priority tests passed.')
