import { useLanguage } from '@/i18n/useLanguage'
import { useState, type FormEvent } from 'react'
import { RefreshCw, LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/appearance/ThemeToggle'
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher'
import { AccessAdminPanel } from './AccessAdminPanel'
import type { AccountSnapshot, AccessPlan, CloudAccessStatus } from '../../../shared/account-types'
import { SUBSCRIPTION_TOOLS } from '../../../shared/subscription-tools'

const labels: Record<CloudAccessStatus, string> = {
  none: 'Request workspace access',
  pending: 'Your request is awaiting review',
  denied: 'Your request was denied',
  trial: 'Your trial is active',
  active: 'Your access is active',
  expired: 'Your access has expired',
  revoked: 'Your access was revoked',
  unavailable: 'We could not check your access'
}

export function AccessRequestPage({
  state,
  onRefresh,
  onSignOut,
  fullPage = false
}: {
  state: AccountSnapshot | null
  onRefresh: () => Promise<void>
  onSignOut: () => void
  fullPage?: boolean
}): JSX.Element {
  const { t } = useLanguage()

  const [shopName, setShopName] = useState('')
  const [message, setMessage] = useState('')
  const [plan, setPlan] = useState<AccessPlan>('shop')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const cloud = state?.cloud
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (!window.printerApp?.account) throw new Error('Open the desktop app to request access.')
      const result = await window.printerApp.account.requestAccess({ shopName, message, plan })
      if (!result.ok) throw new Error(result.error ?? 'Could not send your request.')
      setNotice(result.message ?? 'Request sent.')
      await onRefresh()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not send your request.')
    } finally {
      setBusy(false)
    }
  }
  const content = (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">My Printer App · {state?.profile?.email}</p>
          <h1 className="mt-1 text-2xl font-semibold">
            {cloud?.isAdmin
              ? t('Manage workspace access')
              : t(labels[cloud?.status ?? 'unavailable'])}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {fullPage && (
            <>
              <ThemeToggle />
              <LanguageSwitcher />
            </>
          )}
          <Button variant="outline" disabled={busy} onClick={() => void onRefresh()}>
            <RefreshCw className="mr-2 size-4" />
            {t('Refresh')}
          </Button>
          <Button variant="ghost" onClick={onSignOut}>
            <LogOut className="mr-2 size-4" />
            {t('Sign out')}
          </Button>
        </div>
      </header>
      {cloud?.error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-card p-4 text-sm text-destructive"
        >
          {cloud.error}
        </p>
      )}
      {!cloud?.configured && (
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Online access needs setup</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect the Supabase backend before customers can sign in or send requests. See the
            setup guide in the project’s docs folder.
          </p>
        </div>
      )}
      {cloud?.isAdmin ? (
        <AccessAdminPanel />
      ) : (
        <>
          {cloud?.grant && (
            <section className="rounded-xl border bg-card p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-5" />
                {cloud.grant.plan === 'shop' ? 'Shop' : 'Pro'} access
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {cloud.grant.status === 'revoked'
                  ? 'Access has been revoked by the owner.'
                  : `Ends ${new Date(cloud.grant.ends_at).toLocaleString()}`}
              </p>
              {cloud.grant.reason && <p className="mt-2 text-sm">{cloud.grant.reason}</p>}
              {cloud.allowedTools && (
                <div className="mt-4 text-sm">
                  <h3 className="font-medium">{t('Tools included in your subscription')}</h3>
                  <p className="mt-2 text-muted-foreground">
                    {SUBSCRIPTION_TOOLS.filter((tool) => cloud.allowedTools!.includes(tool.id))
                      .map((tool) => tool.label)
                      .join(' · ') || 'No tools included. Contact Maher to change access.'}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Batch exports: {cloud.batchExports ? 'Included' : 'Excluded'}
                  </p>
                </div>
              )}
            </section>
          )}
          {cloud?.request && (
            <section className="rounded-xl border bg-card p-6">
              <h2 className="font-semibold">
                {t('Latest request:')} {cloud.request.status}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {cloud.request.shop_name} · {new Date(cloud.request.created_at).toLocaleString()}
              </p>
              {cloud.request.decision_reason && (
                <p className="mt-2 text-sm">{cloud.request.decision_reason}</p>
              )}
              {cloud.request.status === 'pending' && (
                <p className="mt-2 text-sm">
                  {t('Maher will review your request. This page updates automatically.')}
                </p>
              )}
            </section>
          )}
          {cloud?.configured && state?.status === 'signed-in' && (
            <form onSubmit={submit} className="rounded-xl border bg-card p-6">
              <h2 className="font-semibold">
                {cloud.grant ? 'Request an extension or a change' : 'Request access or a trial'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('Tell Maher about your shop and the access you need. No payment is required.')}
              </p>
              <fieldset
                disabled={
                  busy || cloud.request?.status === 'pending' || cloud.status === 'unavailable'
                }
                className="mt-4 grid gap-4"
              >
                <label className="grid gap-2 text-sm">
                  {t('Shop name')}
                  <input
                    className="h-10 rounded-md border bg-background px-3"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  {t('Requested plan')}
                  <select
                    className="h-10 rounded-md border bg-background px-3"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as AccessPlan)}
                  >
                    <option value="pro">Pro</option>
                    <option value="shop">Shop</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  {t('Message')}
                  <textarea
                    className="min-h-24 rounded-md border bg-background p-3"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                    placeholder="I’d like a 14-day trial for my print shop…"
                  />
                </label>
                <Button type="submit" className="justify-self-start">
                  {busy
                    ? 'Sending…'
                    : cloud.request?.status === 'pending'
                      ? 'Request pending'
                      : 'Send request'}
                </Button>
              </fieldset>
              {error && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="mt-3 text-sm text-primary">
                  {notice}
                </p>
              )}
            </form>
          )}
        </>
      )}
    </div>
  )
  return fullPage ? (
    <main className="min-h-screen bg-background p-6 lg:p-12">{content}</main>
  ) : (
    content
  )
}
