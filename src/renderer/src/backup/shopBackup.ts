import {
  CUSTOMER_STORAGE_EVENT,
  CUSTOMER_STORAGE_KEY,
  normalizeStoredCustomers,
  readStoredCustomers
} from '@/customers/customerStorage'
import {
  JOB_STORAGE_EVENT,
  JOB_STORAGE_KEY,
  normalizeStoredJobs,
  readStoredJobs
} from '@/jobs/jobStorage'
import type { ShopBackupRendererData, ShopRestoreResult } from '../../../shared/release-types'

const LAST_AUTO_BACKUP_KEY = 'my-printer-app.last-auto-backup.v1'
let backupInFlight: Promise<void> | null = null

export function getShopBackupRendererData(): ShopBackupRendererData {
  return {
    jobs: readStoredJobs(),
    customers: readStoredCustomers()
  }
}

export interface ApplyRestoredShopDataResult {
  ok: boolean
  jobsCount: number
  customersCount: number
  error?: string
}

export function applyRestoredShopData(result: ShopRestoreResult): ApplyRestoredShopDataResult {
  if (!result.ok || !result.rendererData) {
    return { ok: false, jobsCount: 0, customersCount: 0, error: 'Backup has no shop data.' }
  }

  const jobs = normalizeStoredJobs(result.rendererData.jobs)
  const customers = normalizeStoredCustomers(result.rendererData.customers)
  let previousJobs: string | null
  let previousCustomers: string | null
  try {
    previousJobs = window.localStorage.getItem(JOB_STORAGE_KEY)
    previousCustomers = window.localStorage.getItem(CUSTOMER_STORAGE_KEY)
  } catch {
    return {
      ok: false,
      jobsCount: 0,
      customersCount: 0,
      error: 'Local storage is unavailable. Shop lists could not be restored.'
    }
  }

  try {
    window.localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(jobs))
    window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customers))
  } catch (error) {
    const jobsRolledBack = restoreStorageValue(JOB_STORAGE_KEY, previousJobs)
    const customersRolledBack = restoreStorageValue(CUSTOMER_STORAGE_KEY, previousCustomers)
    const rollbackMessage =
      jobsRolledBack && customersRolledBack
        ? 'Shop lists were left unchanged.'
        : 'Some shop lists may have changed. Free up storage and restore the backup again.'
    window.dispatchEvent(new CustomEvent(JOB_STORAGE_EVENT))
    window.dispatchEvent(new CustomEvent(CUSTOMER_STORAGE_EVENT))
    return {
      ok: false,
      jobsCount: 0,
      customersCount: 0,
      error: error instanceof Error ? `${rollbackMessage} ${error.message}` : rollbackMessage
    }
  }

  window.dispatchEvent(new CustomEvent(JOB_STORAGE_EVENT))
  window.dispatchEvent(new CustomEvent(CUSTOMER_STORAGE_EVENT))
  return { ok: true, jobsCount: jobs.length, customersCount: customers.length }
}

export async function createDailyShopBackup(): Promise<void> {
  if (backupInFlight) return backupInFlight
  backupInFlight = (async () => {
    try {
      const api = window.printerApp?.runtime
      if (!api?.createAutomaticBackup) return
      const today = new Date().toISOString().slice(0, 10)
      if (window.localStorage.getItem(LAST_AUTO_BACKUP_KEY) === today) return
      const result = await api.createAutomaticBackup(getShopBackupRendererData())
      if (result.ok) window.localStorage.setItem(LAST_AUTO_BACKUP_KEY, today)
    } catch (error) {
      // Leave the date unset so the next scheduled check can retry.
      console.warn('Automatic shop backup could not complete.', error)
    }
  })()
  try {
    await backupInFlight
  } finally {
    backupInFlight = null
  }
}

export function scheduleDailyShopBackup(): () => void {
  const idleApi = window as unknown as {
    requestIdleCallback?: Window['requestIdleCallback']
    cancelIdleCallback?: Window['cancelIdleCallback']
  }
  const runBackup = (): void => {
    void createDailyShopBackup()
  }
  // Check throughout long sessions and after the computer wakes up.
  const intervalId = window.setInterval(runBackup, 60 * 60 * 1000)
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') runBackup()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  let cancelInitial: () => void
  if (idleApi.requestIdleCallback && idleApi.cancelIdleCallback) {
    const idleId = idleApi.requestIdleCallback(runBackup, { timeout: 5000 })
    cancelInitial = () => idleApi.cancelIdleCallback?.(idleId)
  } else {
    const timeoutId = window.setTimeout(runBackup, 2000)
    cancelInitial = () => window.clearTimeout(timeoutId)
  }
  return () => {
    cancelInitial()
    window.clearInterval(intervalId)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

function restoreStorageValue(key: string, value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
