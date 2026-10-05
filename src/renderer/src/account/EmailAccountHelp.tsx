import { useLanguage } from '@/i18n/useLanguage'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'

export function EmailAccountHelp({ onRefresh }: { onRefresh?: () => Promise<void> }): JSX.Element {
  const { t } = useLanguage()

  const [mode, setMode] = useState<'verify' | 'recover' | null>(null)
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const action = async (
    work: () => Promise<{ ok: boolean; error?: string; message?: string }>
  ): Promise<void> => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await work()
      if (!result.ok) throw new Error(result.error ?? 'The request could not be completed.')
      setNotice(result.message ?? 'Done.')
      setPassword('')
      setToken('')
      await onRefresh?.()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    void action(async () => {
      if (!window.printerApp?.account) throw new Error('Open the desktop app to continue.')
      return mode === 'verify'
        ? window.printerApp.account.verifyEmail({ email, token })
        : window.printerApp.account.completeRecovery({ email, token, password })
    })
  }
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setMode(mode === 'verify' ? null : 'verify')
            setError(null)
            setNotice(null)
          }}
        >
          {t('Verify email with a code')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setMode(mode === 'recover' ? null : 'recover')
            setError(null)
            setNotice(null)
          }}
        >
          {t('Forgot password?')}
        </Button>
      </div>
      {mode && (
        <form onSubmit={submit} className="mt-3 rounded-lg border p-4">
          <h3 className="font-medium">
            {mode === 'verify' ? 'Verify your email' : 'Reset your password'}
          </h3>
          <fieldset disabled={busy} className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm">
              {t('Email')}
              <input
                className="h-10 rounded-md border bg-background px-3"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {mode === 'recover' && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void action(async () => {
                    if (!window.printerApp?.account)
                      throw new Error('Open the desktop app to continue.')
                    return window.printerApp.account.sendRecovery(email)
                  })
                }
              >
                {t('Send recovery code')}
              </Button>
            )}
            <label className="grid gap-1 text-sm">
              {t('Email code')}
              <input
                className="h-10 rounded-md border bg-background px-3"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            {mode === 'recover' && (
              <label className="grid gap-1 text-sm">
                {t('New password')}
                <input
                  className="h-10 rounded-md border bg-background px-3"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            <Button type="submit">
              {busy ? 'Working…' : mode === 'verify' ? 'Verify email' : 'Update password'}
            </Button>
          </fieldset>
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-2 text-sm text-primary">
              {notice}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
