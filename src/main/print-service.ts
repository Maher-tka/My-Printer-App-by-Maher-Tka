import { app, BrowserWindow, ipcMain } from 'electron'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  createPrintDialogResult,
  getPrintPdfFileRequestError,
  getPrintPdfRequestError,
  isPdfByteSource,
  normalizePdfPrintName,
  type PdfPrintBytes,
  type PrintPdfFileRequest,
  type PrintPdfRequest,
  type PrintPdfResult
} from '../shared/print-types.js'
import { recordAppError } from './release-runtime.js'
import { assertOnlineProductionAccess } from './online-account.js'

const PRINT_TEMP_FOLDER = 'my-printer-app-print'
const activeTempFiles = new Set<string>()

export function registerPrintHandlers(): void {
  ipcMain.handle('print:pdf', async (_event, request: PrintPdfRequest) => {
    try {
      const validationError = getPrintPdfRequestError(request)
      if (validationError) return failedPrint(validationError)

      await assertOnlineProductionAccess()

      const pdfName = normalizePdfPrintName(request.suggestedName)
      const tempPath = await writeTempPdf(pdfName, toBuffer(request.bytes))
      return await printPdfFile(tempPath, {
        cleanupAfterPrint: true,
        jobTitle: request.jobTitle,
        pdfName,
        silent: request.silent === true
      })
    } catch (error) {
      recordAppError('print-pdf', error)
      return failedPrint(getErrorMessage(error))
    }
  })

  ipcMain.handle('print:pdf-file', async (_event, request: PrintPdfFileRequest) => {
    try {
      const validationError = getPrintPdfFileRequestError(request)
      if (validationError) return failedPrint(validationError)

      const bytes = await readFile(request.filePath)
      await assertOnlineProductionAccess()
      if (!isPdfByteSource(bytes)) return failedPrint('Print requires a valid PDF file.')

      return await printPdfFile(request.filePath, {
        cleanupAfterPrint: false,
        jobTitle: request.jobTitle,
        pdfName: normalizePdfPrintName(request.suggestedName ?? basename(request.filePath)),
        silent: request.silent === true
      })
    } catch (error) {
      recordAppError('print-pdf-file', error)
      return failedPrint(getErrorMessage(error))
    }
  })

  app.once('before-quit', () => {
    for (const filePath of activeTempFiles) {
      void cleanupTempPdf(filePath)
    }
  })
}

async function printPdfFile(
  filePath: string,
  options: {
    cleanupAfterPrint: boolean
    jobTitle?: string
    pdfName: string
    silent: boolean
  }
): Promise<PrintPdfResult> {
  const window = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: options.jobTitle || options.pdfName,
    backgroundColor: '#f6f8fb',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true
    }
  })

  try {
    await window.loadURL(pathToFileURL(filePath).toString())
    await waitForPdfViewer()
    const result = await printWindow(window, options.silent)

    if (result.ok) {
      return {
        ...result,
        pdfName: options.pdfName
      }
    }

    return result
  } finally {
    if (!window.isDestroyed()) window.close()
    if (options.cleanupAfterPrint) await cleanupTempPdf(filePath)
  }
}

function printWindow(window: BrowserWindow, silent: boolean): Promise<PrintPdfResult> {
  return new Promise((resolve) => {
    window.webContents.print(
      {
        silent,
        printBackground: true
      },
      (success, failureReason) => {
        resolve(createPrintDialogResult(success, failureReason))
      }
    )
  })
}

async function writeTempPdf(fileName: string, bytes: Buffer): Promise<string> {
  const tempFolder = join(app.getPath('temp'), PRINT_TEMP_FOLDER)
  await mkdir(tempFolder, { recursive: true })
  const safeName = sanitizeFileName(fileName)
  const filePath = join(tempFolder, `${Date.now()}-${safeName}`)
  activeTempFiles.add(filePath)
  await writeFile(filePath, bytes)
  return filePath
}

async function cleanupTempPdf(filePath: string): Promise<void> {
  activeTempFiles.delete(filePath)
  await rm(filePath, { force: true }).catch(() => undefined)
}

function sanitizeFileName(fileName: string): string {
  return normalizePdfPrintName(fileName)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function toBuffer(bytes: PdfPrintBytes): Buffer {
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes)
  return Buffer.from(bytes)
}

function failedPrint(error: string): PrintPdfResult {
  return { ok: false, error }
}

function waitForPdfViewer(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 350)
  })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong while printing.'
}
