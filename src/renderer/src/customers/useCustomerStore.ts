import { useCallback, useEffect, useState } from 'react'
import {
  CUSTOMER_STORAGE_EVENT,
  readStoredCustomers,
  upsertStoredCustomer,
  writeStoredCustomers
} from './customerStorage'
import type { ShopCustomer } from './customerTypes'

export function useCustomerStore(): {
  customers: ShopCustomer[]
  saveCustomer: (customer: ShopCustomer) => void
  deleteCustomer: (customerId: string) => void
  refreshCustomers: () => void
} {
  const [customers, setCustomers] = useState<ShopCustomer[]>(readStoredCustomers)

  useEffect(() => {
    const refresh = (): void => setCustomers(readStoredCustomers())
    window.addEventListener(CUSTOMER_STORAGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(CUSTOMER_STORAGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const saveCustomer = useCallback((customer: ShopCustomer): void => {
    setCustomers(upsertStoredCustomer({ ...customer, updatedAt: new Date().toISOString() }))
  }, [])

  const deleteCustomer = useCallback((customerId: string): void => {
    setCustomers((current) => {
      const next = current.filter((customer) => customer.id !== customerId)
      writeStoredCustomers(next)
      return next
    })
  }, [])

  const refreshCustomers = useCallback((): void => setCustomers(readStoredCustomers()), [])

  return { customers, saveCustomer, deleteCustomer, refreshCustomers }
}
