import { app, ipcMain } from 'electron'
import { createHmac, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  LicenseActivationResult,
  LicenseActivationStatus,
  LicenseFeature,
  LicenseMode,
  LicensePlan,
  LicenseSnapshot
} from '../shared/licensing-types.js'
import { validateOfflineSerialKey } from './license-serial.js'

const LICENSE_FILE_NAME = 'license-state.json'
const LICENSE_FILE_VERSION = 2
const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000
const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000
const LICENSE_RECORD_SECRET =
  'my-printer-app-by-maher-tka-local-license-record-v2'
const ACTIVATION_PROOF_SECRET =
  'my-printer-app-by-maher-tka-local-activation-proof-v1'

interface PersistedLicenseFile {
  version: typeof LICENSE_FILE_VERSION
  installationId: string
  trialStartedAt: string
  trialEndsAt: string
  lastSeenAt: string
  recordProof: string
  activation?: PersistedActivation
}

interface PersistedActivation extends LicenseActivationStatus {
  proof: string
}

interface EffectiveClock {
  now: Date
  warning?: string
}

export function registerLicenseHandlers(): void {
  ipcMain.handle('license:get-state', async () => getLicenseSnapshot())
  ipcMain.handle('license:activate-serial', async (_event, serialKey: string) =>
    activateSerialKey(serialKey)
  )
}

async function getLicenseSnapshot(): Promise<LicenseSnapshot> {
  const record = await loadOrCreateLicenseRecord()
  const clock = getEffectiveClock(record)

  await updateLastSeen(record, clock.now)

  return buildLicenseSnapshot(record, clock)
}

async function activateSerialKey(
  serialKey: string
): Promise<LicenseActivationResult> {
  const record = await loadOrCreateLicenseRecord()
  const clock = getEffectiveClock(record)
  const validation = validateOfflineSerialKey(serialKey, clock.now)

  if (!validation.ok) {
    return {
      ok: false,
      state: buildLicenseSnapshot(record, clock),
      error: validation.error
    }
  }

  const activation: PersistedActivation = {
    ...validation.license,
    activatedAt: clock.now.toISOString(),
    proof: ''
  }

  activation.proof = createActivationProof(record.installationId, activation)
  record.activation = activation
  await updateLastSeen(record, clock.now, true)

  return {
    ok: true,
    state: buildLicenseSnapshot(record, clock),
    message: 'Serial key activated locally.'
  }
}

async function loadOrCreateLicenseRecord(): Promise<PersistedLicenseFile> {
  const existingRecord = await readLicenseRecord()

  if (existingRecord) {
    return existingRecord
  }

  const now = new Date()
  const record = createNewLicenseRecord(now)

  await writeLicenseRecord(record)

  return record
}

async function readLicenseRecord(): Promise<PersistedLicenseFile | undefined> {
  const licenseFilePath = getLicenseFilePath()

  try {
    const rawRecord = await readFile(licenseFilePath, 'utf-8')
    const parsedRecord = JSON.parse(rawRecord) as Partial<PersistedLicenseFile>

    if (!isPersistedLicenseFile(parsedRecord)) {
      throw new Error('License file is not in the expected format.')
    }

    return parsedRecord
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return undefined
    }

    await backupCorruptLicenseFile(licenseFilePath)

    const recoveredRecord = createNewLicenseRecord(new Date(), true)
    await writeLicenseRecord(recoveredRecord)

    return recoveredRecord
  }
}

async function writeLicenseRecord(record: PersistedLicenseFile): Promise<void> {
  const licenseFilePath = getLicenseFilePath()
  const temporaryPath = `${licenseFilePath}.tmp`

  record.recordProof = createRecordProof(record)
  await mkdir(dirname(licenseFilePath), { recursive: true })
  await writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, 'utf-8')
  await rename(temporaryPath, licenseFilePath)
}

function createNewLicenseRecord(
  now: Date,
  trialExpired = false
): PersistedLicenseFile {
  const trialStartedAt = trialExpired
    ? new Date(now.getTime() - TRIAL_LENGTH_MS)
    : now
  const trialEndsAt = trialExpired
    ? now
    : new Date(now.getTime() + TRIAL_LENGTH_MS)

  return {
    version: LICENSE_FILE_VERSION,
    installationId: randomUUID(),
    trialStartedAt: trialStartedAt.toISOString(),
    trialEndsAt: trialEndsAt.toISOString(),
    lastSeenAt: now.toISOString(),
    recordProof: ''
  }
}

async function backupCorruptLicenseFile(licenseFilePath: string): Promise<void> {
  const backupPath = `${licenseFilePath}.corrupt-${Date.now()}`

  try {
    await rename(licenseFilePath, backupPath)
  } catch {
    // If the corrupt file disappears between read and backup, the app can recreate it.
  }
}

async function updateLastSeen(
  record: PersistedLicenseFile,
  now: Date,
  forceWrite = false
): Promise<void> {
  const lastSeenAt = new Date(record.lastSeenAt)

  if (forceWrite || now.getTime() > lastSeenAt.getTime()) {
    record.lastSeenAt = now.toISOString()
    await writeLicenseRecord(record)
  }
}

function buildLicenseSnapshot(
  record: PersistedLicenseFile,
  clock: EffectiveClock
): LicenseSnapshot {
  const trialEndsAt = new Date(record.trialEndsAt)
  const remainingMs = Math.max(0, trialEndsAt.getTime() - clock.now.getTime())
  const trialIsExpired = remainingMs <= 0
  const activationIssue = getActivationIntegrityIssue(record)
  const activation = activationIssue
    ? undefined
    : getCurrentActivation(record.activation, clock.now)
  const mode: LicenseMode = activation
    ? 'activated'
    : trialIsExpired
      ? 'expired'
      : 'trial'
  const plan: LicensePlan = activation?.plan ?? 'trial'
  const features = activation?.features ?? getTrialFeatures(trialIsExpired)

  return {
    installationId: record.installationId,
    machineCode: formatMachineCode(record.installationId),
    mode,
    plan,
    planLabel: activation?.planLabel ?? 'Trial',
    statusLabel: getStatusLabel(mode),
    features,
    canUsePaidTools: features.includes('paid-tools'),
    trial: {
      startedAt: record.trialStartedAt,
      endsAt: record.trialEndsAt,
      remainingMs,
      isExpired: trialIsExpired
    },
    activation,
    checkedAt: clock.now.toISOString(),
    storageMode: 'electron-user-data',
    clockWarning: clock.warning,
    integrityWarning: activationIssue
  }
}

function getCurrentActivation(
  activation: PersistedActivation | undefined,
  now: Date
): LicenseActivationStatus | undefined {
  if (!activation) {
    return undefined
  }

  if (activation.expiresAt && now.getTime() > new Date(activation.expiresAt).getTime()) {
    return undefined
  }

  const { proof: _proof, ...trustedActivation } = activation

  return trustedActivation
}

function getActivationIntegrityIssue(
  record: PersistedLicenseFile
): string | undefined {
  if (!record.activation) {
    return undefined
  }

  const expectedProof = createActivationProof(
    record.installationId,
    record.activation
  )

  return record.activation.proof === expectedProof
    ? undefined
    : 'The saved activation record could not be verified.'
}

function createActivationProof(
  installationId: string,
  activation: PersistedActivation
): string {
  return createHmac('sha256', ACTIVATION_PROOF_SECRET)
    .update(
      [
        installationId,
        activation.plan,
        activation.expiresAt ?? 'LIFE',
        activation.serialKeyHash,
        activation.seatCode,
        activation.activatedAt
      ].join('|')
    )
    .digest('hex')
}

function createRecordProof(record: PersistedLicenseFile): string {
  return createHmac('sha256', LICENSE_RECORD_SECRET)
    .update(
      [
        record.installationId,
        record.trialStartedAt,
        record.trialEndsAt,
        record.lastSeenAt
      ].join('|')
    )
    .digest('hex')
}

function getEffectiveClock(record: PersistedLicenseFile): EffectiveClock {
  const now = new Date()
  const lastSeenAt = new Date(record.lastSeenAt)

  if (
    Number.isFinite(lastSeenAt.getTime()) &&
    now.getTime() + CLOCK_ROLLBACK_TOLERANCE_MS < lastSeenAt.getTime()
  ) {
    return {
      now: lastSeenAt,
      warning:
        'System clock is earlier than the last app run, so licensing uses the last trusted time.'
    }
  }

  return { now }
}

function getTrialFeatures(isExpired: boolean): LicenseFeature[] {
  return isExpired ? [] : ['paid-tools']
}

function getStatusLabel(mode: LicenseMode): string {
  if (mode === 'activated') {
    return 'License active'
  }

  if (mode === 'expired') {
    return 'Trial expired'
  }

  return 'Trial active'
}

function formatMachineCode(installationId: string): string {
  const compactId = installationId.replace(/-/g, '').toUpperCase().slice(0, 16)
  const groups = compactId.match(/.{1,4}/g)

  return groups ? groups.join('-') : compactId
}

function getLicenseFilePath(): string {
  return join(app.getPath('userData'), LICENSE_FILE_NAME)
}

function isPersistedLicenseFile(
  record: Partial<PersistedLicenseFile>
): record is PersistedLicenseFile {
  return (
    record.version === LICENSE_FILE_VERSION &&
    typeof record.installationId === 'string' &&
    typeof record.trialStartedAt === 'string' &&
    typeof record.trialEndsAt === 'string' &&
    typeof record.lastSeenAt === 'string' &&
    typeof record.recordProof === 'string' &&
    isValidIsoDateString(record.trialStartedAt) &&
    isValidIsoDateString(record.trialEndsAt) &&
    isValidIsoDateString(record.lastSeenAt) &&
    (record.activation === undefined ||
      isPersistedActivation(record.activation)) &&
    record.recordProof === createRecordProof(record as PersistedLicenseFile)
  )
}

function isPersistedActivation(
  activation: unknown
): activation is PersistedActivation {
  if (
    typeof activation !== 'object' ||
    activation === null ||
    !('plan' in activation)
  ) {
    return false
  }

  const candidate = activation as Partial<PersistedActivation>

  return (
    (candidate.plan === 'pro' || candidate.plan === 'shop') &&
    typeof candidate.planLabel === 'string' &&
    typeof candidate.activatedAt === 'string' &&
    isValidIsoDateString(candidate.activatedAt) &&
    (candidate.expiresAt === undefined ||
      (typeof candidate.expiresAt === 'string' &&
        isValidIsoDateString(candidate.expiresAt))) &&
    typeof candidate.serialKeyHash === 'string' &&
    typeof candidate.serialKeySuffix === 'string' &&
    typeof candidate.seatCode === 'string' &&
    /^[A-Z0-9]{6}$/.test(candidate.seatCode) &&
    Array.isArray(candidate.features) &&
    candidate.features.every(isLicenseFeature) &&
    typeof candidate.proof === 'string'
  )
}

function isLicenseFeature(feature: unknown): feature is LicenseFeature {
  return feature === 'paid-tools' || feature === 'batch-exports'
}

function isValidIsoDateString(value: string): boolean {
  return Number.isFinite(new Date(value).getTime())
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
