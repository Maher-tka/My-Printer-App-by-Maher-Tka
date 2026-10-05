import { useLanguage } from '@/i18n/useLanguage'
import { Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PrinterJob } from '@/jobs/jobTypes'
import { useCustomerStore } from './useCustomerStore'
import type { ShopCustomer } from './customerTypes'

export function CustomerDatabase({ jobs }: { jobs: PrinterJob[] }): JSX.Element {
  const { t } = useLanguage()

  const { customers, saveCustomer, deleteCustomer } = useCustomerStore()
  const [pendingDelete, setPendingDelete] = useState<ShopCustomer | null>(null)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<ShopCustomer>(() => createEmptyCustomer())
  const [message, setMessage] = useState<string | null>(null)
  const isEditing = customers.some((customer) => customer.id === draft.id)
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return customers
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email, customer.company].some((value) =>
        value?.toLowerCase().includes(needle)
      )
    )
  }, [customers, query])
  const customerStats = useMemo(() => {
    const stats = new Map<string, { jobCount: number; balance: number }>()
    const customerIdByPhone = new Map(
      customers
        .filter((customer) => Boolean(customer.phone))
        .map((customer) => [customer.phone, customer.id] as const)
    )

    for (const job of jobs) {
      const customerId = job.customerId ?? customerIdByPhone.get(job.phoneNumber)
      if (!customerId) continue
      const current = stats.get(customerId) ?? { jobCount: 0, balance: 0 }
      current.jobCount += 1
      current.balance += job.quote.remainingAmount
      stats.set(customerId, current)
    }

    return stats
  }, [customers, jobs])

  const save = (): void => {
    if (!draft.name.trim()) return
    const customer = {
      ...draft,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      email: draft.email?.trim(),
      company: draft.company?.trim(),
      address: draft.address?.trim(),
      notes: draft.notes?.trim(),
      updatedAt: new Date().toISOString()
    }
    saveCustomer(customer)
    setDraft(createEmptyCustomer())
    setMessage(isEditing ? `Updated ${customer.name}.` : `Saved ${customer.name}.`)
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
        className="rounded-xl border bg-muted/20 p-4"
      >
        <div className="mb-4 flex items-center gap-2">
          <UserRound className="size-5 text-primary" />
          <h3 className="font-semibold">{isEditing ? 'Edit customer' : 'New customer'}</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <CustomerInput
            label={t('Name')}
            required
            autoComplete="name"
            value={draft.name}
            onChange={(name) => setDraft({ ...draft, name })}
          />
          <CustomerInput
            label={t('Phone')}
            type="tel"
            autoComplete="tel"
            value={draft.phone}
            onChange={(phone) => setDraft({ ...draft, phone })}
          />
          <CustomerInput
            label={t('Email')}
            type="email"
            autoComplete="email"
            value={draft.email ?? ''}
            onChange={(email) => setDraft({ ...draft, email })}
          />
          <CustomerInput
            label={t('Company')}
            autoComplete="organization"
            value={draft.company ?? ''}
            onChange={(company) => setDraft({ ...draft, company })}
          />
          <CustomerInput
            label={t('Address')}
            value={draft.address ?? ''}
            onChange={(address) => setDraft({ ...draft, address })}
          />
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('Notes')}
            <textarea
              className="min-h-20 rounded-md border bg-background p-3 text-sm"
              value={draft.notes ?? ''}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={!draft.name.trim()}>
            <Plus />
            {isEditing ? 'Update' : 'Save customer'}
          </Button>
          {isEditing ? (
            <Button type="button" variant="outline" onClick={() => setDraft(createEmptyCustomer())}>
              {t('Cancel')}
            </Button>
          ) : null}
        </div>
        {message ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </form>

      <section>
        <label className="relative mb-4 block">
          <span className="sr-only">{t('Search customers')}</span>
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
            placeholder={t('Search name, phone, email, or company')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((customer) => {
            const stats = customerStats.get(customer.id) ?? { jobCount: 0, balance: 0 }
            return (
              <article key={customer.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate font-semibold">{customer.name}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {customer.phone || 'No phone'}
                    </p>
                    {customer.company ? (
                      <p className="text-xs text-muted-foreground">{customer.company}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${customer.name}`}
                      onClick={() => {
                        setDraft(structuredClone(customer))
                        setMessage(null)
                        document.querySelector<HTMLInputElement>('[name="customer-name"]')?.focus()
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${customer.name}`}
                      onClick={() => setPendingDelete(customer)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">{stats.jobCount} job(s)</Badge>
                  <Badge variant={stats.balance > 0 ? 'warning' : 'success'}>
                    {t('Balance')} {stats.balance.toFixed(2)}
                  </Badge>
                </div>
                {customer.notes ? (
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                    {customer.notes}
                  </p>
                ) : null}
              </article>
            )
          })}
          {filtered.length === 0 ? (
            <p className="col-span-full rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {customers.length === 0
                ? 'Add your first customer using the form. Their jobs and balance will appear here.'
                : 'No customers match your search.'}
              {query && (
                <Button type="button" variant="ghost" onClick={() => setQuery('')}>
                  {t('Clear search')}
                </Button>
              )}
            </p>
          ) : null}
        </div>
      </section>
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete customer?')}</AlertDialogTitle>
            <AlertDialogDescription>
              Remove “{pendingDelete?.name}” from your customer database? Existing jobs will be
              kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Keep customer')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!pendingDelete) return
                deleteCustomer(pendingDelete.id)
                if (draft.id === pendingDelete.id) setDraft(createEmptyCustomer())
                setMessage(`Deleted ${pendingDelete.name}.`)
                setPendingDelete(null)
              }}
            >
              {t('Delete customer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function createEmptyCustomer(): ShopCustomer {
  const now = new Date().toISOString()
  return {
    id: `customer-${crypto.randomUUID()}`,
    name: '',
    phone: '',
    createdAt: now,
    updatedAt: now
  }
}

function CustomerInput({
  label,
  value,
  onChange,
  ...inputProps
}: {
  label: string
  value: string
  onChange: (value: string) => void
} & Omit<React.ComponentProps<'input'>, 'value' | 'onChange'>): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t(label)}
      <input
        className="h-10 rounded-md border bg-background px-3 text-sm"
        name={`customer-${label.toLowerCase()}`}
        {...inputProps}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
