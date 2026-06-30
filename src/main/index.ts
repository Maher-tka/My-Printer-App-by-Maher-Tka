import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { registerLicenseHandlers } from './licensing.js'
import { attachProjectWindowProtection, registerProjectHandlers } from './project-persistence.js'
import {
  recordAppError,
  recordExportResult,
  registerReleaseRuntimeHandlers
} from './release-runtime.js'
import type { ExportContext } from '../shared/release-types.js'

const isDevelopment = Boolean(process.env.ELECTRON_RENDERER_URL)
const DEV_SHOW_FALLBACK_MS = 3_000
const DEVTOOLS_OPEN_DELAY_MS = 4_000
const DEV_JS_FLAGS = '--max-old-space-size=4096'

if (isDevelopment) {
  app.commandLine.appendSwitch('js-flags', DEV_JS_FLAGS)
}

function createMainWindow(): void {
  logDevStartup('createMainWindow start')
  if (isDevelopment) {
    logDevStartup('ELECTRON_RENDERER_URL', process.env.ELECTRON_RENDERER_URL)
    logDevStartup('js-flags', DEV_JS_FLAGS)
  }

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'My Printer App by Maher Tka',
    backgroundColor: '#f6f8fb',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  let hasShownWindow = false
  let devFallbackTimer: NodeJS.Timeout | null = null
  let isShowingDevErrorPage = false

  const showWindow = (reason: string): void => {
    if (mainWindow.isDestroyed()) return
    if (!hasShownWindow) {
      logDevStartup(`showing main window: ${reason}`)
      mainWindow.show()
      hasShownWindow = true
    }
  }

  const clearDevFallbackTimer = (): void => {
    if (!devFallbackTimer) return
    clearTimeout(devFallbackTimer)
    devFallbackTimer = null
  }

  const showDevErrorPage = (title: string, message: string, details?: unknown): void => {
    if (!isDevelopment || mainWindow.isDestroyed() || isShowingDevErrorPage) return
    isShowingDevErrorPage = true
    showWindow(title)
    void mainWindow
      .loadURL(buildDevErrorPageUrl(title, message, details))
      .catch((error) => logMainError('dev-error-page', error))
  }

  attachProjectWindowProtection(mainWindow)

  mainWindow.once('ready-to-show', () => {
    clearDevFallbackTimer()
    showWindow('ready-to-show')
  })

  mainWindow.on('closed', () => {
    clearDevFallbackTimer()
    logDevStartup('mainWindow closed')
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      const details = { errorCode, errorDescription, validatedURL, isMainFrame }
      logMainError(
        'renderer-did-fail-load',
        new Error(`Renderer failed to load (${errorCode}): ${errorDescription}`),
        details
      )

      if (isDevelopment && isMainFrame) {
        showDevErrorPage('Renderer failed to load', errorDescription, details)
      }
    }
  )

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logMainError(
      'renderer-process-gone',
      new Error(`Renderer process gone: ${details.reason}`),
      details
    )

    if (isDevelopment) {
      showDevErrorPage('Renderer crashed', `Renderer process gone: ${details.reason}`, details)
    }
  })

  mainWindow.webContents.on('unresponsive', () => {
    logMainError('renderer-unresponsive', new Error('Renderer process became unresponsive.'))
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDevelopment) {
    devFallbackTimer = setTimeout(() => {
      showWindow(`ready-to-show fallback after ${DEV_SHOW_FALLBACK_MS}ms`)
    }, DEV_SHOW_FALLBACK_MS)
    scheduleOpenDevTools(mainWindow)
    const rendererUrl = process.env.ELECTRON_RENDERER_URL

    if (!rendererUrl) {
      const error = new Error('ELECTRON_RENDERER_URL is missing in development.')
      logMainError('renderer-url', error)
      showDevErrorPage('Renderer URL missing', error.message)
      return
    }

    void mainWindow.loadURL(rendererUrl).catch((error) => {
      logMainError('renderer-load-url', error, { rendererUrl })
      showDevErrorPage('Renderer failed to load', getErrorMessage(error), { rendererUrl })
    })
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html')).catch((error) => {
      logMainError('renderer-load-file', error)
    })
  }
}

registerProcessDiagnostics()
registerAppDiagnostics()

logDevStartup('app.whenReady start')
app
  .whenReady()
  .then(() => {
    logDevStartup('app.whenReady resolved')
    registerBookletExportHandlers()
    registerLicenseHandlers()
    registerProjectHandlers()
    registerReleaseRuntimeHandlers()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })
  })
  .catch((error) => logMainError('app-when-ready', error))

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

interface SaveFileRequest {
  suggestedName: string
  bytes: Uint8Array | ArrayBuffer | number[]
  filters: Array<{ name: string; extensions: string[] }>
}

interface WriteOutputFileRequest {
  fileName: string
  bytes: Uint8Array | ArrayBuffer | number[]
}

function registerBookletExportHandlers(): void {
  ipcMain.handle(
    'booklet:save-file',
    async (event, request: SaveFileRequest, context?: ExportContext) => {
      try {
        const owner = BrowserWindow.fromWebContents(event.sender)
        const options = {
          title: 'Save booklet montage file',
          defaultPath: request.suggestedName,
          filters: request.filters
        }
        const result = owner
          ? await dialog.showSaveDialog(owner, options)
          : await dialog.showSaveDialog(options)

        if (result.canceled || !result.filePath) {
          await recordExportResult({
            status: 'canceled',
            context,
            suggestedName: request.suggestedName
          })
          return { ok: false, canceled: true }
        }

        await writeFile(result.filePath, toBuffer(request.bytes))
        await recordExportResult({
          status: 'success',
          context,
          suggestedName: request.suggestedName,
          filePath: result.filePath
        })

        return { ok: true, filePath: result.filePath }
      } catch (error) {
        recordAppError('save-file', error)
        await recordExportResult({
          status: 'failed',
          context,
          suggestedName: request?.suggestedName ?? 'export',
          error
        })
        return { ok: false, error: getErrorMessage(error) }
      }
    }
  )

  ipcMain.handle('booklet:select-output-folder', async (event) => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender)
      const options: OpenDialogOptions = {
        title: 'Choose output folder',
        properties: ['openDirectory', 'createDirectory']
      }
      const result = owner
        ? await dialog.showOpenDialog(owner, options)
        : await dialog.showOpenDialog(options)

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true }
      }

      return { ok: true, folderPath: result.filePaths[0] }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error) }
    }
  })

  ipcMain.handle(
    'booklet:write-files-to-folder',
    async (
      _event,
      folderPath: string,
      files: WriteOutputFileRequest[],
      context?: ExportContext
    ) => {
      try {
        const folder = resolve(folderPath)
        const writtenPaths: string[] = []

        for (const file of files) {
          if (!isSafeRelativeOutputPath(file.fileName)) {
            throw new Error(`Invalid output file path: ${file.fileName}`)
          }

          const targetPath = resolve(folder, file.fileName)

          if (!isPathInsideFolder(folder, targetPath)) {
            throw new Error(`Invalid output path: ${file.fileName}`)
          }

          await mkdir(dirname(targetPath), { recursive: true })
          await writeFile(targetPath, toBuffer(file.bytes))
          writtenPaths.push(targetPath)
        }

        await recordExportResult({
          status: 'success',
          context,
          suggestedName: files[0]?.fileName ?? 'folder-export',
          filePath: writtenPaths[0] ?? folderPath
        })
        return { ok: true, filePaths: writtenPaths }
      } catch (error) {
        recordAppError('write-files-to-folder', error)
        await recordExportResult({
          status: 'failed',
          context,
          suggestedName: files[0]?.fileName ?? 'folder-export',
          error
        })
        return { ok: false, error: getErrorMessage(error) }
      }
    }
  )
}

function toBuffer(bytes: Uint8Array | ArrayBuffer | number[]): Buffer {
  if (bytes instanceof ArrayBuffer) {
    return Buffer.from(bytes)
  }

  return Buffer.from(bytes)
}

function isPathInsideFolder(folderPath: string, targetPath: string): boolean {
  const folder = folderPath.endsWith(sep) ? folderPath : `${folderPath}${sep}`
  const normalizedFolder = folder.toLowerCase()
  const normalizedTarget = targetPath.toLowerCase()

  return normalizedTarget.startsWith(normalizedFolder)
}

function isSafeRelativeOutputPath(fileName: string): boolean {
  const trimmed = fileName.trim()

  if (!trimmed || isAbsolute(trimmed)) {
    return false
  }

  return trimmed.split(/[\\/]+/).every((part) => part.length > 0 && part !== '.' && part !== '..')
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong while saving files.'
}

function registerProcessDiagnostics(): void {
  process.on('uncaughtException', (error) => {
    logMainError('uncaughtException', error)
  })

  process.on('unhandledRejection', (reason) => {
    logMainError('unhandledRejection', reason)
  })
}

function registerAppDiagnostics(): void {
  app.on('child-process-gone', (_event, details) => {
    logMainError(
      'child-process-gone',
      new Error(`Electron child process gone: ${details.type} ${details.reason}`),
      details
    )
  })
}

function openDevTools(mainWindow: BrowserWindow): void {
  try {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } catch (error) {
    logMainError('devtools', error)
  }
}

function scheduleOpenDevTools(mainWindow: BrowserWindow): void {
  setTimeout(() => {
    if (mainWindow.isDestroyed()) return
    openDevTools(mainWindow)
  }, DEVTOOLS_OPEN_DELAY_MS)
}

function logDevStartup(message: string, details?: unknown): void {
  if (!isDevelopment) return
  if (details === undefined) {
    console.error(`[electron-dev] ${message}`)
    return
  }

  console.error(`[electron-dev] ${message}`, details)
}

function logMainError(area: string, error: unknown, details?: unknown): void {
  if (details === undefined) {
    console.error(`[electron:${area}]`, error)
  } else {
    console.error(`[electron:${area}]`, error, details)
  }

  recordAppError(area, error)
}

function buildDevErrorPageUrl(title: string, message: string, details?: unknown): string {
  const detailText = details === undefined ? '' : stringifyDetails(details)
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f8fb; color: #172033; }
    main { width: min(900px, calc(100vw - 48px)); border: 1px solid #d6deea; border-radius: 12px; background: #ffffff; padding: 28px; box-shadow: 0 24px 70px rgba(15, 23, 42, 0.14); }
    p { line-height: 1.6; }
    pre { max-height: 320px; overflow: auto; border-radius: 8px; background: #111827; color: #f9fafb; padding: 16px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <main>
    <p>My Printer App could not load the development renderer.</p>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    ${detailText ? `<pre>${escapeHtml(detailText)}</pre>` : ''}
    <p>Check terminal for details.</p>
  </main>
</body>
</html>`

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function stringifyDetails(details: unknown): string {
  try {
    return JSON.stringify(details, null, 2)
  } catch {
    return String(details)
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}
