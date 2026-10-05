import { useLanguage } from '@/i18n/useLanguage'
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
import type { SubscriptionPlanRecord } from '../../../shared/account-types'
import { SUBSCRIPTION_TOOLS, type SubscriptionToolId } from '../../../shared/subscription-tools'

function ToolChecklist({
  value,
  onChange
}: {
  value: SubscriptionToolId[]
  onChange: (tools: SubscriptionToolId[]) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SUBSCRIPTION_TOOLS.map((tool) => (
        <label key={tool.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.includes(tool.id)}
            onChange={(event) =>
              onChange(
                event.target.checked ? [...value, tool.id] : value.filter((id) => id !== tool.id)
              )
            }
          />
          {t(tool.label)}
        </label>
      ))}
    </div>
  )
}

function PlanEditor({
  plan,
  disabled,
  onSave
}: {
  plan: SubscriptionPlanRecord
  disabled: boolean
  onSave: (value: SubscriptionPlanRecord) => Promise<void>
}): JSX.Element {
  const { t } = useLanguage()

  const [draft, setDraft] = useState(plan)
  const persistedTools = plan.tool_ids.join(',')
  useEffect(
    () =>
      setDraft({
        plan: plan.plan,
        tool_ids: [...plan.tool_ids],
        batch_exports: plan.batch_exports
      }),
    [plan.plan, persistedTools, plan.batch_exports]
  )
  const changed =
    draft.batch_exports !== plan.batch_exports ||
    SUBSCRIPTION_TOOLS.some(
      (tool) => draft.tool_ids.includes(tool.id) !== plan.tool_ids.includes(tool.id)
    )
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void onSave(draft)
      }}
      className="rounded-lg border p-4"
    >
      <h3 className="mb-4 font-semibold">{plan.plan === 'pro' ? 'Pro' : 'Shop'}</h3>
      <fieldset disabled={disabled} className="grid gap-4">
        <ToolChecklist
          value={draft.tool_ids}
          onChange={(tool_ids) => setDraft({ ...draft, tool_ids })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.batch_exports}
            onChange={(event) => setDraft({ ...draft, batch_exports: event.target.checked })}
          />
          Batch exports
        </label>
        <Button type="submit" disabled={!changed}>
          {t('Save')} {plan.plan === 'pro' ? 'Pro' : 'Shop'} plan
        </Button>
      </fieldset>
    </form>
  )
}

export function AccessAdminPanel(): JSX.Element {
  const { t } = useLanguage()

  const [data, setData] = useState<AccessAdminSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selection, setSelection] = useState<AdminAccessAction | null>(null)
  const [search, setSearch] = useState('')
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
    const grant = data?.grants.find((item) => item.user_id === userId)
    setSelection({
      action,
      userId,
      requestId,
      plan,
      days: action === 'trial' ? 14 : 30,
      reason: '',
      toolIds: grant?.tool_ids ?? null,
      batchExports: grant?.batch_exports ?? null
    })
  }
  const savePlan = async (plan: SubscriptionPlanRecord): Promise<void> => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (!window.printerApp?.account?.adminPlan)
        throw new Error('The plan service is unavailable.')
      const result = await window.printerApp.account.adminPlan(plan)
      if (!result.ok) throw new Error(result.error ?? 'Could not save the plan.')
      setNotice(
        'Plan saved. Customers following this plan receive the new tools on their next online check.'
      )
      await refresh()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not save the plan.')
    } finally {
      setBusy(false)
    }
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
          {t('Refresh inbox')}
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
        <h2 className="text-lg font-semibold">{t('Subscription plans and tools')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose the tools included in Pro and Shop. Trials use their selected plan. Changes apply
          to current and future customers following the plan; custom customer tool lists stay as
          configured.
        </p>
        {data && !data.plans && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            Install the subscription controls database migration to edit plans.
          </p>
        )}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {data?.plans?.map((plan) => (
            <PlanEditor key={plan.plan} plan={plan} disabled={disabled} onSave={savePlan} />
          ))}
        </div>
      </section>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">{t('Pending requests')}</h2>
        {data && !pending.length && (
          <p className="mt-3 text-sm text-muted-foreground">{t('No requests awaiting review.')}</p>
        )}
        {!data && busy && (
          <p role="status" className="mt-3 text-sm">
            {t('Loading requests…')}
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
                  {t('Approve')}
                </Button>
                <Button
                  disabled={disabled}
                  variant="outline"
                  onClick={() => open('trial', request.user_id, request.id, request.requested_plan)}
                >
                  {t('Give trial')}
                </Button>
                <Button
                  disabled={disabled}
                  variant="outline"
                  onClick={() => open('deny', request.user_id, request.id, request.requested_plan)}
                >
                  {t('Deny')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">{t('Accounts and access')}</h2>
        <label className="mt-4 grid max-w-md gap-2 text-sm">
          {t('Find a customer')}
          <input
            type="search"
            className="h-10 rounded-md border bg-background px-3"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Name or email')}
          />
        </label>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">{t('Customer')}</th>
                <th className="p-3">{t('Access')}</th>
                <th className="p-3">{t('Ends')}</th>
                <th className="p-3">{t('Tools')}</th>
                <th className="p-3">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.customers
                .filter((customer) =>
                  `${customer.display_name} ${customer.email}`
                    .toLowerCase()
                    .includes(search.trim().toLowerCase())
                )
                .map((customer) => {
                  const grant = data.grants.find((item) => item.user_id === customer.id)
                  const plan = data.plans?.find((item) => item.plan === grant?.plan)
                  const included = grant?.tool_ids ?? plan?.tool_ids ?? []
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
                        {grant ? (
                          <>
                            <p>
                              {grant.tool_ids == null ? 'Follows plan' : 'Custom tools'} ·{' '}
                              {included.length} tools
                            </p>
                            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                              {SUBSCRIPTION_TOOLS.filter((tool) => included.includes(tool.id))
                                .map((tool) => tool.label)
                                .join(', ') || 'No tools included'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Batch exports:{' '}
                              {(grant.batch_exports ?? plan?.batch_exports)
                                ? 'Included'
                                : 'Excluded'}
                            </p>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled || !grant || !data.plans}
                            onClick={() => open('manage', customer.id, undefined, grant?.plan)}
                          >
                            {t('Manage subscription')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => open('grant', customer.id, undefined, grant?.plan)}
                          >
                            {t('Grant / reinstate')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => open('trial', customer.id, undefined, grant?.plan)}
                          >
                            {t('Trial')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled || !grant || grant.status === 'revoked'}
                            onClick={() => open('extend', customer.id, undefined, grant?.plan)}
                          >
                            {t('Extend')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled || !grant || grant.status === 'revoked'}
                            onClick={() => open('revoke', customer.id, undefined, grant?.plan)}
                          >
                            {t('Revoke')}
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
        <h2 className="font-semibold">{t('Recent decisions')}</h2>
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
                  : selection.action === 'manage'
                    ? t('Manage subscription')
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
                        {t('Plan')}
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
                    {selection.action !== 'manage' && (
                      <label className="grid gap-2 text-sm">
                        {selection.action === 'extend'
                          ? 'Additional days'
                          : 'Access duration (days)'}
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
                    )}
                  </>
                )}
                {selection.action === 'revoke' && (
                  <p className="text-sm">
                    New prints and exports will be blocked after the next online check. Saved
                    projects remain available.
                  </p>
                )}
                {selection.action === 'manage' && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      The current expiry date and access status stay the same. Managing a revoked
                      subscription does not reinstate it.
                    </p>
                    <label className="grid gap-2 text-sm">
                      {t('Tool access')}
                      <select
                        className="h-10 rounded-md border bg-background px-3"
                        value={selection.toolIds == null ? 'plan' : 'custom'}
                        onChange={(event) =>
                          setSelection({
                            ...selection,
                            toolIds:
                              event.target.value === 'plan'
                                ? null
                                : [
                                    ...(data?.plans?.find((plan) => plan.plan === selection.plan)
                                      ?.tool_ids ?? [])
                                  ]
                          })
                        }
                      >
                        <option value="plan">Follow selected plan</option>
                        <option value="custom">{t('Custom tools for this customer')}</option>
                      </select>
                    </label>
                    {selection.toolIds != null && (
                      <ToolChecklist
                        value={selection.toolIds}
                        onChange={(toolIds) => setSelection({ ...selection, toolIds })}
                      />
                    )}
                    <label className="grid gap-2 text-sm">
                      Batch exports
                      <select
                        className="h-10 rounded-md border bg-background px-3"
                        value={
                          selection.batchExports == null
                            ? 'plan'
                            : selection.batchExports
                              ? 'allow'
                              : 'deny'
                        }
                        onChange={(event) =>
                          setSelection({
                            ...selection,
                            batchExports:
                              event.target.value === 'plan' ? null : event.target.value === 'allow'
                          })
                        }
                      >
                        <option value="plan">Follow selected plan</option>
                        <option value="allow">{t('Include for this customer')}</option>
                        <option value="deny">{t('Exclude for this customer')}</option>
                      </select>
                    </label>
                  </>
                )}
                <label className="grid gap-2 text-sm">
                  {t('Reason / note')}
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
                  {t('Cancel')}
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
