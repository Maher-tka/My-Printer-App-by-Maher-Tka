import assert from 'node:assert/strict'
import {
  hasCurrentCloudAccess,
  cloudLicenseSnapshot,
  resolveCloudAccessStatus
} from './cloud-access.js'
import type { AccountSnapshot, AccessGrantRecord, CloudAccountAccess } from './account-types.js'

const now = '2026-10-02T10:00:00.000Z'
const grant: AccessGrantRecord = {
  user_id: 'customer',
  plan: 'shop',
  status: 'trial',
  starts_at: '2026-10-01T10:00:00Z',
  ends_at: '2026-10-03T10:00:00Z',
  reason: ''
}
const access: CloudAccountAccess = {
  configured: true,
  isAdmin: false,
  status: 'trial',
  serverNow: now,
  checkedAt: now,
  grant
}
assert.equal(resolveCloudAccessStatus(grant, undefined, now), 'trial')
assert.equal(resolveCloudAccessStatus({ ...grant, status: 'revoked' }, undefined, now), 'revoked')
assert.equal(resolveCloudAccessStatus({ ...grant, ends_at: now }, undefined, now), 'expired')
assert.equal(
  resolveCloudAccessStatus({ ...grant, starts_at: '2026-10-02T11:00:00Z' }, undefined, now),
  'expired'
)
assert.equal(hasCurrentCloudAccess(access, Date.parse(now)), true)
assert.equal(
  hasCurrentCloudAccess(access, Date.parse(now) + 90_001),
  false,
  'offline/stale access must expire'
)
assert.equal(
  hasCurrentCloudAccess(access, Date.parse(now) - 5_001),
  false,
  'clock rollback must fail closed'
)
assert.equal(hasCurrentCloudAccess({ ...access, status: 'revoked' }, Date.parse(now)), false)
assert.equal(
  hasCurrentCloudAccess({ ...access, status: 'unavailable', isAdmin: true }, Date.parse(now)),
  false
)
assert.equal(
  hasCurrentCloudAccess({ ...access, grant: { ...grant, ends_at: now } }, Date.parse(now)),
  false
)
const current = new Date().toISOString()
const state: AccountSnapshot = {
  status: 'signed-in',
  accountExists: true,
  storageMode: 'electron-user-data',
  cloud: { ...access, checkedAt: current }
}
assert.deepEqual(cloudLicenseSnapshot(state).features, ['paid-tools', 'batch-exports'])
assert.equal(cloudLicenseSnapshot({ ...state, status: 'signed-out' }).canUsePaidTools, false)
assert.equal(
  cloudLicenseSnapshot({ ...state, cloud: { ...state.cloud!, status: 'none', grant: undefined } })
    .canUsePaidTools,
  false,
  'signup never grants access'
)
assert.deepEqual(
  cloudLicenseSnapshot({ ...state, cloud: { ...state.cloud!, grant: { ...grant, plan: 'pro' } } })
    .features,
  ['paid-tools']
)
console.log('Cloud access expiry, revocation, signout, server-time and plan checks passed.')
