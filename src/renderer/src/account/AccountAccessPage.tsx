import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AccountMutationResult, AccountSnapshot } from '../../../shared/account-types'
import type { LicenseActivationResult, LicenseSnapshot } from '../../../shared/licensing-types'

type AccessMode = 'create' | 'sign-in' | 'subscription'

interface AccountAccessPageProps {
  accountState: AccountSnapshot | null
  accountIsSubmitting: boolean
  accountError: string | null
  onCreateAccount: (request: {
    displayName: string
    email: string
    password: string
  }) => Promise<AccountMutationResult>
  onSignIn: (request: { email: string; password: string }) => Promise<AccountMutationResult>
  licenseState: LicenseSnapshot | null
  licenseIsLoading: boolean
  licenseIsActivating: boolean
  licenseError: string | null
  onActivateSerial: (serialKey: string) => Promise<LicenseActivationResult>
}

export function AccountAccessPage({
  accountState,
  accountIsSubmitting,
  accountError,
  onCreateAccount,
  onSignIn,
  licenseState,
  licenseIsLoading,
  licenseIsActivating,
  licenseError,
  onActivateSerial
}: AccountAccessPageProps): JSX.Element {
  const [mode, setMode] = useState<AccessMode>(accountState?.accountExists ? 'sign-in' : 'create')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [serialKey, setSerialKey] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (accountState?.accountExists && mode === 'create') {
      setMode('sign-in')
    }
  }, [accountState?.accountExists, mode])

  const isSubmitting = accountIsSubmitting || licenseIsActivating
  const visibleError = formError ?? accountError ?? licenseError
  const trialIsReady = licenseState?.mode === 'trial' && !licenseState.trial.isExpired
  const activeSubscription = licenseState?.mode === 'activated'

  const selectMode = (nextMode: AccessMode): void => {
    setMode(nextMode)
    setFormError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setFormError(null)

    if (mode === 'subscription') {
      const trimmedKey = serialKey.trim()

      if (!trimmedKey) {
        setFormError('Enter your subscription key.')
        return
      }

      const result = await onActivateSerial(trimmedKey)

      if (result.ok) {
        setSerialKey('')
      } else {
        setFormError(result.error ?? 'That subscription key could not be activated.')
      }

      return
    }

    if (mode === 'create') {
      if (password !== confirmPassword) {
        setFormError('The passwords do not match.')
        return
      }

      const result = await onCreateAccount({ displayName, email, password })

      if (result.ok) {
        setPassword('')
        setConfirmPassword('')
      }

      return
    }

    await onSignIn({ email, password })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.16),_transparent_42%),linear-gradient(135deg,_hsl(var(--background)),_hsl(var(--muted)/0.7))] px-4 py-6 sm:px-8 lg:px-12 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1320px] items-stretch overflow-hidden rounded-3xl border bg-card shadow-2xl shadow-slate-900/10 lg:grid-cols-[minmax(0,0.92fr)_minmax(480px,1.08fr)]">
        <section className="relative flex flex-col justify-between overflow-hidden bg-sidebar px-7 py-8 text-sidebar-foreground sm:px-10 sm:py-10 lg:px-12">
          <div className="absolute -right-24 -top-24 size-72 rounded-full border-[36px] border-primary/20" />
          <div className="absolute -bottom-28 -left-20 size-72 rounded-full border-[36px] border-white/5" />

          <div className="relative flex flex-col gap-12">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground shadow-lg shadow-primary/30">
                M
              </div>
              <div>
                <p className="text-lg font-bold leading-tight text-white">My Printer App</p>
                <p className="text-sm text-sidebar-muted">by Maher Tka</p>
              </div>
            </div>

            <div className="relative flex max-w-xl flex-col gap-5">
              <Badge className="w-fit border-white/10 bg-white/10 text-white" variant="outline">
                <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
                Printer-shop workspace
              </Badge>
              <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl">
                Keep every print job moving.
              </h1>
              <p className="max-w-lg text-base leading-7 text-sidebar-foreground/75 sm:text-lg">
                Sign in to open your production workspace, or activate a subscription key to unlock
                the app on this computer.
              </p>
            </div>

            <div className="grid max-w-xl gap-3">
              <AccessBenefit
                icon={BriefcaseBusiness}
                title="One focused workspace"
                detail="Jobs, exports, and production tools in one place."
              />
              <AccessBenefit
                icon={ShieldCheck}
                title="Local-first by design"
                detail="Your project files stay on this computer."
              />
              <AccessBenefit
                icon={BadgeCheck}
                title="Trial or subscription access"
                detail="Start with a free trial or use your Pro/Shop key."
              />
            </div>
          </div>

          <p className="relative mt-12 text-xs text-sidebar-muted">
            Account credentials are stored on this desktop installation.
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-8 sm:px-10 lg:px-14">
          <div className="w-full max-w-lg">
            <div className="mb-8 flex flex-col gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Workspace access
              </p>
              <h2 className="text-3xl font-black tracking-tight text-foreground">
                Welcome to your shop.
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {accountState?.accountExists
                  ? 'Sign in to continue, or use an active subscription key.'
                  : 'Create an account to start the 14-day trial. No card is required.'}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-3 rounded-xl border bg-muted/45 p-1">
              <AccessModeButton
                active={mode === 'create'}
                onClick={() => selectMode('create')}
                icon={UserRound}
              >
                Create account
              </AccessModeButton>
              <AccessModeButton
                active={mode === 'sign-in'}
                onClick={() => selectMode('sign-in')}
                icon={Mail}
              >
                Sign in
              </AccessModeButton>
              <AccessModeButton
                active={mode === 'subscription'}
                onClick={() => selectMode('subscription')}
                icon={KeyRound}
              >
                Subscription
              </AccessModeButton>
            </div>

            <Card className="border-0 shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-xl">
                  {mode === 'create'
                    ? 'Create your account'
                    : mode === 'sign-in'
                      ? 'Sign in to continue'
                      : 'Activate subscription'}
                </CardTitle>
                <CardDescription>
                  {mode === 'create'
                    ? 'Your account keeps access simple on this computer.'
                    : mode === 'sign-in'
                      ? 'Use the email and password you created for this workspace.'
                      : 'Use the Pro or Shop key you received with your subscription.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                  {mode === 'create' && (
                    <FormField
                      id="account-display-name"
                      label="Your name"
                      value={displayName}
                      onChange={setDisplayName}
                      placeholder="Maher Tka"
                      icon={UserRound}
                      autoComplete="name"
                    />
                  )}

                  {mode !== 'subscription' && (
                    <FormField
                      id="account-email"
                      label="Email address"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      placeholder="you@printshop.com"
                      icon={Mail}
                      autoComplete="email"
                    />
                  )}

                  {mode !== 'subscription' && (
                    <FormField
                      id="account-password"
                      label="Password"
                      type="password"
                      value={password}
                      onChange={setPassword}
                      placeholder="At least 8 characters"
                      icon={LockKeyhole}
                      autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                    />
                  )}

                  {mode === 'create' && (
                    <FormField
                      id="account-confirm-password"
                      label="Confirm password"
                      type="password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Repeat your password"
                      icon={LockKeyhole}
                      autoComplete="new-password"
                    />
                  )}

                  {mode === 'subscription' && (
                    <FormField
                      id="subscription-key"
                      label="Subscription key"
                      value={serialKey}
                      onChange={(value) => setSerialKey(value.toUpperCase().replace(/[–—]/g, '-'))}
                      placeholder="MPTK-PRO-LIFE-ABC123-SIGNATURE"
                      icon={KeyRound}
                      autoComplete="off"
                      spellCheck={false}
                      inputClassName="font-mono uppercase"
                    />
                  )}

                  {visibleError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                      {visibleError}
                    </div>
                  )}

                  <Button className="mt-2 h-12 w-full" disabled={isSubmitting} type="submit">
                    {mode === 'subscription' ? (
                      <KeyRound data-icon="inline-start" />
                    ) : (
                      <ShieldCheck data-icon="inline-start" />
                    )}
                    {isSubmitting
                      ? mode === 'subscription'
                        ? 'Activating…'
                        : mode === 'create'
                          ? 'Creating account…'
                          : 'Signing in…'
                      : mode === 'subscription'
                        ? 'Activate and open app'
                        : mode === 'create'
                          ? 'Create account and start trial'
                          : 'Sign in and open app'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <AccessStatusCard
                label="Trial access"
                value={licenseIsLoading ? 'Checking…' : trialIsReady ? 'Ready' : 'Unavailable'}
                detail={trialIsReady ? '14 days on this computer' : 'Create an account to begin'}
                active={Boolean(trialIsReady)}
              />
              <AccessStatusCard
                label="Subscription"
                value={activeSubscription ? 'Active' : 'Pro or Shop key'}
                detail={
                  activeSubscription
                    ? (licenseState?.planLabel ?? 'Activated')
                    : 'Already subscribed? Use the key above'
                }
                active={Boolean(activeSubscription)}
              />
            </div>

            <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs leading-5 text-muted-foreground">
              <LockKeyhole className="size-3.5" aria-hidden="true" />
              Local access is protected by the desktop app. Subscription keys are verified locally.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

function AccessBenefit({
  icon: Icon,
  title,
  detail
}: {
  icon: typeof BriefcaseBusiness
  title: string
  detail: string
}): JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/20 text-primary-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-sidebar-muted">{detail}</p>
      </div>
    </div>
  )
}

function AccessModeButton({
  active,
  onClick,
  icon: Icon,
  children
}: {
  active: boolean
  onClick: () => void
  icon: typeof UserRound
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 text-center text-[11px] font-semibold transition sm:flex-row sm:gap-1.5 sm:text-xs',
        active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </button>
  )
}

function FormField({
  id,
  label,
  value,
  onChange,
  placeholder,
  icon: Icon,
  type = 'text',
  autoComplete,
  spellCheck,
  inputClassName
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  icon: typeof UserRound
  type?: string
  autoComplete?: string
  spellCheck?: boolean
  inputClassName?: string
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            'h-12 w-full rounded-lg border border-input bg-card pl-10 pr-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20',
            inputClassName
          )}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={spellCheck}
        />
      </div>
    </div>
  )
}

function AccessStatusCard({
  label,
  value,
  detail,
  active
}: {
  label: string
  value: string
  detail: string
  active: boolean
}): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-xl border p-3.5',
        active ? 'border-success/60 bg-success/40' : 'bg-muted/35'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {active ? <Check className="size-4 text-success-foreground" aria-hidden="true" /> : null}
      </div>
      <p className="mt-2 text-sm font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  )
}
