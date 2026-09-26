import type { ExportHistoryEntry, ShopBackupRendererData } from './release-types.js'

export const SHOP_BACKUP_SCHEMA = 'com.maher-tka.my-printer-app.shop-backup'
export const SHOP_BACKUP_VERSION = 1
export const MAX_SHOP_BACKUP_BYTES = 512 * 1024 * 1024
export const MAX_SHOP_BACKUP_PROJECTS = 20
export const MAX_SHOP_BACKUP_JOBS = 1000
export const MAX_SHOP_BACKUP_CUSTOMERS = 1000

export interface ShopBackupProject {
  originalPath: string
  fileName: string
  project: Record<string, unknown>
}

export interface ShopBackupEnvelope {
  schema: typeof SHOP_BACKUP_SCHEMA
  version: typeof SHOP_BACKUP_VERSION
  createdAt: string
  appVersion: string
  rendererData: ShopBackupRendererData
  projects: ShopBackupProject[]
  exportHistory: ExportHistoryEntry[]
}

export function sanitizeShopBackupRendererData(value: unknown): ShopBackupRendererData {
  const data = isRecord(value) ? value : {}
  return {
    jobs: Array.isArray(data.jobs)
      ? data.jobs.filter(isBackupJob).slice(0, MAX_SHOP_BACKUP_JOBS)
      : [],
    customers: Array.isArray(data.customers)
      ? data.customers.filter(isBackupCustomer).slice(0, MAX_SHOP_BACKUP_CUSTOMERS)
      : []
  }
}

export function isShopBackupEnvelope(value: unknown): value is ShopBackupEnvelope {
  if (!isRecord(value)) return false
  const rendererData = value.rendererData
  const projects = value.projects
  const exportHistory = value.exportHistory

  return Boolean(
    value.schema === SHOP_BACKUP_SCHEMA &&
    value.version === SHOP_BACKUP_VERSION &&
    isValidDate(value.createdAt) &&
    isBoundedString(value.appVersion, 100) &&
    isRecord(rendererData) &&
    Array.isArray(rendererData.jobs) &&
    rendererData.jobs.length <= MAX_SHOP_BACKUP_JOBS &&
    rendererData.jobs.every(isBackupJob) &&
    Array.isArray(rendererData.customers) &&
    rendererData.customers.length <= MAX_SHOP_BACKUP_CUSTOMERS &&
    rendererData.customers.every(isBackupCustomer) &&
    Array.isArray(projects) &&
    projects.length <= MAX_SHOP_BACKUP_PROJECTS &&
    projects.every(isBackupProject) &&
    Array.isArray(exportHistory) &&
    exportHistory.length <= 200 &&
    exportHistory.every(isExportHistoryEntry)
  )
}

function isBackupJob(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.quote)) return false
  return Boolean(
    isBoundedString(value.id, 500, true) &&
    isOneOf(value.tool, ['booklet', 'cutter', 'hardcover', 'sequential']) &&
    isBoundedString(value.customerName, 10_000) &&
    isBoundedString(value.phoneNumber, 1000) &&
    isBoundedString(value.jobTitle, 10_000, true) &&
    isValidDate(value.createdAt) &&
    isValidDate(value.updatedAt) &&
    isOneOf(value.status, [
      'draft',
      'waiting-customer-approval',
      'ready-to-print',
      'printing',
      'printed',
      'delivered',
      'canceled'
    ]) &&
    isBoundedString(value.notes, 100_000) &&
    Array.isArray(value.exportPaths) &&
    value.exportPaths.length <= 1000 &&
    value.exportPaths.every((path) => isBoundedString(path, 32_768)) &&
    [
      value.quote.materialCost,
      value.quote.printCost,
      value.quote.finishingCost,
      value.quote.designCost,
      value.quote.quantity,
      value.quote.discount,
      value.quote.finalPrice,
      value.quote.depositPaid,
      value.quote.remainingAmount
    ].every(isFiniteNumber)
  )
}

function isBackupCustomer(value: unknown): boolean {
  if (!isRecord(value)) return false
  return Boolean(
    isBoundedString(value.id, 500, true) &&
    isBoundedString(value.name, 10_000, true) &&
    isBoundedString(value.phone, 1000) &&
    isValidDate(value.createdAt) &&
    isValidDate(value.updatedAt) &&
    isOptionalBoundedString(value.email, 10_000) &&
    isOptionalBoundedString(value.company, 10_000) &&
    isOptionalBoundedString(value.address, 100_000) &&
    isOptionalBoundedString(value.notes, 100_000)
  )
}

function isBackupProject(value: unknown): boolean {
  if (!isRecord(value)) return false
  return Boolean(
    isBoundedString(value.originalPath, 32_768) &&
    isSafeFileName(value.fileName) &&
    isProjectEnvelope(value.project)
  )
}

function isProjectEnvelope(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.metadata)) return false
  return Boolean(
    isBoundedString(value.metadata.id, 500, true) &&
    isBoundedString(value.metadata.jobName, 10_000, true) &&
    isBoundedString(value.metadata.tool, 100, true)
  )
}

function isExportHistoryEntry(value: unknown): boolean {
  if (!isRecord(value)) return false
  return Boolean(
    isBoundedString(value.id, 500, true) &&
    isBoundedString(value.toolType, 100, true) &&
    isBoundedString(value.projectName, 10_000, true) &&
    isBoundedString(value.exportType, 1000, true) &&
    isValidDate(value.timestamp) &&
    isOneOf(value.status, ['success', 'failed', 'canceled']) &&
    isFiniteNumber(value.warningsCount)
  )
}

function isSafeFileName(value: unknown): value is string {
  return (
    isBoundedString(value, 255, true) &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('\0')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isBoundedString(value: unknown, maxLength: number, required = false): value is string {
  return (
    typeof value === 'string' && value.length <= maxLength && (!required || value.trim().length > 0)
  )
}

function isOptionalBoundedString(value: unknown, maxLength: number): boolean {
  return value === undefined || isBoundedString(value, maxLength)
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 100 && Number.isFinite(Date.parse(value))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isOneOf(value: unknown, options: readonly string[]): value is string {
  return typeof value === 'string' && options.includes(value)
}
