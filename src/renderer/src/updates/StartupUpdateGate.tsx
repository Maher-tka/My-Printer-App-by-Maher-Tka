import type { ReactNode } from 'react'
import { useLanguage } from '@/i18n/useLanguage'
import type { AppUpdateSnapshot } from '../../../shared/update-types'
import { useAppUpdates } from './useAppUpdates'

export function StartupUpdateScreen({ state }: { state: AppUpdateSnapshot }): JSX.Element {
  const { t } = useLanguage()
  const downloading = state.status === 'downloading' || state.status === 'available'
  const installing = state.status === 'installing' || state.status === 'downloaded'
  const percent = Math.max(0, Math.min(100, state.downloadPercent ?? 0))
  const label = installing
    ? 'Installing update…'
    : downloading
      ? 'Downloading update…'
      : 'Checking for updates…'
  return (
    <main
      className="grid min-h-screen place-items-center bg-background p-6 text-foreground"
      aria-busy="true"
    >
      <section className="w-full max-w-sm space-y-4 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 text-center">
        <h1 className="text-lg font-semibold">{t('App updates')}</h1>
        <p role="status" aria-live="polite" className="text-sm">
          {t(label)}
        </p>
        {state.availableVersion && (
          <p className="text-xs text-muted-foreground" dir="ltr">
            v{state.currentVersion} → v{state.availableVersion}
          </p>
        )}
        {downloading && (
          <div className="space-y-2">
            <div
              role="progressbar"
              aria-label={t('Update download progress')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{percent}%</p>
          </div>
        )}
      </section>
    </main>
  )
}

export function StartupUpdateGate({ children }: { children: ReactNode }): JSX.Element {
  const { state, isLoading } = useAppUpdates()
  if (isLoading || state.startupPending) return <StartupUpdateScreen state={state} />
  return <>{children}</>
}
