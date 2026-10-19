import assert from 'node:assert/strict'
import {
  JOB_STORAGE_KEY,
  MAX_STORED_JOBS,
  deleteStoredJob,
  normalizeStoredJobs,
  readStoredJobs,
  upsertStoredJob
} from './jobStorage'
import {
  CUSTOMER_STORAGE_KEY,
  MAX_STORED_CUSTOMERS,
  deleteStoredCustomer,
  readStoredCustomers,
  upsertStoredCustomer
} from '../customers/customerStorage'
import { sanitizeShopBackupRendererData } from '../../../shared/shop-backup-validation'
import type { PrinterJob } from './jobTypes'

const job: PrinterJob = {
  id: 'job-1',
  tool: 'booklet',
  jobTitle: 'Booklet order',
  customerName: 'Customer',
  phoneNumber: '',
  createdAt: '2026-10-18T10:00:00Z',
  updatedAt: '2026-10-18T10:00:00Z',
  status: 'draft',
  notes: '',
  exportPaths: [],
  quote: {
    materialCost: 1,
    printCost: 2,
    finishingCost: 0,
    designCost: 0,
    quantity: 1,
    discount: 0,
    finalPrice: 3,
    depositPaid: 0,
    remainingAmount: 3
  }
}
const customer = {
  id: 'customer-1',
  name: 'Customer',
  phone: '',
  createdAt: job.createdAt,
  updatedAt: job.updatedAt
}

for (const field of [
  'customerId',
  'deadline',
  'localProjectPath',
  'thumbnailPreview',
  'printHistory'
]) {
  const malformed = { ...job, [field]: { unexpected: true } }
  assert.deepEqual(normalizeStoredJobs([malformed]), [], field)
  assert.deepEqual(sanitizeShopBackupRendererData({ jobs: [malformed] }).jobs, [], field)
}
for (const field of ['cuttingCost', 'bindingCost', 'designFee']) {
  const malformed = { ...job, quote: { ...job.quote, [field]: 'bad cost' } }
  assert.deepEqual(normalizeStoredJobs([malformed]), [], field)
  assert.deepEqual(sanitizeShopBackupRendererData({ jobs: [malformed] }).jobs, [], field)
}
for (const printHistory of [[null], [{}], [{ module: { toString: null } }]]) {
  assert.deepEqual(normalizeStoredJobs([{ ...job, printHistory }]), [])
}
const printedJob: PrinterJob = {
  ...job,
  deadline: '2026-10-20',
  localProjectPath: 'C:\\Projects\\book.json',
  quote: { ...job.quote, cuttingCost: 2, bindingCost: 1, designFee: 0 },
  printHistory: [
    {
      id: 'print-1',
      module: 'booklet',
      jobName: job.jobTitle,
      printedAt: job.updatedAt,
      pdfName: 'book.pdf',
      status: 'sent-to-printer'
    }
  ]
}
assert.deepEqual(normalizeStoredJobs([job, printedJob]), [job, printedJob])
assert.deepEqual(sanitizeShopBackupRendererData({ jobs: [printedJob] }).jobs, [printedJob])

const values = new Map<string, string>()
let events = 0
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    },
    dispatchEvent: () => {
      events++
      return true
    }
  }
})
try {
  values.set(
    JOB_STORAGE_KEY,
    JSON.stringify(Array.from({ length: MAX_STORED_JOBS }, (_, i) => ({ ...job, id: `job-${i}` })))
  )
  assert.deepEqual(upsertStoredJob({ ...job, id: 'new-job' }), readStoredJobs())
  assert.equal(readStoredJobs().length, MAX_STORED_JOBS)
  // Simulate an independent store writing before this store deletes an older item.
  upsertStoredJob({ ...job, id: 'external-job' })
  const beforeDelete = events
  const remainingJobs = deleteStoredJob('job-1')
  assert.equal(events, beforeDelete + 1)
  assert(remainingJobs.some((item) => item.id === 'external-job'))
  assert(!remainingJobs.some((item) => item.id === 'job-1'))
  assert.deepEqual(remainingJobs, readStoredJobs())

  values.set(
    CUSTOMER_STORAGE_KEY,
    JSON.stringify(
      Array.from({ length: MAX_STORED_CUSTOMERS }, (_, i) => ({ ...customer, id: `customer-${i}` }))
    )
  )
  assert.deepEqual(upsertStoredCustomer({ ...customer, id: 'new-customer' }), readStoredCustomers())
  assert.equal(readStoredCustomers().length, MAX_STORED_CUSTOMERS)
  upsertStoredCustomer({ ...customer, id: 'external-customer' })
  const beforeCustomerDelete = events
  const remainingCustomers = deleteStoredCustomer('customer-1')
  assert.equal(events, beforeCustomerDelete + 1)
  assert(remainingCustomers.some((item) => item.id === 'external-customer'))
  assert(!remainingCustomers.some((item) => item.id === 'customer-1'))
  assert.deepEqual(remainingCustomers, readStoredCustomers())
} finally {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
}
console.log(
  'Job validation, backup compatibility, storage limits and deletion consistency tests passed.'
)
