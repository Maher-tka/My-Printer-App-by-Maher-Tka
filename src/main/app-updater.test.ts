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
  const timeouts: { callback: () => void; delay: number }[] = []
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
    installCalls: [] as boolean[][],
    async checkForUpdates() {
      this.checks++
      events.emit('checking-for-update')
      if (this.failure) throw this.failure
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
      timeouts.push({ callback, delay })
      return { unref() {} }
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
assert.equal(installed.timeouts.length, 0, 'Startup does not wait on a timeout')
assert.equal(installed.updater.autoDownload, true)
assert.equal(installed.updater.autoInstallOnAppQuit, true)
assert.equal(installed.updater.allowPrerelease, false, 'Use the published normal update feed')
assert.equal(installed.intervals[0].delay, 6 * 60 * 60 * 1000)
installed.register()
assert.equal(installed.updater.checks, 1, 'Repeated registration does not duplicate startup checks')
await settle()
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
assert.equal(installed.timeouts.length, 0)
installed.window.dirty = false
assert.equal(installed.install().ok, true)
installed.timeouts[0].callback()
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
assert.equal(offline.errors.length, 1)
offline.updater.failure = undefined
assert.equal((await offline.check()).ok, true, 'A failed startup check can be retried')

console.log('Startup update, download, retry, and unsaved-project protection tests passed.')
