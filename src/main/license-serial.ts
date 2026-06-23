import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { LicenseFeature, LicensePlan } from '../shared/licensing-types.js'

const SERIAL_PREFIX = 'MPTK'
const SIGNATURE_LENGTH = 16
const SERIAL_SECRET =
  'my-printer-app-by-maher-tka-offline-license-v1-change-before-release'

type PaidLicensePlan = Exclude<LicensePlan, 'trial'>

interface CreateOfflineSerialKeyOptions {
  plan: PaidLicensePlan
  expiresCode?: string
  seatCode?: string
}

interface ValidSerialLicense {
  plan: PaidLicensePlan
  planLabel: string
  expiresAt?: string
  serialKeyHash: string
  serialKeySuffix: string
  seatCode: string
  features: LicenseFeature[]
}

export type SerialValidationResult =
  | { ok: true; license: ValidSerialLicense }
  | { ok: false; error: string }

const planCodeToPlan: Record<string, PaidLicensePlan> = {
  PRO: 'pro',
  SHOP: 'shop'
}

const planLabels: Record<PaidLicensePlan, string> = {
  pro: 'Pro',
  shop: 'Shop'
}

const featuresByPlan: Record<PaidLicensePlan, LicenseFeature[]> = {
  pro: ['paid-tools'],
  shop: ['paid-tools', 'batch-exports']
}

export function validateOfflineSerialKey(
  serialKey: string,
  now = new Date()
): SerialValidationResult {
  const parts = serialKey
    .trim()
    .toUpperCase()
    .replace(/[–—]/g, '-')
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 5) {
    return {
      ok: false,
      error: 'Serial key must include product, plan, expiry, seat, and signature sections.'
    }
  }

  const [prefix, planCode, expiresCode, seatCode] = parts
  const signature = parts.slice(4).join('')

  if (prefix !== SERIAL_PREFIX) {
    return { ok: false, error: 'This serial key is not for My Printer App.' }
  }

  const plan = planCodeToPlan[planCode]

  if (!plan) {
    return { ok: false, error: 'Serial key plan is not supported.' }
  }

  if (!isValidExpiresCode(expiresCode)) {
    return { ok: false, error: 'Serial key expiry section is not valid.' }
  }

  if (!/^[A-Z0-9]{6}$/.test(seatCode)) {
    return { ok: false, error: 'Serial key seat section is not valid.' }
  }

  if (!/^[A-F0-9]{16}$/.test(signature)) {
    return { ok: false, error: 'Serial key signature is not valid.' }
  }

  const expectedSignature = createSerialSignature(planCode, expiresCode, seatCode)

  if (!isSameSignature(signature, expectedSignature)) {
    return { ok: false, error: 'Serial key could not be verified offline.' }
  }

  const expiresAt = parseExpiresAt(expiresCode)

  if (expiresAt && now.getTime() > new Date(expiresAt).getTime()) {
    return { ok: false, error: 'This serial key has expired.' }
  }

  return {
    ok: true,
    license: {
      plan,
      planLabel: planLabels[plan],
      expiresAt,
      serialKeyHash: hashSerialKey(
        `${SERIAL_PREFIX}-${planCode}-${expiresCode}-${seatCode}-${signature}`
      ),
      serialKeySuffix: signature.slice(-4),
      seatCode,
      features: featuresByPlan[plan]
    }
  }
}

export function createOfflineSerialKey({
  plan,
  expiresCode = 'LIFE',
  seatCode = createSeatCode()
}: CreateOfflineSerialKeyOptions): string {
  const planCode = plan.toUpperCase()
  const normalizedExpiresCode = normalizeExpiresCode(expiresCode)
  const normalizedSeatCode = normalizeSeatCode(seatCode)
  const signature = createSerialSignature(
    planCode,
    normalizedExpiresCode,
    normalizedSeatCode
  )

  return `${SERIAL_PREFIX}-${planCode}-${normalizedExpiresCode}-${normalizedSeatCode}-${signature}`
}

function createSerialSignature(
  planCode: string,
  expiresCode: string,
  seatCode: string
): string {
  return createHmac('sha256', SERIAL_SECRET)
    .update(`${SERIAL_PREFIX}|${planCode}|${expiresCode}|${seatCode}`)
    .digest('hex')
    .toUpperCase()
    .slice(0, SIGNATURE_LENGTH)
}

function hashSerialKey(serialKey: string): string {
  return createHash('sha256').update(serialKey).digest('hex')
}

function isSameSignature(signature: string, expectedSignature: string): boolean {
  const provided = Buffer.from(signature)
  const expected = Buffer.from(expectedSignature)

  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  )
}

function createSeatCode(): string {
  return randomBytes(4)
    .toString('base64url')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 6)
    .padEnd(6, '0')
}

function normalizeSeatCode(seatCode: string): string {
  const normalized = seatCode.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (!/^[A-Z0-9]{6}$/.test(normalized)) {
    throw new Error('Seat code must be exactly 6 letters or numbers.')
  }

  return normalized
}

function normalizeExpiresCode(expiresCode: string): string {
  const normalized = expiresCode.trim().toUpperCase()

  if (!isValidExpiresCode(normalized)) {
    throw new Error('Expiry code must be LIFE or a YYYYMMDD date.')
  }

  return normalized
}

function isValidExpiresCode(expiresCode: string): boolean {
  if (expiresCode === 'LIFE') {
    return true
  }

  if (!/^\d{8}$/.test(expiresCode)) {
    return false
  }

  return parseExpiresAt(expiresCode) !== undefined
}

function parseExpiresAt(expiresCode: string): string | undefined {
  if (expiresCode === 'LIFE') {
    return undefined
  }

  const year = Number(expiresCode.slice(0, 4))
  const monthIndex = Number(expiresCode.slice(4, 6)) - 1
  const day = Number(expiresCode.slice(6, 8))
  const expiresAt = new Date(Date.UTC(year, monthIndex, day, 23, 59, 59, 999))

  if (
    expiresAt.getUTCFullYear() !== year ||
    expiresAt.getUTCMonth() !== monthIndex ||
    expiresAt.getUTCDate() !== day
  ) {
    return undefined
  }

  return expiresAt.toISOString()
}
