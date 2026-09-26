import type { ShopCustomer } from './customerTypes'

export const CUSTOMER_STORAGE_KEY = 'my-printer-app.customers.v1'
export const CUSTOMER_STORAGE_EVENT = 'my-printer-app:customers-changed'
export const MAX_STORED_CUSTOMERS = 1000

export function readStoredCustomers(): ShopCustomer[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CUSTOMER_STORAGE_KEY) ?? '[]')
    return normalizeStoredCustomers(parsed)
  } catch {
    return []
  }
}

export function writeStoredCustomers(customers: ShopCustomer[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    CUSTOMER_STORAGE_KEY,
    JSON.stringify(normalizeStoredCustomers(customers))
  )
  window.dispatchEvent(new CustomEvent(CUSTOMER_STORAGE_EVENT))
}

export function upsertStoredCustomer(customer: ShopCustomer): ShopCustomer[] {
  const current = readStoredCustomers()
  const next = [customer, ...current.filter((item) => item.id !== customer.id)]
  writeStoredCustomers(next)
  return next
}

export function normalizeStoredCustomers(value: unknown): ShopCustomer[] {
  return Array.isArray(value) ? value.filter(isShopCustomer).slice(0, MAX_STORED_CUSTOMERS) : []
}

export function isShopCustomer(value: unknown): value is ShopCustomer {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ShopCustomer>
  return Boolean(
    isNonEmptyString(item.id) &&
    isNonEmptyString(item.name) &&
    typeof item.phone === 'string' &&
    isNonEmptyString(item.createdAt) &&
    isNonEmptyString(item.updatedAt) &&
    isOptionalString(item.email) &&
    isOptionalString(item.company) &&
    isOptionalString(item.address) &&
    isOptionalString(item.notes)
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}
