export type AccountStatus = 'signed-out' | 'signed-in'

export interface AccountProfile {
  id: string
  displayName: string
  email: string
  createdAt: string
  lastSignedInAt: string
}

export interface AccountSnapshot {
  status: AccountStatus
  accountExists: boolean
  profile?: AccountProfile
  storageMode: 'electron-user-data'
}

export interface CreateAccountRequest {
  displayName: string
  email: string
  password: string
}

export interface SignInRequest {
  email: string
  password: string
}

export interface AccountMutationResult {
  ok: boolean
  state: AccountSnapshot
  message?: string
  error?: string
}
