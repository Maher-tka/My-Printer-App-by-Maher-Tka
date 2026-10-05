import type {
  CloudAccountAccess,
  CloudAccessStatus,
  AccessGrantRecord,
  AccessRequestRecord,
  AccountSnapshot
} from './account-types.js'
import type { LicenseSnapshot } from './licensing-types.js'
import { SUBSCRIPTION_TOOLS } from './subscription-tools.js'

export const ACCESS_REFRESH_MS = 60_000
export const ACCESS_MAX_AGE_MS = 90_000

export function resolveCloudAccessStatus(
  grant: AccessGrantRecord | undefined,
  request: AccessRequestRecord | undefined,
  serverNow: string
): CloudAccessStatus {
  if (grant?.status === 'revoked') return 'revoked'
  if (grant) {
    const now = Date.parse(serverNow)
    if (Date.parse(grant.starts_at) <= now && now < Date.parse(grant.ends_at)) return grant.status
    return 'expired'
  }
  return request?.status === 'pending'
    ? 'pending'
    : request?.status === 'denied'
      ? 'denied'
      : 'none'
}

// Bound a server response using elapsed client time; changing the clock backwards fails closed.
export function hasCurrentCloudAccess(
  access: CloudAccountAccess | undefined,
  now = Date.now()
): boolean {
  if (!access?.configured || !access.serverNow) return false
  const elapsed = now - Date.parse(access.checkedAt)
  if (!Number.isFinite(elapsed) || elapsed < -5_000 || elapsed > ACCESS_MAX_AGE_MS) return false
  if (access.status === 'unavailable' || access.status === 'revoked') return false
  if (access.isAdmin) return true
  const grant = access.grant
  const serverTime = Date.parse(access.serverNow) + Math.max(0, elapsed)
  return Boolean(
    grant &&
    (access.status === 'trial' || access.status === 'active') &&
    Date.parse(grant.starts_at) <= serverTime &&
    serverTime < Date.parse(grant.ends_at)
  )
}

export function cloudLicenseSnapshot(account: AccountSnapshot): LicenseSnapshot {
  const access = account.cloud
  const now = new Date().toISOString()
  const allowed = account.status === 'signed-in' && hasCurrentCloudAccess(access)
  const grant = access?.grant
  const plan = access?.isAdmin ? 'shop' : (grant?.plan ?? 'pro')
  const remaining =
    allowed && grant ? Math.max(0, Date.parse(grant.ends_at) - Date.parse(access!.serverNow!)) : 0
  const trial = access?.status === 'trial' && allowed
  const labels: Record<CloudAccessStatus, string> = {
    none: 'Request access',
    pending: 'Awaiting approval',
    denied: 'Request denied',
    trial: 'Trial active',
    active: 'Access active',
    expired: 'Access expired',
    revoked: 'Access revoked',
    unavailable: 'Connect to check access'
  }
  return {
    installationId: account.profile?.id ?? 'cloud',
    machineCode: 'ONLINE',
    mode: allowed ? (trial ? 'trial' : 'activated') : 'expired',
    plan: trial ? 'trial' : plan,
    planLabel: access?.isAdmin ? 'Owner' : trial ? 'Trial' : plan === 'shop' ? 'Shop' : 'Pro',
    statusLabel:
      access?.isAdmin && allowed ? 'Owner access' : labels[access?.status ?? 'unavailable'],
    features: allowed
      ? access?.isAdmin || (access?.batchExports ?? plan === 'shop')
        ? ['paid-tools', 'batch-exports']
        : ['paid-tools']
      : [],
    allowedTools: allowed
      ? access?.isAdmin
        ? SUBSCRIPTION_TOOLS.map((tool) => tool.id)
        : (access?.allowedTools ?? [])
      : [],
    canUsePaidTools: allowed,
    trial: {
      startedAt: grant?.starts_at ?? now,
      endsAt: grant?.ends_at ?? now,
      remainingMs: remaining,
      isExpired: !allowed
    },
    checkedAt: access?.checkedAt ?? now,
    storageMode: 'supabase',
    ...(access?.error ? { integrityWarning: access.error } : {})
  }
}
