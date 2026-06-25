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

function createMainWindow(): void {
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

  attachProjectWindowProtection(mainWindow)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDevelopment) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL as string)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
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
