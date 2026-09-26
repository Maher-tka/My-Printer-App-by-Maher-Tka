import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import electronUpdater, { type ProgressInfo, type UpdateInfo } from 'electron-updater'
import type { AppUpdateActionResult, AppUpdateSnapshot } from '../shared/update-types.js'
import { hasUnsavedProject } from './project-persistence.js'
import { recordAppError } from './release-runtime.js'

const FIRST_CHECK_DELAY_MS = 15_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000
const STATE_EVENT = 'updates:state-changed'

let state: AppUpdateSnapshot
let checkInProgress: Promise<AppUpdateActionResult> | null = null
let handlersRegistered = false
let updaterConfigured = false

const { autoUpdater } = electronUpdater

export function registerAppUpdaterHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  state = createInitialState()

  ipcMain.handle('updates:get-state', (): AppUpdateSnapshot => ({ ...state }))
  ipcMain.handle('updates:check', checkForUpdates)
  ipcMain.handle('updates:install', installDownloadedUpdate)

  if (!state.enabled) return

  configureUpdater()

  const firstCheckTimer = setTimeout(() => {
    void checkForUpdates()
  }, FIRST_CHECK_DELAY_MS)
  firstCheckTimer.unref()

  const recurringCheckTimer = setInterval(() => {
    void checkForUpdates()
  }, CHECK_INTERVAL_MS)
  recurringCheckTimer.unref()
}

function createInitialState(): AppUpdateSnapshot {
  if (!app.isPackaged) {
    return {
      enabled: false,
      status: 'disabled',
      currentVersion: app.getVersion(),
      message: 'Automatic updates are available in the installed app.'
    }
  }

  return {
    enabled: true,
    status: 'idle',
    currentVersion: app.getVersion(),
    message: 'Updates are checked automatically.'
  }
}

function configureUpdater(): void {
  if (updaterConfigured) return
  updaterConfigured = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    updateState({
      status: 'checking',
      message: 'Checking for updates…',
      downloadPercent: undefined
    })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    updateState({
      status: 'available',
      availableVersion: info.version,
      releaseDate: info.releaseDate,
      message: `Version ${info.version} is available. Downloading…`
    })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent)))
    updateState({
      status: 'downloading',
      downloadPercent: percent,
      message: `Downloading update… ${percent}%`
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    updateState({
      status: 'downloaded',
      availableVersion: info.version,
      releaseDate: info.releaseDate,
      downloadPercent: 100,
      message: `Version ${info.version} is ready. Restart to finish updating.`
    })
    showReadyNotification(info.version)
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    updateState({
      status: 'up-to-date',
      availableVersion: undefined,
      releaseDate: info.releaseDate,
      downloadPercent: undefined,
      message: `Version ${state.currentVersion} is up to date.`,
      lastCheckedAt: new Date().toISOString()
    })
  })

  autoUpdater.on('error', (error: Error) => {
    recordAppError('app-updater', error)
    updateState({
      status: 'error',
      message: getErrorMessage(error),
      downloadPercent: undefined,
      lastCheckedAt: new Date().toISOString()
    })
  })
}

async function checkForUpdates(): Promise<AppUpdateActionResult> {
  if (!state.enabled) {
    return { ok: false, state: { ...state }, error: state.message }
  }

  if (state.status === 'downloaded') {
    return { ok: true, state: { ...state } }
  }

  if (checkInProgress) return checkInProgress

  checkInProgress = runUpdateCheck()

  try {
    return await checkInProgress
  } finally {
    checkInProgress = null
  }
}

async function runUpdateCheck(): Promise<AppUpdateActionResult> {
  try {
    await autoUpdater.checkForUpdates()
    updateState({ lastCheckedAt: new Date().toISOString() })
    return { ok: true, state: { ...state } }
  } catch (error) {
    recordAppError('app-updater-check', error)
    updateState({
      status: 'error',
      message: getErrorMessage(error),
      downloadPercent: undefined,
      lastCheckedAt: new Date().toISOString()
    })
    return { ok: false, state: { ...state }, error: getErrorMessage(error) }
  }
}

function installDownloadedUpdate(): AppUpdateActionResult {
  if (state.status !== 'downloaded') {
    const error = 'No downloaded update is ready to install.'
    return { ok: false, state: { ...state }, error }
  }

  if (BrowserWindow.getAllWindows().some(hasUnsavedProject)) {
    const error = 'Save your open project before restarting to update.'
    updateState({ message: error })
    return { ok: false, state: { ...state }, error }
  }

  setTimeout(() => autoUpdater.quitAndInstall(false, true), 200)
  return { ok: true, state: { ...state } }
}

function updateState(changes: Partial<AppUpdateSnapshot>): void {
  state = { ...state, ...changes }

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(STATE_EVENT, { ...state })
    }
  }
}

function showReadyNotification(version: string): void {
  if (!Notification.isSupported()) return

  new Notification({
    title: 'My Printer App update ready',
    body: `Version ${version} will install when you close the app, or restart now from Settings.`
  }).show()
}

function getErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  return `Could not check for updates. ${detail}`
}
