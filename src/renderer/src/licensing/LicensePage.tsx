import { useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Clock3,
  HardDrive,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  type LucideIcon
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  formatDate,
  formatDateTime,
  formatTrialTimeRemaining,
  getLicenseTone,
  getPlanDisplayName
} from '@/licensing/license-format'
import type { AppRoute } from '@/types/navigation'
import type {
  LicenseActivationResult,
  LicenseSnapshot
} from '../../../shared/licensing-types'

interface LicensePageProps {
  licenseState: LicenseSnapshot | null
  isLoading: boolean
  isActivating: boolean
  error: string | null
  activationMessage: string | null
  onActivateSerial: (serialKey: string) => Promise<LicenseActivationResult>
  onRefresh: () => Promise<void>
  onNavigate: (route: AppRoute) => void
}

export function LicensePage({
  licenseState,
  isLoading,
  isActivating,
  error,
  activationMessage,
  onActivateSerial,
  onRefresh,
  onNavigate
}: LicensePageProps): JSX.Element {
  const [serialKey, setSerialKey] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const tone = getLicenseTone(licenseState)
  const planLabel = licenseState
    ? getPlanDisplayName(licenseState.mode, licenseState.planLabel)
    : 'Checking'
  const trialRemaining = licenseState
    ? formatTrialTimeRemaining(licenseState.trial.remainingMs)
    : 'Checking'
  const paidToolsLabel = licenseState?.canUsePaidTools ? 'Unlocked' : 'Locked'
  const activationDetails = useMemo(
    () => getActivationDetails(licenseState),
    [licenseState]
  )
  const visibleError = formError ?? error

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    const trimmedKey = serialKey.trim()

    if (!trimmedKey) {
      setFormError('Enter a serial key before activating.')
      return
    }

    setFormError(null)
    const result = await onActivateSerial(trimmedKey)

    if (result.ok) {
      setSerialKey('')
      return
    }

    setFormError(result.error ?? 'Serial key could not be activated.')
  }

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          className="w-fit"
          onClick={() => onNavigate('dashboard')}
          type="button"
        >
          <ArrowLeft data-icon="inline-start" />
          Back to Dashboard
        </Button>
        <Button
          variant="outline"
          onClick={() => void onRefresh()}
          disabled={isLoading}
          type="button"
        >
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-xl">License Status</CardTitle>
            <CardDescription>
              Local trial and offline serial activation for this workstation.
            </CardDescription>
          </div>
          <Badge variant={tone}>
            {isLoading && !licenseState
              ? 'Checking'
              : licenseState?.statusLabel ?? 'Unavailable'}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <StatusMetric
              icon={ShieldCheck}
              label="Current Plan"
              value={planLabel}
              detail={licenseState?.mode === 'activated' ? 'Local activation' : 'Trial mode'}
            />
            <StatusMetric
              icon={Clock3}
              label="Trial Remaining"
              value={trialRemaining}
              detail={
                licenseState
                  ? `Ends ${formatDateTime(licenseState.trial.endsAt)}`
                  : 'Loading local state'
              }
            />
            <StatusMetric
              icon={BadgeCheck}
              label="Paid Tools"
              value={paidToolsLabel}
              detail={
                licenseState?.canUsePaidTools
                  ? 'Available on this device'
                  : 'Activation required'
              }
            />
            <StatusMetric
              icon={HardDrive}
              label="Machine Code"
              value={licenseState?.machineCode ?? 'Checking'}
              detail={formatStorageMode(licenseState)}
            />
          </div>

          {(visibleError || activationMessage) && (
            <div
              className={`rounded-lg border p-4 text-sm ${
                visibleError
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-success/80 bg-success text-success-foreground'
              }`}
            >
              <div className="flex items-start gap-3">
                {visibleError ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                )}
                <span>{visibleError ?? activationMessage}</span>
              </div>
            </div>
          )}

          {(licenseState?.clockWarning || licenseState?.integrityWarning) && (
            <div className="rounded-lg border border-warning/80 bg-warning p-4 text-sm text-warning-foreground">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {licenseState.clockWarning ?? licenseState.integrityWarning}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Activate Serial Key</CardTitle>
            <CardDescription>
              Serial keys are checked locally and stored on this machine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <label
                  className="text-sm font-semibold text-foreground"
                  htmlFor="serial-key"
                >
                  Serial Key
                </label>
                <input
                  id="serial-key"
                  value={serialKey}
                  onChange={(event) =>
                    setSerialKey(normalizeSerialInput(event.target.value))
                  }
                  className="h-11 rounded-md border border-input bg-card px-3 font-mono text-sm uppercase tracking-normal text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20"
                  placeholder="MPTK-PRO-LIFE-ABC123-SIGNATURE"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={isActivating} type="submit">
                  <KeyRound data-icon="inline-start" />
                  {isActivating ? 'Activating' : 'Activate Locally'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSerialKey('')
                    setFormError(null)
                  }}
                  type="button"
                >
                  Clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local Record</CardTitle>
            <CardDescription>
              Activation details saved by the desktop app.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DetailRow
              label="Trial Started"
              value={
                licenseState ? formatDateTime(licenseState.trial.startedAt) : 'Checking'
              }
            />
            <DetailRow
              label="Trial Ends"
              value={
                licenseState ? formatDateTime(licenseState.trial.endsAt) : 'Checking'
              }
            />
            <DetailRow
              label="Serial Suffix"
              value={activationDetails.serial}
            />
            <DetailRow
              label="Seat"
              value={activationDetails.seat}
            />
            <DetailRow
              label="Expires"
              value={activationDetails.expires}
            />
            <DetailRow
              label="Last Checked"
              value={licenseState ? formatDateTime(licenseState.checkedAt) : 'Checking'}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface StatusMetricProps {
  icon: LucideIcon
  label: string
  value: string
  detail: string
}

function StatusMetric({
  icon: Icon,
  label,
  value,
  detail
}: StatusMetricProps): JSX.Element {
  return (
    <div className="rounded-lg border bg-muted/35 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  )
}

interface DetailRowProps {
  label: string
  value: string
}

function DetailRow({ label, value }: DetailRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}

function getActivationDetails(licenseState: LicenseSnapshot | null): {
  serial: string
  seat: string
  expires: string
} {
  if (!licenseState?.activation) {
    return {
      serial: 'Not activated',
      seat: 'Not assigned',
      expires: 'Not activated'
    }
  }

  return {
    serial: `Last 4 ${licenseState.activation.serialKeySuffix}`,
    seat: licenseState.activation.seatCode,
    expires: licenseState.activation.expiresAt
      ? formatDate(licenseState.activation.expiresAt)
      : 'Lifetime'
  }
}

function formatStorageMode(licenseState: LicenseSnapshot | null): string {
  if (!licenseState) {
    return 'Loading local record'
  }

  return licenseState.storageMode === 'electron-user-data'
    ? 'Electron user data'
    : 'Browser local storage'
}

function normalizeSerialInput(value: string): string {
  return value.toUpperCase().replace(/[–—]/g, '-')
}
