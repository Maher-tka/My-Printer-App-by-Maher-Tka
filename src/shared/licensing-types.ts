export type LicenseFeature = 'paid-tools' | 'batch-exports'

export type LicensePlan = 'trial' | 'pro' | 'shop'

export type LicenseMode = 'trial' | 'activated' | 'expired'

export interface LicenseTrialStatus {
  startedAt: string
  endsAt: string
  remainingMs: number
  isExpired: boolean
}

export interface LicenseActivationStatus {
  plan: Exclude<LicensePlan, 'trial'>
  planLabel: string
  activatedAt: string
  expiresAt?: string
  serialKeyHash: string
  serialKeySuffix: string
  seatCode: string
  features: LicenseFeature[]
}

export interface LicenseSnapshot {
  installationId: string
  machineCode: string
  mode: LicenseMode
  plan: LicensePlan
  planLabel: string
  statusLabel: string
  features: LicenseFeature[]
  canUsePaidTools: boolean
  trial: LicenseTrialStatus
  activation?: LicenseActivationStatus
  checkedAt: string
  storageMode: 'electron-user-data' | 'browser-local-storage'
  clockWarning?: string
  integrityWarning?: string
}

export interface LicenseActivationResult {
  ok: boolean
  state: LicenseSnapshot
  message?: string
  error?: string
}
