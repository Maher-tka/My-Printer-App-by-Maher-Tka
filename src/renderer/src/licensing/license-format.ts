import type { LicenseMode, LicenseSnapshot } from '../../../shared/licensing-types'

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
})

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})

export function formatTrialTimeRemaining(remainingMs: number): string {
  if (remainingMs <= 0) {
    return 'Expired'
  }

  const days = Math.floor(remainingMs / MS_PER_DAY)
  const hours = Math.floor((remainingMs % MS_PER_DAY) / MS_PER_HOUR)
  const minutes = Math.floor((remainingMs % MS_PER_HOUR) / MS_PER_MINUTE)

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${Math.max(1, minutes)}m`
}

export function formatDate(value: string | undefined): string {
  if (!value) {
    return 'Lifetime'
  }

  const date = new Date(value)

  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : 'Unknown'
}

export function formatDateTime(value: string): string {
  const date = new Date(value)

  return Number.isFinite(date.getTime()) ? dateTimeFormatter.format(date) : 'Unknown'
}

export function getLicenseTone(
  licenseState: LicenseSnapshot | null
): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (!licenseState) {
    return 'secondary'
  }

  if (licenseState.mode === 'activated') {
    return 'success'
  }

  if (licenseState.mode === 'expired') {
    return 'destructive'
  }

  return 'warning'
}

export function getLicenseSummary(licenseState: LicenseSnapshot | null): string {
  if (!licenseState) {
    return 'Checking local license'
  }

  if (licenseState.mode === 'activated') {
    const expiry = licenseState.activation?.expiresAt

    return expiry
      ? `${licenseState.planLabel} active until ${formatDate(expiry)}`
      : `${licenseState.planLabel} active`
  }

  if (licenseState.mode === 'expired') {
    return 'Trial expired'
  }

  return `Trial remaining ${formatTrialTimeRemaining(licenseState.trial.remainingMs)}`
}

export function getPlanDisplayName(mode: LicenseMode, planLabel: string): string {
  return mode === 'trial' || mode === 'expired' ? 'Trial' : planLabel
}
