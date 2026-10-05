import { app, ipcMain, safeStorage, shell } from 'electron'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { writeJsonAtomically } from './atomic-json.js'
import { cloudLicenseSnapshot, resolveCloudAccessStatus } from '../shared/cloud-access.js'
import type {
  AccountMutationResult,
  AccountSnapshot,
  AccessAdminSnapshot,
  AdminAccessAction,
  CreateAccountRequest,
  SignInRequest,
  SubmitAccessRequest,
  AccessGrantRecord,
  AccessRequestRecord
} from '../shared/account-types.js'
import type { SubscriptionPlanRecord } from '../shared/account-types.js'
import { productionAccessError, type SubscriptionToolId } from '../shared/subscription-tools.js'

declare const __PRINTER_SUPABASE_URL__: string
declare const __PRINTER_SUPABASE_KEY__: string
declare const __PRINTER_DEV_UNLOCK__: boolean

const compiledUrl = typeof __PRINTER_SUPABASE_URL__ === 'string' ? __PRINTER_SUPABASE_URL__ : ''
const compiledKey = typeof __PRINTER_SUPABASE_KEY__ === 'string' ? __PRINTER_SUPABASE_KEY__ : ''
const url = process.env.PRINTER_SUPABASE_URL || compiledUrl
const key = process.env.PRINTER_SUPABASE_PUBLISHABLE_KEY || compiledKey
let client: SupabaseClient | undefined
let queue: Promise<unknown> = Promise.resolve()
let valuesPromise: Promise<Record<string, string>> | undefined
let cancelGoogle: (() => void) | undefined

export function isOnlineAccessEnabled(): boolean {
  // Local credentials are retained only for explicitly selected non-packaged tests.
  return app.isPackaged || process.env.PRINTER_ACCOUNT_MODE !== 'local-test'
}

export function isDevelopmentAccessUnlocked(): boolean {
  return !app.isPackaged && typeof __PRINTER_DEV_UNLOCK__ !== 'undefined' && __PRINTER_DEV_UNLOCK__
}

function run<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work, work)
  queue = result.catch(() => {})
  return result
}

const sessionPath = (): string => join(app.getPath('userData'), 'online-account-session.json')

async function loadValues(): Promise<Record<string, string>> {
  valuesPromise ??= (async () => {
    try {
      const envelope = JSON.parse(await readFile(sessionPath(), 'utf8'))
      if (envelope.version !== 1 || typeof envelope.value !== 'string')
        throw new Error('Invalid account session file.')
      if (!safeStorage.isEncryptionAvailable())
        throw new Error('Windows secure storage is unavailable.')
      const values = JSON.parse(safeStorage.decryptString(Buffer.from(envelope.value, 'base64')))
      if (
        !values ||
        typeof values !== 'object' ||
        Object.values(values).some((value) => typeof value !== 'string')
      )
        throw new Error('Invalid account session data.')
      return values as Record<string, string>
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw error
    }
  })()
  return valuesPromise
}

async function storeValue(name: string, value: string | null): Promise<void> {
  if (!safeStorage.isEncryptionAvailable())
    throw new Error('Windows secure storage is unavailable. Sign-in cannot be saved securely.')
  const values = await loadValues()
  if (value === null) delete values[name]
  else values[name] = value
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeJsonAtomically(sessionPath(), {
    version: 1,
    value: safeStorage.encryptString(JSON.stringify(values)).toString('base64')
  })
}

function getClient(): SupabaseClient {
  if (!url || !key)
    throw new Error(
      'Online accounts are not configured. Add the Supabase project URL and publishable key, then restart the app.'
    )
  const parsed = new URL(url)
  if (
    parsed.protocol !== 'https:' &&
    !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))
  )
    throw new Error('The account service must use HTTPS.')
  let publicKey = key.startsWith('sb_publishable_')
  if (!publicKey) {
    try {
      publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'
    } catch {
      /* Invalid public key. */
    }
  }
  if (!publicKey)
    throw new Error(
      'Use a Supabase publishable key. Secret and service-role keys must never be used in this app.'
    )
  client ??= createClient(url, key, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: async (name) => (await loadValues())[name] ?? null,
        setItem: async (name, value) => storeValue(name, value),
        removeItem: async (name) => storeValue(name, null)
      }
    },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(12_000) })
    }
  })
  return client
}

function signedOut(error?: string): AccountSnapshot {
  return {
    status: 'signed-out',
    accountExists: false,
    storageMode: 'electron-user-data',
    cloud: {
      configured: Boolean(url && key),
      isAdmin: false,
      status: error ? 'unavailable' : 'none',
      checkedAt: new Date().toISOString(),
      ...(error ? { error } : {})
    }
  }
}

function profile(user: User): AccountSnapshot['profile'] {
  return {
    id: user.id,
    email: user.email ?? '',
    displayName: String(
      user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || 'Customer'
    ),
    createdAt: user.created_at,
    lastSignedInAt: user.last_sign_in_at ?? user.created_at
  }
}

async function snapshot(): Promise<AccountSnapshot> {
  let state = signedOut()
  try {
    const supabase = getClient()
    const session = await supabase.auth.getSession()
    if (session.error) throw session.error
    if (!session.data.session) return state
    state = {
      ...state,
      status: 'signed-in',
      accountExists: true,
      profile: profile(session.data.session.user)
    }
    const result = await supabase.auth.getUser()
    if (result.error) throw result.error
    if (!result.data.user?.email_confirmed_at)
      throw new Error('Verify your email before requesting access.')
    const access = await supabase.rpc('printer_access_snapshot')
    if (access.error) throw access.error
    const data = access.data as {
      server_now: string
      is_admin: boolean
      grant: AccessGrantRecord | null
      request: AccessRequestRecord | null
      allowed_tools?: SubscriptionToolId[]
      batch_exports?: boolean
    }
    if (!data || !Number.isFinite(Date.parse(data.server_now)))
      throw new Error('The account service returned an invalid access response.')
    return {
      ...state,
      profile: profile(result.data.user),
      cloud: {
        configured: true,
        isAdmin: data.is_admin === true,
        checkedAt: new Date().toISOString(),
        serverNow: data.server_now,
        allowedTools: data.allowed_tools ?? [],
        batchExports: data.batch_exports ?? false,
        status: resolveCloudAccessStatus(
          data.grant ?? undefined,
          data.request ?? undefined,
          data.server_now
        ),
        ...(data.grant ? { grant: data.grant } : {}),
        ...(data.request ? { request: data.request } : {})
      }
    }
  } catch (error) {
    return {
      ...state,
      cloud: {
        configured: Boolean(url && key),
        isAdmin: false,
        status: 'unavailable',
        checkedAt: new Date().toISOString(),
        error: friendlyError(error)
      }
    }
  }
}

function friendlyError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'The account service is unavailable.'
  if (/fetch|timeout|network|aborted/i.test(message))
    return 'Cannot reach the account service. Check your internet connection and retry; the free backend may need restoring.'
  if (/printer_.*does not exist|schema cache/i.test(message))
    return 'The access database is not installed yet. Ask the owner to finish backend setup.'
  return message
}

async function mutate(work: () => Promise<string | void>): Promise<AccountMutationResult> {
  try {
    const message = await work()
    return { ok: true, state: await snapshot(), ...(message ? { message } : {}) }
  } catch (error) {
    return { ok: false, state: await snapshot(), error: friendlyError(error) }
  }
}

async function googleSignIn(): Promise<string> {
  if (cancelGoogle) throw new Error('A Google sign-in is already in progress.')
  const supabase = getClient()
  const state = randomBytes(24).toString('hex')
  const callback = `http://127.0.0.1:43821/auth/callback?desktop_state=${state}`
  return new Promise<string>((resolve, reject) => {
    let settled = false
    let exchanging = false
    let cancelled: Error | undefined
    const finish = (error?: Error): void => {
      if (settled) return
      // Do not let an in-flight code exchange create a session after cancellation.
      // Keep the operation queued until the bounded auth request has finished.
      if (error && exchanging) {
        cancelled = error
        return
      }
      settled = true
      clearTimeout(timer)
      cancelGoogle = undefined
      server.close()
      if (error) reject(error)
      else resolve('Signed in with Google. You can request access now.')
    }
    const server = createServer(async (request, response) => {
      response.setHeader('Content-Type', 'text/plain; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('X-Content-Type-Options', 'nosniff')
      const target = new URL(request.url ?? '/', 'http://127.0.0.1:43821')
      if (
        request.method !== 'GET' ||
        request.headers.host !== '127.0.0.1:43821' ||
        target.pathname !== '/auth/callback' ||
        target.searchParams.get('desktop_state') !== state ||
        exchanging
      ) {
        response.writeHead(400).end('Invalid sign-in callback. Return to the app.')
        return
      }
      const code = target.searchParams.get('code')
      if (!code || code.length > 4096) {
        response.writeHead(400).end('Sign-in was not completed. Return to the app.')
        finish(new Error('Google sign-in was cancelled or denied.'))
        return
      }
      exchanging = true
      try {
        const result = await supabase.auth.exchangeCodeForSession(code)
        if (result.error) throw result.error
        if (cancelled) {
          await supabase.auth.signOut({ scope: 'local' })
          throw cancelled
        }
        response.end('Sign-in complete. You can close this tab and return to My Printer App.')
        exchanging = false
        finish()
      } catch {
        response.writeHead(400).end('Sign-in failed. Return to the app and try again.')
        exchanging = false
        finish(cancelled ?? new Error('Google sign-in could not be completed. Please try again.'))
      }
    })
    const timer = setTimeout(
      () => finish(new Error('Google sign-in timed out. Please try again.')),
      180_000
    )
    timer.unref()
    cancelGoogle = () => finish(new Error('Google sign-in cancelled.'))
    server.once('error', () =>
      finish(
        new Error(
          'Could not open the Google sign-in callback. Close another sign-in window and retry.'
        )
      )
    )
    server.listen(43821, '127.0.0.1', () => {
      server.unref()
      void (async () => {
        try {
          const result = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: callback, skipBrowserRedirect: true }
          })
          if (result.error || !result.data.url)
            throw result.error ?? new Error('Google sign-in is not configured.')
          const destination = new URL(result.data.url)
          if (destination.origin !== new URL(url).origin || destination.protocol !== 'https:')
            throw new Error('Invalid sign-in destination.')
          await shell.openExternal(destination.toString())
        } catch (error) {
          finish(new Error(friendlyError(error)))
        }
      })()
    })
  })
}

export function registerOnlineAccountHandlers(): void {
  ipcMain.handle('account:get-state', () => run(snapshot))
  ipcMain.handle('account:create', (_event, request: CreateAccountRequest) =>
    run(() =>
      mutate(async () => {
        if (
          typeof request?.displayName !== 'string' ||
          request.displayName.trim().length < 2 ||
          request.displayName.length > 120 ||
          typeof request.email !== 'string' ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email.trim()) ||
          typeof request.password !== 'string' ||
          request.password.length < 8 ||
          request.password.length > 128
        )
          throw new Error('Enter a valid name, email, and password of 8–128 characters.')
        const result = await getClient().auth.signUp({
          email: request.email.trim().toLowerCase(),
          password: request.password,
          options: { data: { display_name: request.displayName.trim() } }
        })
        if (result.error) throw result.error
        return result.data.session
          ? 'Account created. Request access to continue.'
          : 'Check your email to verify your account, then sign in. If you already have an account, sign in instead.'
      })
    )
  )
  ipcMain.handle('account:sign-in', (_event, request: SignInRequest) =>
    run(() =>
      mutate(async () => {
        if (typeof request?.email !== 'string' || typeof request.password !== 'string')
          throw new Error('Enter your email and password.')
        const result = await getClient().auth.signInWithPassword({
          email: request.email.trim().toLowerCase(),
          password: request.password
        })
        if (result.error) throw result.error
        return 'Welcome back.'
      })
    )
  )
  ipcMain.handle('account:google', () => run(() => mutate(googleSignIn)))
  ipcMain.handle('account:verify-email', (_event, request: { email: string; token: string }) =>
    run(() =>
      mutate(async () => {
        if (
          typeof request?.email !== 'string' ||
          typeof request.token !== 'string' ||
          !/^\d{6,10}$/.test(request.token.trim())
        )
          throw new Error('Enter your email and the verification code from your email.')
        const result = await getClient().auth.verifyOtp({
          email: request.email.trim().toLowerCase(),
          token: request.token.trim(),
          type: 'signup'
        })
        if (result.error) throw result.error
        return 'Email verified. Request access to continue.'
      })
    )
  )
  ipcMain.handle('account:send-recovery', (_event, email: string) =>
    run(() =>
      mutate(async () => {
        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
          throw new Error('Enter your account email.')
        const result = await getClient().auth.resetPasswordForEmail(email.trim().toLowerCase())
        if (result.error) throw result.error
        return 'If this email has an account, a recovery code has been sent.'
      })
    )
  )
  ipcMain.handle(
    'account:complete-recovery',
    (_event, request: { email: string; token: string; password: string }) =>
      run(() =>
        mutate(async () => {
          if (
            typeof request?.email !== 'string' ||
            typeof request.token !== 'string' ||
            !/^\d{6,10}$/.test(request.token.trim()) ||
            typeof request.password !== 'string' ||
            request.password.length < 8 ||
            request.password.length > 128
          )
            throw new Error(
              'Enter your email, recovery code, and a new password of 8–128 characters.'
            )
          const verified = await getClient().auth.verifyOtp({
            email: request.email.trim().toLowerCase(),
            token: request.token.trim(),
            type: 'recovery'
          })
          if (verified.error) throw verified.error
          const changed = await getClient().auth.updateUser({ password: request.password })
          if (changed.error) throw changed.error
          return 'Password updated.'
        })
      )
  )
  ipcMain.handle('account:cancel-google', () => {
    cancelGoogle?.()
  })
  ipcMain.handle('account:sign-out', () => {
    cancelGoogle?.()
    return run(async () => {
      try {
        await getClient().auth.signOut({ scope: 'local' })
      } catch {
        /* Clear the local session even when the backend is unavailable. */
      } finally {
        await rm(sessionPath(), { force: true })
        valuesPromise = Promise.resolve({})
        client = undefined
      }
      return { ok: true, state: signedOut(), message: 'Signed out.' }
    })
  })
  ipcMain.handle('account:request-access', (_event, request: SubmitAccessRequest) =>
    run(() =>
      mutate(async () => {
        const result = await getClient().rpc('printer_submit_request', {
          p_shop_name: request?.shopName,
          p_message: request?.message,
          p_plan: request?.plan
        })
        if (result.error) throw result.error
        return 'Request sent. You can check its status here.'
      })
    )
  )
  ipcMain.handle('account:admin-list', () =>
    run(async (): Promise<AccessAdminSnapshot> => {
      const result = await getClient().rpc('printer_admin_list')
      if (result.error) throw new Error(friendlyError(result.error))
      return result.data as AccessAdminSnapshot
    })
  )
  ipcMain.handle('account:admin-action', (_event, action: AdminAccessAction) =>
    run(() =>
      mutate(async () => {
        const result =
          action?.action === 'manage'
            ? await getClient().rpc('printer_admin_subscription', {
                p_user_id: action.userId,
                p_plan: action.plan,
                p_tool_ids: action.toolIds ?? null,
                p_batch_exports: action.batchExports ?? null,
                p_reason: action.reason
              })
            : await getClient().rpc('printer_admin_action', {
                p_action: action?.action,
                p_user_id: action?.userId,
                p_request_id: action?.requestId ?? null,
                p_plan: action?.plan,
                p_days: action?.days,
                p_reason: action?.reason
              })
        if (result.error) throw result.error
        return 'Access decision saved.'
      })
    )
  )
  ipcMain.handle('account:admin-plan', (_event, plan: SubscriptionPlanRecord) =>
    run(() =>
      mutate(async () => {
        const result = await getClient().rpc('printer_admin_plan', {
          p_plan: plan?.plan,
          p_tool_ids: plan?.tool_ids,
          p_batch_exports: plan?.batch_exports
        })
        if (result.error) throw result.error
        return 'Subscription plan saved.'
      })
    )
  )
}

export const getOnlineAccountSnapshot = (): Promise<AccountSnapshot> => run(snapshot)
export const getOnlineLicenseSnapshot = async () =>
  cloudLicenseSnapshot(await getOnlineAccountSnapshot())

export async function assertOnlineProductionAccess(
  feature: 'paid-tools' | 'batch-exports' = 'paid-tools',
  toolId?: string
): Promise<void> {
  if (!isOnlineAccessEnabled() || isDevelopmentAccessUnlocked()) return
  const license = await getOnlineLicenseSnapshot()
  const error = productionAccessError(license, feature, toolId)
  if (error) throw new Error(error)
}
