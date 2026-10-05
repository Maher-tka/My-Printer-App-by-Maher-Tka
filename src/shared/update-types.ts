export type AppUpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'up-to-date'
  | 'error'

export interface AppUpdateSnapshot {
  enabled: boolean
  startupPending?: boolean
  status: AppUpdateStatus
  currentVersion: string
  availableVersion?: string
  downloadPercent?: number
  message: string
  lastCheckedAt?: string
  releaseDate?: string
}

export interface AppUpdateActionResult {
  ok: boolean
  state: AppUpdateSnapshot
  error?: string
}
