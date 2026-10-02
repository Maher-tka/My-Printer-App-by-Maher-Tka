import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Printer,
  Check,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/appearance/ThemeToggle'
import { EmailAccountHelp } from './EmailAccountHelp'
import './AccountAccessPage.css'
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
  onSignInGoogle?: () => Promise<AccountMutationResult>
  onRefreshAccount?: () => Promise<void>
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
  onSignInGoogle,
  onRefreshAccount,
  licenseState,
  licenseIsLoading,
  licenseIsActivating,
  licenseError,
  onActivateSerial
}: AccountAccessPageProps): JSX.Element {
  const cloudMode = Boolean(accountState?.cloud)
  const [mode, setMode] = useState<AccessMode>(
    cloudMode || accountState?.accountExists ? 'sign-in' : 'create'
  )
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [serialKey, setSerialKey] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

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
    setMessage(null)
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
        setMessage(result.message ?? null)
        if (cloudMode && result.state.status === 'signed-out') setMode('sign-in')
      } else {
        setFormError(result.error ?? 'Your account could not be created. Please try again.')
      }

      return
    }

    const result = await onSignIn({ email, password })
    if (!result.ok) {
      setFormError(result.error ?? 'Sign-in was unsuccessful. Please try again.')
    }
  }

  return (
    <main className="atelier-access">
      <div className="atelier-access__frame">
        <section className="atelier-access__story" aria-label="Your print workspace">
          <div className="flex items-center justify-between gap-4">
            <a className="atelier-access__brand" href="#workspace-access">
              <span className="atelier-access__brand-mark">
                <Printer size={23} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span>
                <strong>My Printer App</strong>
                <small>BY MAHER TKA</small>
              </span>
            </a>
            <ThemeToggle />
          </div>
          <div className="atelier-access__intro">
            <p className="atelier-access__eyebrow">
              <span /> Print production workspace
            </p>
            <h1>
              One workspace.
              <br />
              Every print detail.
            </h1>
            <p>
              A little less busywork. A lot more making.
              <br />
              Your entire print shop, in one thoughtful workspace.
            </p>
          </div>
          <div className="atelier-access__story-footer">
            <span>
              <ShieldCheck size={15} aria-hidden="true" /> Local-first. Made for your shop.
            </span>
            <span>My Printer App by Maher Tka</span>
          </div>
        </section>

        <section className="atelier-access__entry" id="workspace-access">
          <div className="atelier-access__form-wrap">
            <p className="atelier-access__eyebrow">Workspace access</p>
            <h2>
              {mode === 'create'
                ? 'Create your account'
                : mode === 'sign-in'
                  ? 'Welcome back'
                  : 'Activate subscription'}
            </h2>
            <p className="atelier-access__description">
              {mode === 'create'
                ? cloudMode
                  ? 'Create an account, then request access or a trial from Maher. No payment needed.'
                  : 'Create your local account and explore your workspace with a 14-day trial. No card needed.'
                : mode === 'sign-in'
                  ? cloudMode
                    ? 'Sign in to check your access or send a request to Maher.'
                    : 'Welcome back. Sign in to your workspace on this computer.'
                  : 'Unlock your production tools with your Pro or Shop subscription key.'}
            </p>

            <div className="atelier-access__modes" aria-label="Access options">
              <AccessModeButton
                active={mode === 'create'}
                onClick={() => selectMode('create')}
                disabled={isSubmitting}
                icon={UserRound}
              >
                Create account
              </AccessModeButton>
              <AccessModeButton
                active={mode === 'sign-in'}
                onClick={() => selectMode('sign-in')}
                disabled={isSubmitting}
                icon={Mail}
              >
                Sign in
              </AccessModeButton>
              {!cloudMode && (
                <AccessModeButton
                  active={mode === 'subscription'}
                  onClick={() => selectMode('subscription')}
                  disabled={isSubmitting}
                  icon={KeyRound}
                >
                  Subscription
                </AccessModeButton>
              )}
            </div>

            {cloudMode && onSignInGoogle && (
              <Button
                variant="outline"
                className="mb-4 w-full"
                disabled={isSubmitting || !accountState?.cloud?.configured}
                onClick={async () => {
                  setFormError(null)
                  setMessage(null)
                  const result = await onSignInGoogle()
                  if (!result.ok) setFormError(result.error ?? 'Google sign-in failed.')
                }}
              >
                Continue with Google
              </Button>
            )}
            {cloudMode && !accountState?.cloud?.configured && (
              <p role="status" className="mb-4 text-sm text-muted-foreground">
                Online accounts need setup. The owner must connect the Supabase backend before
                customers can sign in.
              </p>
            )}
            <form className="atelier-access__form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
              <fieldset disabled={isSubmitting}>
                <legend className="sr-only">
                  {mode === 'create'
                    ? 'Create your account'
                    : mode === 'sign-in'
                      ? 'Sign in to continue'
                      : 'Activate subscription'}
                </legend>
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
                    placeholder={
                      mode === 'create' ? 'At least 8 characters' : 'Enter your password'
                    }
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
                    onChange={(value) =>
                      setSerialKey(value.toUpperCase().replace(/[\u2013\u2014]/g, '-'))
                    }
                    placeholder="MPTK-PRO-LIFE-ABC123-SIGNATURE"
                    icon={KeyRound}
                    autoComplete="off"
                    spellCheck={false}
                    inputClassName="font-mono uppercase"
                  />
                )}
              </fieldset>
              {visibleError && (
                <div className="atelier-access__error" role="alert">
                  {visibleError}
                </div>
              )}
              {message && (
                <p role="status" className="text-sm text-primary">
                  {message}
                </p>
              )}
              <Button className="atelier-access__submit" disabled={isSubmitting} type="submit">
                <span>
                  {isSubmitting
                    ? mode === 'subscription'
                      ? 'Activating…'
                      : mode === 'create'
                        ? 'Creating account…'
                        : 'Signing in…'
                    : mode === 'subscription'
                      ? 'Activate and open app'
                      : mode === 'create'
                        ? cloudMode
                          ? 'Create account'
                          : 'Create account and start trial'
                        : 'Sign in and open app'}
                </span>
                {isSubmitting ? (
                  <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
                ) : (
                  <ArrowRight size={18} aria-hidden="true" />
                )}
              </Button>
            </form>
            {cloudMode && accountState?.cloud?.configured && (
              <EmailAccountHelp onRefresh={onRefreshAccount} />
            )}
            {cloudMode && isSubmitting && (
              <Button
                variant="ghost"
                className="mt-2"
                onClick={() => void window.printerApp?.account.cancelGoogle()}
              >
                Cancel Google sign-in
              </Button>
            )}

            {!cloudMode && (
              <div className="atelier-access__statuses">
                <AccessStatusCard
                  label="Trial access"
                  value={
                    licenseIsLoading
                      ? 'Checking…'
                      : trialIsReady
                        ? 'Ready to explore'
                        : 'Unavailable'
                  }
                  detail={
                    trialIsReady ? '14-day trial on this computer' : 'Create an account to begin'
                  }
                  active={Boolean(trialIsReady)}
                />
                <AccessStatusCard
                  label="Subscription"
                  value={activeSubscription ? 'Active' : 'Pro & Shop'}
                  detail={
                    activeSubscription
                      ? (licenseState?.planLabel ?? 'Activated')
                      : 'Activate with your subscription key'
                  }
                  active={Boolean(activeSubscription)}
                />
              </div>
            )}
            <p className="atelier-access__privacy">
              <LockKeyhole size={13} aria-hidden="true" />{' '}
              {cloudMode ? (
                'Accounts are managed online. Your print projects stay on this computer.'
              ) : (
                <>
                  Account credentials stay on this installation.
                  <br />
                  Subscription keys are verified locally.
                </>
              )}
            </p>
          </div>
          <div className="atelier-access__entry-footer">
            <span>Print production workspace</span>
            <span>MAHER TKA · {new Date().getFullYear()}</span>
          </div>
        </section>
      </div>
    </main>
  )
}

function AccessModeButton({
  active,
  onClick,
  disabled,
  icon: Icon,
  children
}: {
  active: boolean
  onClick: () => void
  disabled: boolean
  icon: typeof UserRound
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn('atelier-access__mode', active && 'is-active')}
    >
      <Icon size={14} aria-hidden="true" />
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
  const [showPassword, setShowPassword] = useState(false)
  return (
    <div className="atelier-access__field">
      <label htmlFor={id}>{label}</label>
      <div className="atelier-access__input-wrap">
        <Icon className="atelier-access__input-icon" size={16} aria-hidden="true" />
        <input
          id={id}
          name={id}
          type={type === 'password' && showPassword ? 'text' : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(type === 'password' && 'atelier-access__password', inputClassName)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={spellCheck}
        />
        {type === 'password' && (
          <button
            type="button"
            className="atelier-access__reveal"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={`${showPassword ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
          </button>
        )}
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
    <div className="atelier-access__status">
      <p>
        {label}
        {active && <Check size={13} aria-hidden="true" />}
      </p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  )
}
