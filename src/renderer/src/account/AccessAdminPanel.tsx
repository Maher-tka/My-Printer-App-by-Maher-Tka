import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription
} from '@/components/ui/alert-dialog'
import type {
  AccessAdminSnapshot,
  AdminAccessAction,
  AccessPlan
} from '../../../shared/account-types'

export function AccessAdminPanel(): JSX.Element {
  const [data, setData] = useState<AccessAdminSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selection, setSelection] = useState<AdminAccessAction | null>(null)
  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      if (!window.printerApp?.account) throw new Error('The owner service is unavailable.')
      setData(await window.printerApp.account.adminList())
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not load accounts.')
    } finally {
      setBusy(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])
  const open = (
    action: AdminAccessAction['action'],
    userId: string,
    requestId?: string,
    plan: AccessPlan = 'shop'
  ): void => {
    setNotice(null)
    setSelection({
      action,
      userId,
      requestId,
      plan,
      days: action === 'trial' ? 14 : 30,
      reason: ''
    })
  }
  const decide = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!selection) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (!window.printerApp?.account) throw new Error('The owner service is unavailable.')
      const result = await window.printerApp.account.adminAction(selection)
      if (!result.ok) throw new Error(result.error ?? 'Could not save your decision.')
      setSelection(null)
      setNotice('Decision saved.')
      await refresh()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not save your decision.')
    } finally {
      setBusy(false)
    }
  }
  const disabled = busy || Boolean(error)
  const pending = data?.requests.filter((request) => request.status === 'pending') ?? []
  const customerName = (id: string): string =>
    data?.customers.find((customer) => customer.id === id)?.email ?? id
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {pending.length} pending requests · {data?.customers.length ?? 0} accounts
        </p>
        <Button variant="outline" disabled={busy} onClick={() => void refresh()}>
          Refresh inbox
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      )}
      {data?.hasMore && (
        <p role="status" className="text-sm text-muted-foreground">
          This pilot screen shows up to 1,000 records per list. Use Supabase Studio to review older
          records.
        </p>
      )}
      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Pending requests</h2>
        {data && !pending.length && (
          <p className="mt-3 text-sm text-muted-foreground">No requests awaiting review.</p>
        )}
        {!data && busy && (
          <p role="status" className="mt-3 text-sm">
            Loading requests…
          </p>
        )}
        <div className="mt-4 grid gap-4">
          {pending.map((request) => (
            <article key={request.id} className="rounded-lg border p-4">
              <h3 className="font-medium">{request.shop_name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {customerName(request.user_id)} · {request.requested_plan} ·{' '}
                {new Date(request.created_at).toLocaleString()}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                {request.message || 'No message supplied.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={disabled}
                  onClick={() =>
                    open('approve', request.user_id, request.id, request.requested_plan)
                  }
                >
                  Approve
                </Button>
                <Button
                  disabled={disabled}
                  variant="outline"
                  onClick={() => open('trial', request.user_id, request.id, request.requested_plan)}
                >
                  Give trial
                </Button>
                <Button
                  disabled={disabled}
                  variant="outline"
                  onClick={() => open('deny', request.user_id, request.id, request.requested_plan)}
                >
                  Deny
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Accounts and access</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">Customer</th>
                <th className="p-3">Access</th>
                <th className="p-3">Ends</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.customers.map((customer) => {
                const grant = data.grants.find((item) => item.user_id === customer.id)
                const status =
                  grant?.status === 'revoked'
                    ? 'Revoked'
                    : grant
                      ? Date.parse(grant.ends_at) <= Date.now()
                        ? 'Expired'
                        : `${grant.plan} · ${grant.status}`
                      : 'No access'
                return (
                  <tr key={customer.id} className="border-b last:border-0">
                    <td className="p-3">
                      <p className="font-medium">{customer.display_name}</p>
                      <p className="text-muted-foreground">{customer.email}</p>
                    </td>
                    <td className="p-3">{status}</td>
                    <td className="p-3">
                      {grant ? new Date(grant.ends_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() => open('grant', customer.id, undefined, grant?.plan)}
                        >
                          Grant / reinstate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() => open('trial', customer.id, undefined, grant?.plan)}
                        >
                          Trial
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={disabled || !grant || grant.status === 'revoked'}
                          onClick={() => open('extend', customer.id, undefined, grant?.plan)}
                        >
                          Extend
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={disabled || grant?.status === 'revoked'}
                          onClick={() => open('revoke', customer.id, undefined, grant?.plan)}
                        >
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Recent decisions</h2>
        <div className="mt-4 grid gap-2">
          {data?.audit.slice(0, 20).map((entry) => (
            <p key={entry.id} className="break-words text-sm text-muted-foreground">
              {new Date(entry.created_at).toLocaleString()} · {customerName(entry.user_id)} ·{' '}
              {entry.action.replace('printer_access_', '')}
            </p>
          ))}
        </div>
      </section>
      <AlertDialog
        open={Boolean(selection)}
        onOpenChange={(open) => {
          if (!open && !busy) setSelection(null)
        }}
      >
        {selection && (
          <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
            <form onSubmit={decide}>
              <AlertDialogTitle>
                {selection.action === 'revoke'
                  ? 'Revoke access'
                  : selection.action === 'deny'
                    ? 'Deny request'
                    : selection.action === 'trial'
                      ? 'Give a trial'
                      : selection.action === 'extend'
                        ? 'Extend access'
                        : 'Grant access'}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 break-words">
                {customerName(selection.userId)}
              </AlertDialogDescription>
              <fieldset disabled={busy} className="mt-4 grid gap-4">
                {!['deny', 'revoke'].includes(selection.action) && (
                  <>
                    {selection.action !== 'extend' && (
                      <label className="grid gap-2 text-sm">
                        Plan
                        <select
                          autoFocus
                          className="h-10 rounded-md border bg-background px-3"
                          value={selection.plan}
                          onChange={(e) =>
                            setSelection({ ...selection, plan: e.target.value as AccessPlan })
                          }
                        >
                          <option value="pro">Pro</option>
                          <option value="shop">Shop</option>
                        </select>
                      </label>
                    )}
                    <label className="grid gap-2 text-sm">
                      {selection.action === 'extend' ? 'Additional days' : 'Access duration (days)'}
                      <input
                        className="h-10 rounded-md border bg-background px-3"
                        type="number"
                        required
                        min={1}
                        max={3650}
                        step={1}
                        value={selection.days}
                        onChange={(e) =>
                          setSelection({ ...selection, days: Number(e.target.value) })
                        }
                      />
                    </label>
                  </>
                )}
                {selection.action === 'revoke' && (
                  <p className="text-sm">
                    New prints and exports will be blocked after the next online check. Saved
                    projects remain available.
                  </p>
                )}
                <label className="grid gap-2 text-sm">
                  Reason / note
                  <textarea
                    className="min-h-24 rounded-md border bg-background p-3"
                    maxLength={1000}
                    value={selection.reason}
                    onChange={(e) => setSelection({ ...selection, reason: e.target.value })}
                  />
                </label>
              </fieldset>
              {error && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setSelection(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save decision'}
                </Button>
              </div>
            </form>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  )
}
