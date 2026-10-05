import { app, BrowserWindow, dialog } from 'electron'
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  validateIllustratorPdfExport,
  validateIllustratorPdfBatch,
  getCutterSheetPdfFileName,
  type IllustratorPdfExportRequest,
  type IllustratorPdfBatchResult,
  type IllustratorPdfExportResult
} from '../shared/illustrator-pdf-export.js'
import {
  createIllustratorPdfScript,
  type IllustratorPdfLayoutFile
} from './illustrator-pdf-script.js'

const execute = promisify(execFile)
let pending = false
export async function exportIllustratorPdf(
  request: unknown,
  owner: BrowserWindow | null
): Promise<IllustratorPdfExportResult> {
  if (process.platform !== 'win32')
    return {
      ok: false,
      error: 'Illustrator PDF export currently requires Windows and Adobe Illustrator.'
    }
  if (!validateIllustratorPdfExport(request))
    return {
      ok: false,
      error:
        'Select one vinyl sheet with artwork, cutting paths, four corner marks and one direction arrow.'
    }
  if (pending) return { ok: false, error: 'An Illustrator PDF export is already running.' }
  pending = true
  try {
    const options = {
      title: 'Export editable Illustrator Print + Cut PDF',
      defaultPath: getCutterSheetPdfFileName(
        request.layoutNumber ?? 1,
        request.layouts[0].repeatCount
      ),
      filters: [{ name: 'Illustrator Print + Cut PDF', extensions: ['pdf'] }]
    }
    const chosen = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options)
    if (chosen.canceled || !chosen.filePath) return { ok: false, canceled: true }
    await saveVerifiedSheet(request, chosen.filePath, true)
    return { ok: true, filePath: chosen.filePath }
  } catch (error) {
    return {
      ok: false,
      error: `Illustrator PDF export failed. Check that Illustrator is installed, activated and has no blocking dialogs. ${error instanceof Error ? error.message : String(error)}`
    }
  } finally {
    pending = false
  }
}

export async function exportIllustratorPdfBatch(
  request: unknown,
  owner: BrowserWindow | null
): Promise<IllustratorPdfBatchResult> {
  if (process.platform !== 'win32')
    return { ok: false, error: 'Windows and Adobe Illustrator are required for these PDFs.' }
  if (!validateIllustratorPdfBatch(request))
    return {
      ok: false,
      error: 'Invalid PDF sheet batch. Export up to 100 unique sheets at a time.'
    }
  if (pending) return { ok: false, error: 'An Illustrator PDF export is already running.' }
  pending = true
  let folderPath: string | undefined
  const filePaths: string[] = []
  try {
    const options = {
      title: 'Choose folder for separate vinyl-sheet PDFs',
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
    }
    const chosen = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)
    if (chosen.canceled || !chosen.filePaths[0]) return { ok: false, canceled: true }
    folderPath = join(chosen.filePaths[0], `Cutter_PDF_Sheets_${randomUUID().slice(0, 8)}`)
    await mkdir(folderPath, { recursive: true })
    const instructions = [
      'VINYL SHEET PRINT PLAN',
      '',
      'Each PDF is one page / one artboard.',
      'x6 means print that PDF 6 times. Print at 100% / Actual size.',
      'Four corner marks and one direction arrow per printed sheet. Cut each printed sheet once.',
      ''
    ]
    for (const sheet of request.sheets) {
      const repeat = sheet.layouts[0].repeatCount
      const name = getCutterSheetPdfFileName(sheet.layoutNumber!, repeat)
      const destination = join(folderPath, name)
      await saveVerifiedSheet(sheet, destination, false)
      filePaths.push(destination)
      instructions.push(`${name}: print ${repeat} ${repeat === 1 ? 'copy' : 'copies'}.`)
      await writeFile(join(folderPath, 'PRINT_INSTRUCTIONS.txt'), instructions.join('\r\n'), 'utf8')
    }
    return { ok: true, folderPath, filePaths }
  } catch (error) {
    return {
      ok: false,
      folderPath,
      filePaths,
      error: `Saved ${filePaths.length} PDF(s). Illustrator export stopped: ${error instanceof Error ? error.message : String(error)}`
    }
  } finally {
    pending = false
  }
}

async function saveVerifiedSheet(
  request: IllustratorPdfExportRequest,
  destination: string,
  keepOpen: boolean
): Promise<void> {
  const folder = join(app.getPath('userData'), 'cutting-jobs', randomUUID())
  await mkdir(folder, { recursive: true })
  const layout = request.layouts[0],
    svgPath = join(folder, 'layout.svg')
  await writeFile(svgPath, layout.svg, 'utf8')
  const files: IllustratorPdfLayoutFile[] = [
    { svgPath, widthMm: layout.widthMm, heightMm: layout.heightMm, repeatCount: layout.repeatCount }
  ]
  const scriptPath = join(folder, 'export-pdf.jsx')
  await writeFile(
    scriptPath,
    createIllustratorPdfScript(files, destination, request.layoutNumber ?? 1, keepOpen),
    'utf8'
  )
  const literal = scriptPath.replace(/'/g, "''")
  const ps = `$ErrorActionPreference='Stop';$illustrator=New-Object -ComObject Illustrator.Application;$result=$illustrator.DoJavaScriptFile('${literal}');Write-Output $result`
  await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(ps, 'utf16le').toString('base64')
    ],
    { windowsHide: true, timeout: 180000, maxBuffer: 1024 * 1024 }
  )
  if (!(await stat(destination)).size) throw new Error('Illustrator wrote an empty PDF.')
}
