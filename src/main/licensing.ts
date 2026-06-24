import { app, ipcMain, safeStorage } from 'electron'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
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
const LICENSE_INTEGRITY_KEY_FILE_NAME = 'license-integrity.key'
const LICENSE_FILE_VERSION = 3
const LICENSE_INTEGRITY_KEY_FILE_VERSION = 1
const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000
const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000

let licenseIntegrityKeyPromise: Promise<Buffer> | undefined
let licenseOperationQueue: Promise<void> = Promise.resolve()

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

interface LicenseRecordContext {
  record: PersistedLicenseFile
  integrityKey: Buffer
}

interface PersistedIntegrityKey {
  version: typeof LICENSE_INTEGRITY_KEY_FILE_VERSION
  protected: boolean
  value: string
}

export function registerLicenseHandlers(): void {
  ipcMain.handle('license:get-state', async () => runLicenseOperation(getLicenseSnapshot))
  ipcMain.handle('license:activate-serial', async (_event, serialKey: string) =>
    runLicenseOperation(() => activateSerialKey(serialKey))
  )
}

function runLicenseOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = licenseOperationQueue.then(operation, operation)
  licenseOperationQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

async function getLicenseSnapshot(): Promise<LicenseSnapshot> {
  const { record, integrityKey } = await loadOrCreateLicenseRecord()
  const clock = getEffectiveClock(record)

  await updateLastSeen(record, clock.now, integrityKey)

  return buildLicenseSnapshot(record, clock, integrityKey)
}

async function activateSerialKey(serialKey: string): Promise<LicenseActivationResult> {
  const { record, integrityKey } = await loadOrCreateLicenseRecord()
  const clock = getEffectiveClock(record)
  const validation = validateOfflineSerialKey(serialKey, clock.now)

  if (!validation.ok) {
    return {
      ok: false,
      state: buildLicenseSnapshot(record, clock, integrityKey),
      error: validation.error
    }
  }

  const activation: PersistedActivation = {
    ...validation.license,
    activatedAt: clock.now.toISOString(),
    proof: ''
  }

  activation.proof = createActivationProof(record.installationId, activation, integrityKey)
  record.activation = activation
  await updateLastSeen(record, clock.now, integrityKey, true)

  return {
    ok: true,
    state: buildLicenseSnapshot(record, clock, integrityKey),
    message: 'Serial key activated locally.'
  }
}

async function loadOrCreateLicenseRecord(): Promise<LicenseRecordContext> {
  const integrityKey = await getLicenseIntegrityKey()
  const existingRecord = await readLicenseRecord(integrityKey)

  if (existingRecord) {
    return { record: existingRecord, integrityKey }
  }

  const now = new Date()
  const record = createNewLicenseRecord(now)

  await writeLicenseRecord(record, integrityKey)

  return { record, integrityKey }
}

async function readLicenseRecord(integrityKey: Buffer): Promise<PersistedLicenseFile | undefined> {
  const licenseFilePath = getLicenseFilePath()

  try {
    const rawRecord = await readFile(licenseFilePath, 'utf-8')
    const parsedRecord = JSON.parse(rawRecord) as Partial<PersistedLicenseFile>

    if (!isPersistedLicenseFile(parsedRecord, integrityKey)) {
      throw new Error('License file is not in the expected format.')
    }

    return parsedRecord
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return undefined
    }

    await backupCorruptLicenseFile(licenseFilePath)

    const recoveredRecord = createNewLicenseRecord(new Date(), true)
    await writeLicenseRecord(recoveredRecord, integrityKey)

    return recoveredRecord
  }
}

async function writeLicenseRecord(
  record: PersistedLicenseFile,
  integrityKey: Buffer
): Promise<void> {
  const licenseFilePath = getLicenseFilePath()
  const temporaryPath = `${licenseFilePath}.${randomUUID()}.tmp`

  record.recordProof = createRecordProof(record, integrityKey)
  await mkdir(dirname(licenseFilePath), { recursive: true })
  await writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, 'utf-8')
  await rename(temporaryPath, licenseFilePath)
}

function createNewLicenseRecord(now: Date, trialExpired = false): PersistedLicenseFile {
  const trialStartedAt = trialExpired ? new Date(now.getTime() - TRIAL_LENGTH_MS) : now
  const trialEndsAt = trialExpired ? now : new Date(now.getTime() + TRIAL_LENGTH_MS)

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
  integrityKey: Buffer,
  forceWrite = false
): Promise<void> {
  const lastSeenAt = new Date(record.lastSeenAt)

  if (forceWrite || now.getTime() > lastSeenAt.getTime()) {
    record.lastSeenAt = now.toISOString()
    await writeLicenseRecord(record, integrityKey)
  }
}

function buildLicenseSnapshot(
  record: PersistedLicenseFile,
  clock: EffectiveClock,
  integrityKey: Buffer
): LicenseSnapshot {
  const trialEndsAt = new Date(record.trialEndsAt)
  const remainingMs = Math.max(0, trialEndsAt.getTime() - clock.now.getTime())
  const trialIsExpired = remainingMs <= 0
  const activationIssue = getActivationIntegrityIssue(record, integrityKey)
  const activation = activationIssue
    ? undefined
    : getCurrentActivation(record.activation, clock.now)
  const mode: LicenseMode = activation ? 'activated' : trialIsExpired ? 'expired' : 'trial'
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
  record: PersistedLicenseFile,
  integrityKey: Buffer
): string | undefined {
  if (!record.activation) {
    return undefined
  }

  const expectedProof = createActivationProof(
    record.installationId,
    record.activation,
    integrityKey
  )

  return record.activation.proof === expectedProof
    ? undefined
    : 'The saved activation record could not be verified.'
}

function createActivationProof(
  installationId: string,
  activation: PersistedActivation,
  integrityKey: Buffer
): string {
  return createHmac('sha256', integrityKey)
    .update(
      [
        'activation-proof-v1',
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

function createRecordProof(record: PersistedLicenseFile, integrityKey: Buffer): string {
  return createHmac('sha256', integrityKey)
    .update(
      [
        'license-record-v3',
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

function getLicenseIntegrityKeyPath(): string {
  return join(app.getPath('userData'), LICENSE_INTEGRITY_KEY_FILE_NAME)
}

function isPersistedLicenseFile(
  record: Partial<PersistedLicenseFile>,
  integrityKey: Buffer
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
    (record.activation === undefined || isPersistedActivation(record.activation)) &&
    record.recordProof === createRecordProof(record as PersistedLicenseFile, integrityKey)
  )
}

function isPersistedActivation(activation: unknown): activation is PersistedActivation {
  if (typeof activation !== 'object' || activation === null || !('plan' in activation)) {
    return false
  }

  const candidate = activation as Partial<PersistedActivation>

  return (
    (candidate.plan === 'pro' || candidate.plan === 'shop') &&
    typeof candidate.planLabel === 'string' &&
    typeof candidate.activatedAt === 'string' &&
    isValidIsoDateString(candidate.activatedAt) &&
    (candidate.expiresAt === undefined ||
      (typeof candidate.expiresAt === 'string' && isValidIsoDateString(candidate.expiresAt))) &&
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

function getLicenseIntegrityKey(): Promise<Buffer> {
  licenseIntegrityKeyPromise ??= loadOrCreateLicenseIntegrityKey()
  return licenseIntegrityKeyPromise
}

async function loadOrCreateLicenseIntegrityKey(): Promise<Buffer> {
  const keyFilePath = getLicenseIntegrityKeyPath()

  try {
    const rawKeyFile = await readFile(keyFilePath, 'utf-8')
    const parsedKeyFile = JSON.parse(rawKeyFile) as Partial<PersistedIntegrityKey>
    const integrityKey = decodeIntegrityKey(parsedKeyFile)

    if (integrityKey.length !== 32) {
      throw new Error('Local license integrity key has an unexpected length.')
    }

    return integrityKey
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      await backupCorruptLicenseFile(keyFilePath)
    }

    const integrityKey = randomBytes(32)
    await writeLicenseIntegrityKey(keyFilePath, integrityKey)
    return integrityKey
  }
}

function decodeIntegrityKey(keyFile: Partial<PersistedIntegrityKey>): Buffer {
  if (
    keyFile.version !== LICENSE_INTEGRITY_KEY_FILE_VERSION ||
    typeof keyFile.protected !== 'boolean' ||
    typeof keyFile.value !== 'string'
  ) {
    throw new Error('Local license integrity key is not in the expected format.')
  }

  if (keyFile.protected) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Operating-system protected storage is unavailable.')
    }

    return Buffer.from(safeStorage.decryptString(Buffer.from(keyFile.value, 'base64')), 'base64')
  }

  return Buffer.from(keyFile.value, 'base64')
}

async function writeLicenseIntegrityKey(keyFilePath: string, integrityKey: Buffer): Promise<void> {
  const encryptionAvailable = safeStorage.isEncryptionAvailable()
  const keyFile: PersistedIntegrityKey = {
    version: LICENSE_INTEGRITY_KEY_FILE_VERSION,
    protected: encryptionAvailable,
    value: encryptionAvailable
      ? safeStorage.encryptString(integrityKey.toString('base64')).toString('base64')
      : integrityKey.toString('base64')
  }
  const temporaryPath = `${keyFilePath}.tmp`

  await mkdir(dirname(keyFilePath), { recursive: true })
  await writeFile(temporaryPath, `${JSON.stringify(keyFile, null, 2)}\n`, {
    encoding: 'utf-8',
    mode: 0o600
  })
  await rename(temporaryPath, keyFilePath)
}
