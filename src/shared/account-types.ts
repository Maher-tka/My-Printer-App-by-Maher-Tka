import type { SubscriptionToolId } from './subscription-tools.js'

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
  cloud?: CloudAccountAccess
}

export type AccessPlan = 'pro' | 'shop'
export type CloudAccessStatus =
  | 'none'
  | 'pending'
  | 'denied'
  | 'trial'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'unavailable'

export interface AccessRequestRecord {
  id: string
  user_id: string
  shop_name: string
  message: string
  requested_plan: AccessPlan
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  decision_reason: string | null
}

export interface AccessGrantRecord {
  user_id: string
  plan: AccessPlan
  status: 'trial' | 'active' | 'revoked'
  starts_at: string
  ends_at: string
  reason: string
  tool_ids?: SubscriptionToolId[] | null
  batch_exports?: boolean | null
}

export interface CloudAccountAccess {
  configured: boolean
  isAdmin: boolean
  status: CloudAccessStatus
  checkedAt: string
  serverNow?: string
  grant?: AccessGrantRecord
  request?: AccessRequestRecord
  error?: string
  allowedTools?: SubscriptionToolId[]
  batchExports?: boolean
}

export interface SubmitAccessRequest {
  shopName: string
  message: string
  plan: AccessPlan
}

export interface AdminAccessAction {
  action: 'approve' | 'deny' | 'trial' | 'grant' | 'extend' | 'revoke' | 'manage'
  userId: string
  requestId?: string
  plan: AccessPlan
  days: number
  reason: string
  toolIds?: SubscriptionToolId[] | null
  batchExports?: boolean | null
}

export interface SubscriptionPlanRecord {
  plan: AccessPlan
  tool_ids: SubscriptionToolId[]
  batch_exports: boolean
}

export interface AccessAdminCustomer {
  id: string
  email: string
  display_name: string
  created_at: string
}

export interface AccessAuditRecord {
  id: string
  actor_id: string
  user_id: string
  action: string
  created_at: string
  details: unknown
}

export interface AccessAdminSnapshot {
  plans?: SubscriptionPlanRecord[]
  customers: AccessAdminCustomer[]
  requests: AccessRequestRecord[]
  grants: AccessGrantRecord[]
  audit: AccessAuditRecord[]
  hasMore: boolean
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
