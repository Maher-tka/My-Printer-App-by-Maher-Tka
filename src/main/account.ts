import { app, ipcMain, safeStorage } from 'electron'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { isOnlineAccessEnabled, registerOnlineAccountHandlers } from './online-account.js'
import type {
  AccountMutationResult,
  AccountProfile,
  AccountSnapshot,
  CreateAccountRequest,
  SignInRequest
} from '../shared/account-types.js'

const ACCOUNT_FILE_NAME = 'account-state.json'
const ACCOUNT_FILE_VERSION = 1
const PASSWORD_HASH_BYTES = 64

let accountOperationQueue: Promise<void> = Promise.resolve()

interface PersistedAccountRecord {
  version: typeof ACCOUNT_FILE_VERSION
  id: string
  displayName: string
  email: string
  createdAt: string
  lastSignedInAt: string
  passwordSalt: string
  passwordHash: string
  isSignedIn: boolean
}

interface PersistedAccountEnvelope {
  version: typeof ACCOUNT_FILE_VERSION
  protected: boolean
  value: string
}

export function registerAccountHandlers(): void {
  if (isOnlineAccessEnabled()) {
    registerOnlineAccountHandlers()
    return
  }
  ipcMain.handle('account:get-state', () => runAccountOperation(getAccountSnapshot))
  ipcMain.handle('account:create', (_event, request: CreateAccountRequest) =>
    runAccountOperation(() => createAccount(request))
  )
  ipcMain.handle('account:sign-in', (_event, request: SignInRequest) =>
    runAccountOperation(() => signIn(request))
  )
  ipcMain.handle('account:sign-out', () => runAccountOperation(signOut))

  if (!app.isPackaged) {
    ipcMain.handle('account:reset-local', () =>
      runAccountOperation(async () => {
        await rm(getAccountFilePath(), { force: true })
        return getAccountSnapshot()
      })
    )
  }
}

function runAccountOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = accountOperationQueue.then(operation, operation)
  accountOperationQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

async function getAccountSnapshot(): Promise<AccountSnapshot> {
  const record = await readAccountRecord()
  return buildAccountSnapshot(record)
}

async function createAccount(request: CreateAccountRequest): Promise<AccountMutationResult> {
  const currentRecord = await readAccountRecord()

  if (currentRecord) {
    return {
      ok: false,
      state: buildAccountSnapshot(currentRecord),
      error: 'An account already exists on this device. Sign in to continue.'
    }
  }

  const displayName = normalizeDisplayName(request?.displayName)
  const email = normalizeEmail(request?.email)
  const password = typeof request?.password === 'string' ? request.password : ''
  const validationError = validateAccountInput(displayName, email, password)

  if (validationError) {
    return {
      ok: false,
      state: buildAccountSnapshot(undefined),
      error: validationError
    }
  }

  const now = new Date().toISOString()
  const passwordSalt = randomBytes(16).toString('hex')
  const record: PersistedAccountRecord = {
    version: ACCOUNT_FILE_VERSION,
    id: randomUUID(),
    displayName,
    email,
    createdAt: now,
    lastSignedInAt: now,
    passwordSalt,
    passwordHash: hashPassword(password, passwordSalt),
    isSignedIn: true
  }

  await writeAccountRecord(record)

  return {
    ok: true,
    state: buildAccountSnapshot(record),
    message: 'Account created. Your free trial is ready to use.'
  }
}

async function signIn(request: SignInRequest): Promise<AccountMutationResult> {
  const record = await readAccountRecord()
  const state = buildAccountSnapshot(record)

  if (!record) {
    return {
      ok: false,
      state,
      error: 'No account is registered on this device yet. Create an account first.'
    }
  }

  const email = normalizeEmail(request?.email)
  const password = typeof request?.password === 'string' ? request.password : ''

  if (!email || !password || email !== record.email || !passwordMatches(password, record)) {
    return {
      ok: false,
      state,
      error: 'The email or password is incorrect.'
    }
  }

  record.isSignedIn = true
  record.lastSignedInAt = new Date().toISOString()
  await writeAccountRecord(record)

  return {
    ok: true,
    state: buildAccountSnapshot(record),
    message: 'Welcome back.'
  }
}

async function signOut(): Promise<AccountMutationResult> {
  const record = await readAccountRecord()

  if (!record) {
    return { ok: true, state: buildAccountSnapshot(undefined) }
  }

  record.isSignedIn = false
  await writeAccountRecord(record)

  return {
    ok: true,
    state: buildAccountSnapshot(record),
    message: 'You have been signed out.'
  }
}

async function readAccountRecord(): Promise<PersistedAccountRecord | undefined> {
  let rawEnvelope: string

  try {
    rawEnvelope = await readFile(getAccountFilePath(), 'utf-8')
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return undefined
    }

    throw error
  }

  const envelope = JSON.parse(rawEnvelope) as Partial<PersistedAccountEnvelope>

  if (
    envelope.version !== ACCOUNT_FILE_VERSION ||
    typeof envelope.protected !== 'boolean' ||
    typeof envelope.value !== 'string'
  ) {
    throw new Error('The local account record is not in the expected format.')
  }

  const serialized = envelope.protected
    ? safeStorage.decryptString(Buffer.from(envelope.value, 'base64'))
    : Buffer.from(envelope.value, 'base64').toString('utf-8')
  const record = JSON.parse(serialized) as Partial<PersistedAccountRecord>

  if (!isPersistedAccountRecord(record)) {
    throw new Error('The local account record is not valid.')
  }

  return record
}

async function writeAccountRecord(record: PersistedAccountRecord): Promise<void> {
  const serialized = JSON.stringify(record)
  const encryptionAvailable = safeStorage.isEncryptionAvailable()
  const envelope: PersistedAccountEnvelope = {
    version: ACCOUNT_FILE_VERSION,
    protected: encryptionAvailable,
    value: encryptionAvailable
      ? safeStorage.encryptString(serialized).toString('base64')
      : Buffer.from(serialized, 'utf-8').toString('base64')
  }
  const accountFilePath = getAccountFilePath()
  const temporaryPath = `${accountFilePath}.${randomUUID()}.tmp`

  await mkdir(dirname(accountFilePath), { recursive: true })
  await writeFile(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, {
    encoding: 'utf-8',
    mode: 0o600
  })
  await rename(temporaryPath, accountFilePath)
}

function buildAccountSnapshot(record: PersistedAccountRecord | undefined): AccountSnapshot {
  return {
    status: record?.isSignedIn ? 'signed-in' : 'signed-out',
    accountExists: Boolean(record),
    ...(record?.isSignedIn ? { profile: toAccountProfile(record) } : {}),
    storageMode: 'electron-user-data'
  }
}

function toAccountProfile(record: PersistedAccountRecord): AccountProfile {
  return {
    id: record.id,
    displayName: record.displayName,
    email: record.email,
    createdAt: record.createdAt,
    lastSignedInAt: record.lastSignedInAt
  }
}

function validateAccountInput(displayName: string, email: string, password: string): string | null {
  if (displayName.length < 2) {
    return 'Enter your name so the workspace can be personalized.'
  }

  if (!isValidEmail(email)) {
    return 'Enter a valid email address.'
  }

  if (password.length < 8) {
    return 'Use a password with at least 8 characters.'
  }

  return null
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, PASSWORD_HASH_BYTES).toString('hex')
}

function passwordMatches(password: string, record: PersistedAccountRecord): boolean {
  const expectedHash = Buffer.from(record.passwordHash, 'hex')
  const actualHash = Buffer.from(hashPassword(password, record.passwordSalt), 'hex')

  return expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash)
}

function normalizeDisplayName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isPersistedAccountRecord(
  record: Partial<PersistedAccountRecord>
): record is PersistedAccountRecord {
  return (
    record.version === ACCOUNT_FILE_VERSION &&
    typeof record.id === 'string' &&
    typeof record.displayName === 'string' &&
    typeof record.email === 'string' &&
    isValidEmail(record.email) &&
    typeof record.createdAt === 'string' &&
    typeof record.lastSignedInAt === 'string' &&
    typeof record.passwordSalt === 'string' &&
    typeof record.passwordHash === 'string' &&
    /^[a-f0-9]{128}$/i.test(record.passwordHash) &&
    typeof record.isSignedIn === 'boolean'
  )
}

function getAccountFilePath(): string {
  return join(app.getPath('userData'), ACCOUNT_FILE_NAME)
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
