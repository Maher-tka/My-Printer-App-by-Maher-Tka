import { app } from 'electron'
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { validateFineCutHandoff, type FineCutHandoffResult } from '../shared/finecut-handoff.js'
import { createIllustratorCutScript } from './illustrator-cut-script.js'
const execute = promisify(execFile)
let pending = false
export async function prepareFineCutJob(request: unknown): Promise<FineCutHandoffResult> {
  if (process.platform !== 'win32')
    return {
      ok: false,
      sentToDevice: false,
      error: 'The Illustrator handoff currently requires Windows.'
    }
  if (!validateFineCutHandoff(request))
    return {
      ok: false,
      sentToDevice: false,
      error: 'Invalid cutting job. Export a single marked layout with artwork and vector cut paths.'
    }
  if (pending)
    return { ok: false, sentToDevice: false, error: 'An Illustrator handoff is already running.' }
  pending = true
  let folderPath: string | undefined
  try {
    folderPath = join(app.getPath('userData'), 'cutting-jobs', randomUUID())
    await mkdir(folderPath, { recursive: true })
    const svgPath = join(folderPath, 'layout.svg'),
      scriptPath = join(folderPath, 'prepare.jsx'),
      aiPath = join(folderPath, 'layout.ai'),
      pdfPath = join(folderPath, 'layout-print-cut.pdf')
    await writeFile(svgPath, request.svg, 'utf8')
    await writeFile(
      scriptPath,
      createIllustratorCutScript(svgPath, aiPath, pdfPath, request.widthMm, request.heightMm),
      'utf8'
    )
    const literal = scriptPath.replace(/'/g, "''")
    const ps = `$ErrorActionPreference='Stop'; $illustrator=New-Object -ComObject Illustrator.Application; $result=$illustrator.DoJavaScriptFile('${literal}'); Write-Output $result`
    await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(ps, 'utf16le').toString('base64')
      ],
      { windowsHide: true, timeout: 90000, maxBuffer: 1024 * 1024 }
    )
    await stat(aiPath)
    await stat(pdfPath)
    return { ok: true, sentToDevice: false, aiPath, pdfPath, folderPath }
  } catch (error) {
    if (folderPath)
      await writeFile(
        join(folderPath, 'handoff-error.txt'),
        error instanceof Error ? error.message : String(error),
        'utf8'
      ).catch(() => undefined)
    return {
      ok: false,
      sentToDevice: false,
      folderPath,
      error: `Illustrator did not finish preparing the job. Check activation and open dialogs. The SVG and preparation script were kept in ${folderPath ?? 'the cutting job folder'}. No cut was sent.`
    }
  } finally {
    pending = false
  }
}
