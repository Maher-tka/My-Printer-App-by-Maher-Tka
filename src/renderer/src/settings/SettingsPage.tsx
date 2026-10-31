import { useLanguage } from '@/i18n/useLanguage'
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Download,
  FlaskConical,
  Gauge,
  KeyRound,
  RefreshCw,
  Settings,
  type LucideIcon
} from 'lucide-react'
import type { ReactNode } from 'react'
import { BackupRestoreSettings } from '@/backup/BackupRestoreSettings'
import { AppearanceSettings } from '@/appearance/AppearanceSettings'
import { PrinterSettings } from './PrinterSettings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { getLicenseSummary, getLicenseTone } from '@/licensing/license-format'
import { PERFORMANCE_PRESETS } from '@/performance/performanceSettings'
import { usePerformanceSettings } from '@/performance/usePerformanceSettings'
import type { PerformancePresetId } from '@/performance/performanceTypes'
import type { AppRoute } from '@/types/navigation'
import { useAppUpdates } from '@/updates/useAppUpdates'
import type { LicenseSnapshot } from '../../../shared/licensing-types'
import type { AppUpdateSnapshot } from '../../../shared/update-types'

interface SettingsPageProps {
  licenseState: LicenseSnapshot | null
  isDeveloperMode: boolean
  onNavigate: (route: AppRoute) => void
}

export function SettingsPage({
  licenseState,
  isDeveloperMode,
  onNavigate
}: SettingsPageProps): JSX.Element {
  const { t, direction } = useLanguage()

  const { settings, preset, setPreset } = usePerformanceSettings()

  return (
    <div className="workspace-shell mx-auto flex max-w-[1040px] flex-col gap-5">
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => onNavigate('dashboard')}
        type="button"
      >
        <ArrowLeft data-icon="inline-start" />
        {t('Back to Dashboard')}
      </Button>

      <section aria-labelledby="settings-title" className="min-w-0 space-y-5">
        <header className="flex items-center gap-3 border-b border-[var(--ui-divider)] pb-4">
          <div className="grid size-10 place-items-center rounded-lg bg-secondary text-muted-foreground">
            <Settings className="size-5" aria-hidden="true" />
          </div>
          <h2 id="settings-title" className="text-lg font-semibold">
            {t('Settings')}
          </h2>
        </header>
        <Tabs defaultValue="general" dir={direction} className="min-w-0">
          <TabsList className="grid w-full grid-cols-3" aria-label={t('App settings')}>
            <TabsTrigger value="general">{t('General')}</TabsTrigger>
            <TabsTrigger value="printing">{t('Printing settings')}</TabsTrigger>
            <TabsTrigger value="advanced">{t('Advanced')}</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-5 space-y-6">
            <AppearanceSettings />

            <section>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t('App management')}
              </p>
              <div className="ui-glass-surface overflow-hidden rounded-xl border">
                <UpdatesSettings />
                <SettingsDestination
                  icon={KeyRound}
                  title={t('Account access')}
                  description={getLicenseSummary(licenseState)}
                  badge={
                    <Badge variant={getLicenseTone(licenseState)}>
                      {licenseState?.statusLabel ?? t('Checking')}
                    </Badge>
                  }
                  onClick={() => onNavigate('license')}
                />
                <SettingsDestination
                  icon={Activity}
                  title={t('App Health')}
                  description={t('Storage, diagnostics, cache, recovery, and app information.')}
                  onClick={() => onNavigate('app-health')}
                />
              </div>
            </section>
          </TabsContent>
          <TabsContent value="printing" className="mt-5">
            <PrinterSettings />
          </TabsContent>
          <TabsContent value="advanced" className="mt-5 space-y-6">
            <p className="text-sm text-muted-foreground">
              {t(
                'Performance, backups and diagnostics. These settings usually only need changing once.'
              )}
            </p>
            <section>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('Performance')}</p>
              <div className="ui-glass-surface rounded-xl border p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <SettingsIcon icon={Gauge} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{t('Performance mode')}</h3>
                        <Badge variant="secondary">{t(settings.label)}</Badge>
                      </div>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                        {t(settings.description)}
                      </p>
                    </div>
                  </div>
                  <Select
                    value={preset}
                    onValueChange={(value) => setPreset(value as PerformancePresetId)}
                  >
                    <SelectTrigger className="min-w-48" aria-label={t('Performance mode')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(PERFORMANCE_PRESETS).map((option) => (
                        <SelectItem key={option.preset} value={option.preset}>
                          {t(option.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
            <section className="ui-glass-surface overflow-hidden rounded-xl border">
              <BackupRestoreSettings />
              {isDeveloperMode ? (
                <SettingsDestination
                  icon={FlaskConical}
                  title={t('Quality Lab')}
                  description={t('Development-only fixtures and release checks.')}
                  badge={<Badge variant="warning">{t('Developer')}</Badge>}
                  onClick={() => onNavigate('quality-lab')}
                />
              ) : null}
            </section>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}

function UpdatesSettings(): JSX.Element {
  const { t } = useLanguage()

  const { state, isChecking, checkForUpdates, installUpdate } = useAppUpdates()
  const isDownloaded = state.status === 'downloaded'

  return (
    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
      <SettingsIcon icon={Download} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground">{t('App updates')}</h3>
          <Badge variant={updateBadgeVariant(state)}>{updateBadgeLabel(state)}</Badge>
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{state.message}</p>
        {state.status === 'downloading' ? (
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={t('Update download progress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={state.downloadPercent ?? 0}
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${state.downloadPercent ?? 0}%` }}
            />
          </div>
        ) : null}
      </div>
      {isDownloaded ? (
        <Button type="button" size="sm" onClick={() => void installUpdate()}>
          {t('Restart to update')}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!state.enabled || isChecking}
          onClick={() => void checkForUpdates()}
        >
          <RefreshCw
            className={isChecking ? 'motion-safe:animate-spin' : undefined}
            aria-hidden="true"
          />
          {isChecking ? t('Checking…') : t('Check now')}
        </Button>
      )}
    </div>
  )
}

function updateBadgeLabel(state: AppUpdateSnapshot): string {
  switch (state.status) {
    case 'available':
    case 'downloading':
      return 'Downloading'
    case 'downloaded':
      return 'Ready'
    case 'up-to-date':
      return 'Up to date'
    case 'error':
      return 'Check failed'
    case 'checking':
      return 'Checking'
    case 'disabled':
      return `v${state.currentVersion}`
    default:
      return `v${state.currentVersion}`
  }
}

function updateBadgeVariant(
  state: AppUpdateSnapshot
): 'default' | 'secondary' | 'warning' | 'destructive' {
  if (state.status === 'downloaded') return 'default'
  if (state.status === 'available' || state.status === 'downloading') return 'warning'
  if (state.status === 'error') return 'destructive'
  return 'secondary'
}

function SettingsIcon({ icon: Icon }: { icon: LucideIcon }): JSX.Element {
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
      <Icon className="size-5" aria-hidden="true" />
    </div>
  )
}

function SettingsDestination({
  icon,
  title,
  description,
  badge,
  onClick
}: {
  icon: LucideIcon
  title: string
  description: string
  badge?: ReactNode
  onClick: () => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b p-4 text-start transition-colors last:border-b-0 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <SettingsIcon icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{title}</span>
          {badge}
        </span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{t(description)}</span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
        aria-hidden="true"
      />
    </button>
  )
}
