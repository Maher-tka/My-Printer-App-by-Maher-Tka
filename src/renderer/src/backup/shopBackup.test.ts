import assert from 'node:assert/strict'
import { applyRestoredShopData, createDailyShopBackup, scheduleDailyShopBackup } from './shopBackup'
import {
  mergeRestoredExportHistory,
  remapRestoredProjectPaths
} from '../../../shared/shop-backup-restore'
import type { ExportHistoryEntry } from '../../../shared/release-types'
import { CUSTOMER_STORAGE_KEY } from '@/customers/customerStorage'
import { JOB_STORAGE_KEY } from '@/jobs/jobStorage'
import { normalizeStoredCustomers } from '@/customers/customerStorage'
import { normalizeStoredJobs } from '@/jobs/jobStorage'
import {
  MAX_SHOP_BACKUP_JOBS,
  SHOP_BACKUP_SCHEMA,
  SHOP_BACKUP_VERSION,
  isShopBackupEnvelope,
  sanitizeShopBackupRendererData
} from '../../../shared/shop-backup-validation'

const now = '2026-08-10T10:00:00.000Z'
const validJob = {
  id: 'job-1',
  tool: 'booklet',
  customerName: 'Customer',
  phoneNumber: '123',
  jobTitle: 'Booklet order',
  createdAt: now,
  updatedAt: now,
  status: 'draft',
  notes: '',
  exportPaths: [],
  quote: {
    materialCost: 1,
    printCost: 2,
    finishingCost: 3,
    designCost: 4,
    quantity: 1,
    discount: 0,
    finalPrice: 10,
    depositPaid: 2,
    remainingAmount: 8
  }
}
const validCustomer = {
  id: 'customer-1',
  name: 'Customer',
  phone: '123',
  createdAt: now,
  updatedAt: now
}
const validEnvelope = {
  schema: SHOP_BACKUP_SCHEMA,
  version: SHOP_BACKUP_VERSION,
  createdAt: now,
  appVersion: '0.1.0',
  rendererData: { jobs: [validJob], customers: [validCustomer] },
  projects: [
    {
      originalPath: 'C:\\Projects\\book.myprinter-project.json',
      fileName: 'book.myprinter-project.json',
      project: { metadata: { id: 'project-1', jobName: 'Book', tool: 'booklet' } }
    }
  ],
  exportHistory: [
    {
      id: 'export-1',
      toolType: 'booklet',
      projectName: 'Book',
      exportType: 'pdf',
      timestamp: now,
      status: 'success',
      warningsCount: 0,
      preflightStatus: 'passed'
    }
  ]
}

assert.equal(normalizeStoredJobs([validJob, { ...validJob, id: '' }]).length, 1)
assert.equal(normalizeStoredCustomers([validCustomer, { name: 'Missing fields' }]).length, 1)

const sanitized = sanitizeShopBackupRendererData({
  jobs: [validJob, { ...validJob, status: 'not-a-status' }],
  customers: [validCustomer, null]
})
assert.equal(sanitized.jobs.length, 1)
assert.equal(sanitized.customers.length, 1)
assert.equal(isShopBackupEnvelope(validEnvelope), true)
assert.equal(
  isShopBackupEnvelope({
    ...validEnvelope,
    projects: [{ ...validEnvelope.projects[0], fileName: '..\\unsafe.json' }]
  }),
  false
)
assert.equal(
  isShopBackupEnvelope({
    ...validEnvelope,
    rendererData: {
      ...validEnvelope.rendererData,
      jobs: Array.from({ length: MAX_SHOP_BACKUP_JOBS + 1 }, () => validJob)
    }
  }),
  false
)

console.log('shop backup validation tests passed')

const originalPath = 'C:\\Old\\book.json'
const restoredPath = 'D:\\Restored\\book.json'
const restoredData = remapRestoredProjectPaths(
  {
    jobs: [
      { ...validJob, localProjectPath: originalPath },
      { ...validJob, localProjectPath: 'unrelated.json' }
    ],
    customers: [validCustomer]
  },
  new Map([[originalPath, restoredPath]])
)
assert.equal((restoredData.jobs[0] as { localProjectPath: string }).localProjectPath, restoredPath)
assert.equal(
  (restoredData.jobs[1] as { localProjectPath: string }).localProjectPath,
  'unrelated.json'
)
const entry = validEnvelope.exportHistory[0] as ExportHistoryEntry
const existingEntry = { ...entry, projectName: 'Current name' }
assert.deepEqual(mergeRestoredExportHistory([entry], [existingEntry], 200), [existingEntry])
assert.equal(
  mergeRestoredExportHistory(
    [entry],
    [{ ...entry, id: 'newer', timestamp: '2026-09-17T10:00:00Z' }],
    1
  )[0].id,
  'newer'
)

async function verifyBackupReliability(): Promise<void> {
  const values = new Map<string, string>([
    [JOB_STORAGE_KEY, 'previous jobs'],
    [CUSTOMER_STORAGE_KEY, 'previous customers']
  ])
  let failCustomerWrite = false
  let failAllWrites = false
  let failReads = false
  let calls = 0
  let completeBackup: ((result: { ok: boolean }) => void) | undefined
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => {
        if (failReads) throw new Error('Storage unavailable')
        return values.get(key) ?? null
      },
      setItem: (key: string, value: string) => {
        if (failAllWrites || (failCustomerWrite && key === CUSTOMER_STORAGE_KEY)) {
          failCustomerWrite = false
          throw new Error('Storage full')
        }
        values.set(key, value)
      },
      removeItem: (key: string) => values.delete(key)
    },
    dispatchEvent: () => true,
    printerApp: {
      runtime: {
        createAutomaticBackup: () => {
          calls += 1
          return new Promise<{ ok: boolean }>((resolve) => {
            completeBackup = resolve
          })
        }
      }
    },
    setInterval: (_callback: () => void, delay: number) => {
      assert.equal(delay, 3600000)
      return 11
    },
    clearInterval: (id: number) => {
      assert.equal(id, 11)
      clearedInterval = true
    },
    setTimeout: () => 12,
    clearTimeout: (id: number) => {
      assert.equal(id, 12)
      clearedTimeout = true
    }
  }
  let clearedInterval = false
  let clearedTimeout = false
  let removedListener = false
  let visibilityCallback: (() => void) | undefined
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      visibilityState: 'visible',
      addEventListener: (_type: string, callback: () => void) => {
        visibilityCallback = callback
      },
      removeEventListener: (_type: string, callback: () => void) => {
        assert.equal(callback, visibilityCallback)
        removedListener = true
      }
    }
  })
  const result = { ok: true, rendererData: { jobs: [validJob], customers: [validCustomer] } }
  assert.equal(applyRestoredShopData({ ...result, ok: false }).ok, false)
  assert.equal(values.get(JOB_STORAGE_KEY), 'previous jobs')
  failReads = true
  assert.equal(applyRestoredShopData(result).ok, false)
  failReads = false
  failCustomerWrite = true
  assert.match(applyRestoredShopData(result).error ?? '', /left unchanged/)
  assert.equal(values.get(JOB_STORAGE_KEY), 'previous jobs')
  assert.equal(values.get(CUSTOMER_STORAGE_KEY), 'previous customers')
  failAllWrites = true
  assert.match(applyRestoredShopData(result).error ?? '', /may have changed/)
  failAllWrites = false
  assert.equal(applyRestoredShopData(result).ok, true)

  const first = createDailyShopBackup()
  const duplicate = createDailyShopBackup()
  assert.equal(calls, 1, 'Concurrent daily backup checks must share one request')
  completeBackup?.({ ok: false })
  await Promise.all([first, duplicate])
  const retry = createDailyShopBackup()
  assert.equal(calls, 2, 'A failed backup must be retried')
  completeBackup?.({ ok: true })
  await retry
  await createDailyShopBackup()
  assert.equal(calls, 2, 'A successful backup must only run once per date')
  const cancel = scheduleDailyShopBackup()
  assert.ok(visibilityCallback)
  cancel()
  assert.ok(clearedInterval && clearedTimeout && removedListener)
  console.log('shop backup restore, scheduling, and rollback tests passed')
}
void verifyBackupReliability().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
