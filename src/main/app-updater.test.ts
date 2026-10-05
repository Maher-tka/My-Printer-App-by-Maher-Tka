import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import type { AppUpdateActionResult, AppUpdateSnapshot } from '../shared/update-types.js'

// Exercise the real main-process module through its IPC and updater events, without
// starting Electron, touching the Windows installer, or contacting a release server.
const source = ts.transpileModule(
  readFileSync(new URL('./app-updater.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }
).outputText

function createHarness(options: { packaged?: boolean; portable?: boolean } = {}) {
  const ipc = new Map<string, () => unknown>()
  const intervals: { callback: () => void; delay: number }[] = []
  const timeouts: { callback: () => void; delay: number; active: boolean }[] = []
  const notifications: string[] = []
  const errors: unknown[] = []
  const sentStates: AppUpdateSnapshot[] = []
  const window = {
    dirty: false,
    isDestroyed: () => false,
    webContents: { send: (_event: string, state: AppUpdateSnapshot) => sentStates.push(state) }
  }
  const events = new EventEmitter()
  const updater = Object.assign(events, {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: true,
    checks: 0,
    failure: undefined as Error | undefined,
    checkPromise: undefined as Promise<null> | undefined,
    downloadPromise: undefined as Promise<string[]> | undefined,
    installCalls: [] as boolean[][],
    async checkForUpdates() {
      this.checks++
      events.emit('checking-for-update')
      if (this.failure) throw this.failure
      if (this.checkPromise) return this.checkPromise
      if (this.downloadPromise) {
        events.emit('update-available', { version: '0.2.2' })
        return { downloadPromise: this.downloadPromise }
      }
      return null
    },
    quitAndInstall(...args: boolean[]) {
      this.installCalls.push(args)
    }
  })
  const module = { exports: {} as { registerAppUpdaterHandlers: () => void } }
  runInNewContext(source, {
    module,
    exports: module.exports,
    process: { env: options.portable ? { PORTABLE_EXECUTABLE_FILE: 'portable.exe' } : {} },
    setInterval(callback: () => void, delay: number) {
      intervals.push({ callback, delay })
      return { unref() {} }
    },
    setTimeout(callback: () => void, delay: number) {
      const timer = { callback, delay, active: true }
      timeouts.push(timer)
      return timer
    },
    clearTimeout(timer: (typeof timeouts)[number] | undefined) {
      if (timer) timer.active = false
    },
    require(name: string) {
      switch (name) {
        case 'electron':
          return {
            app: { isPackaged: options.packaged ?? true, getVersion: () => '0.2.1' },
            BrowserWindow: { getAllWindows: () => [window] },
            ipcMain: {
              handle: (channel: string, handler: () => unknown) => ipc.set(channel, handler)
            },
            Notification: class {
              static isSupported() {
                return true
              }
              constructor(private options: { body: string }) {}
              show() {
                notifications.push(this.options.body)
              }
            }
          }
        case 'electron-updater':
          return { autoUpdater: updater }
        case './project-persistence.js':
          return { hasUnsavedProject: (candidate: typeof window) => candidate.dirty }
        case './release-runtime.js':
          return { recordAppError: (_area: string, error: unknown) => errors.push(error) }
        default:
          throw new Error(`Unexpected updater dependency: ${name}`)
      }
    }
  })
  return {
    register: module.exports.registerAppUpdaterHandlers,
    getState: () => ipc.get('updates:get-state')!() as AppUpdateSnapshot,
    check: async () => ipc.get('updates:check')!() as Promise<AppUpdateActionResult>,
    install: () => ipc.get('updates:install')!() as AppUpdateActionResult,
    updater,
    window,
    intervals,
    timeouts,
    notifications,
    errors,
    sentStates
  }
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve))

const installed = createHarness()
installed.register()
assert.equal(installed.updater.checks, 1, 'Installed app checks at startup without a delay')
assert.equal(installed.getState().startupPending, true, 'Workspace waits for the startup check')
assert.equal(installed.timeouts[0].delay, 15_000, 'A stalled server cannot block startup forever')
assert.equal(installed.updater.autoDownload, true)
assert.equal(installed.updater.autoInstallOnAppQuit, true)
assert.equal(installed.updater.allowPrerelease, false, 'Use the published normal update feed')
assert.equal(installed.intervals[0].delay, 6 * 60 * 60 * 1000)
installed.register()
assert.equal(installed.updater.checks, 1, 'Repeated registration does not duplicate startup checks')
await settle()
assert.equal(installed.getState().startupPending, false)
assert.ok(
  installed.timeouts.every((timer) => !timer.active),
  'Completed check clears its deadline'
)
installed.updater.emit('update-not-available', { version: '0.2.1' })
assert.equal(installed.getState().status, 'up-to-date')
assert.ok(installed.getState().lastCheckedAt)
installed.intervals[0].callback()
await settle()
assert.equal(installed.updater.checks, 2, 'Long-running sessions periodically check again')

installed.updater.emit('update-available', { version: '0.2.2' })
await installed.check()
assert.equal(installed.updater.checks, 2, 'A queued download is not interrupted by another check')
installed.updater.emit('download-progress', { percent: 42.4 })
assert.equal(installed.getState().status, 'downloading')
assert.equal(installed.getState().downloadPercent, 42)
await installed.check()
assert.equal(installed.updater.checks, 2, 'Manual checks do not restart an active download')
assert.equal(installed.install().ok, false, 'An incomplete download cannot be installed')
installed.updater.emit('update-downloaded', { version: '0.2.2' })
assert.equal(installed.getState().status, 'downloaded')
assert.equal(installed.getState().downloadPercent, 100)
assert.equal(installed.notifications.length, 1)
assert.equal(installed.updater.installCalls.length, 0, 'Downloads do not interrupt current work')
installed.window.dirty = true
assert.equal(installed.install().ok, false, 'Unsaved work blocks the restart')
assert.ok(installed.timeouts.every((timer) => !timer.active))
installed.window.dirty = false
assert.equal(installed.install().ok, true)
assert.equal(installed.getState().status, 'installing')
assert.equal(installed.install().ok, false, 'Repeated clicks cannot schedule another install')
installed.timeouts.find((timer) => timer.active && timer.delay === 200)!.callback()
assert.deepEqual(installed.updater.installCalls, [[false, true]])
assert.ok(installed.sentStates.some((state) => state.status === 'downloading'))

for (const options of [{ packaged: false }, { portable: true }]) {
  const disabled = createHarness(options)
  disabled.register()
  assert.equal(disabled.getState().enabled, false)
  assert.equal(disabled.updater.checks, 0)
  assert.equal(disabled.intervals.length, 0)
  assert.equal((await disabled.check()).ok, false)
}

const offline = createHarness()
offline.updater.failure = new Error('Network unavailable')
offline.register()
await settle()
assert.equal(offline.getState().status, 'error', 'Offline startup is handled without crashing')
assert.equal(offline.getState().startupPending, false, 'Offline startup opens the workspace')
assert.equal(offline.errors.length, 1)
offline.updater.failure = undefined
assert.equal((await offline.check()).ok, true, 'A failed startup check can be retried')

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const automatic = createHarness()
const download = deferred<string[]>()
automatic.updater.downloadPromise = download.promise
automatic.register()
await settle()
assert.equal(automatic.getState().startupPending, true)
automatic.updater.emit('download-progress', { percent: 55 })
assert.equal(automatic.getState().downloadPercent, 55)
assert.equal(automatic.install().ok, false)
automatic.updater.emit('update-downloaded', { version: '0.2.2' })
assert.equal(
  automatic.notifications.length,
  0,
  'Startup download does not request a manual restart'
)
download.resolve(['update.exe'])
await settle()
assert.equal(automatic.getState().startupPending, true, 'Workspace stays closed while installing')
assert.equal(automatic.getState().status, 'installing')
automatic.timeouts.find((timer) => timer.active && timer.delay === 200)!.callback()
assert.deepEqual(
  automatic.updater.installCalls,
  [[true, true]],
  'Startup installs silently and relaunches'
)
assert.ok(automatic.timeouts.filter((timer) => timer.delay !== 200).every((timer) => !timer.active))
automatic.updater.emit('error', new Error('Installer canceled'))
assert.equal(automatic.getState().startupPending, false, 'Installer failure releases the workspace')

const canceledInstall = createHarness()
const cachedDownload = deferred<string[]>()
canceledInstall.updater.downloadPromise = cachedDownload.promise
canceledInstall.register()
await settle()
canceledInstall.updater.emit('update-downloaded', { version: '0.2.2' })
cachedDownload.resolve(['update.exe'])
await settle()
canceledInstall.updater.emit('error', new Error('Installation canceled before restart'))
canceledInstall.timeouts.find((timer) => timer.active && timer.delay === 200)!.callback()
assert.equal(
  canceledInstall.updater.installCalls.length,
  0,
  'A released workspace cannot be restarted by a queued startup install'
)

const stalled = createHarness()
const slowCheck = deferred<null>()
stalled.updater.checkPromise = slowCheck.promise
stalled.register()
stalled.timeouts.find((timer) => timer.active && timer.delay === 15_000)!.callback()
await settle()
assert.equal(stalled.getState().startupPending, false)
assert.equal(stalled.getState().status, 'error')
slowCheck.resolve(null)
await settle()
assert.equal(stalled.updater.installCalls.length, 0)

for (const outcome of ['timeout', 'failure'] as const) {
  const interrupted = createHarness()
  const pending = deferred<string[]>()
  interrupted.updater.downloadPromise = pending.promise
  interrupted.register()
  await settle()
  if (outcome === 'timeout')
    interrupted.timeouts.find((timer) => timer.active && timer.delay === 600_000)!.callback()
  else pending.reject(new Error('Download failed'))
  await settle()
  assert.equal(interrupted.getState().startupPending, false)
  assert.equal(interrupted.getState().status, 'error')
  interrupted.updater.emit('update-downloaded', { version: '0.2.2' })
  pending.resolve(['update.exe'])
  await settle()
  assert.equal(
    interrupted.updater.installCalls.length,
    0,
    'Late downloads cannot restart an open workspace'
  )
  assert.equal(interrupted.notifications.length, 1)
}

console.log(
  'Startup install, deadlines, background updates, retry and unsaved-project protection tests passed.'
)
