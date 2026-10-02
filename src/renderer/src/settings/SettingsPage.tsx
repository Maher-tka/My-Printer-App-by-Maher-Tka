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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
        Back to Dashboard
      </Button>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center gap-3 border-b border-[var(--ui-divider)]">
          <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Settings className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">Settings</CardTitle>
            <CardDescription>Workspace preferences and app management.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pt-6">
          <AppearanceSettings />
          <section>
            <p className="mb-2 text-xs font-medium text-muted-foreground">General</p>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <SettingsIcon icon={Gauge} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">Performance mode</h3>
                      <Badge variant="secondary">{settings.label}</Badge>
                    </div>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                      {settings.description}
                    </p>
                  </div>
                </div>
                <Select
                  value={preset}
                  onValueChange={(value) => setPreset(value as PerformancePresetId)}
                >
                  <SelectTrigger className="min-w-48" aria-label="Performance mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PERFORMANCE_PRESETS).map((option) => (
                      <SelectItem key={option.preset} value={option.preset}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-medium text-muted-foreground">App management</p>
            <div className="overflow-hidden rounded-xl border bg-card">
              <BackupRestoreSettings />
              <UpdatesSettings />
              <SettingsDestination
                icon={KeyRound}
                title="Access & Subscription"
                description={getLicenseSummary(licenseState)}
                badge={
                  <Badge variant={getLicenseTone(licenseState)}>
                    {licenseState?.statusLabel ?? 'Checking'}
                  </Badge>
                }
                onClick={() => onNavigate('license')}
              />
              <SettingsDestination
                icon={Activity}
                title="App Health"
                description="Storage, diagnostics, cache, recovery, and app information."
                onClick={() => onNavigate('app-health')}
              />
              {isDeveloperMode ? (
                <SettingsDestination
                  icon={FlaskConical}
                  title="Quality Lab"
                  description="Development-only fixtures and release checks."
                  badge={<Badge variant="warning">Developer</Badge>}
                  onClick={() => onNavigate('quality-lab')}
                />
              ) : null}
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}

function UpdatesSettings(): JSX.Element {
  const { state, isChecking, checkForUpdates, installUpdate } = useAppUpdates()
  const isDownloaded = state.status === 'downloaded'

  return (
    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
      <SettingsIcon icon={Download} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground">App updates</h3>
          <Badge variant={updateBadgeVariant(state)}>{updateBadgeLabel(state)}</Badge>
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{state.message}</p>
        {state.status === 'downloading' ? (
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Update download progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={state.downloadPercent ?? 0}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${state.downloadPercent ?? 0}%` }}
            />
          </div>
        ) : null}
      </div>
      {isDownloaded ? (
        <Button type="button" size="sm" onClick={() => void installUpdate()}>
          Restart to update
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!state.enabled || isChecking}
          onClick={() => void checkForUpdates()}
        >
          <RefreshCw className={isChecking ? 'animate-spin' : undefined} aria-hidden="true" />
          {isChecking ? 'Checking…' : 'Check now'}
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
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b p-4 text-left transition last:border-b-0 hover:bg-muted/45"
    >
      <SettingsIcon icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{title}</span>
          {badge}
        </span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  )
}
