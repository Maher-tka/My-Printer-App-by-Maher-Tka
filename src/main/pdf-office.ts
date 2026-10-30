import { execFile } from 'node:child_process'
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolvePdfMemoryPolicy } from '../shared/pdf-memory.js'
import { getPdfMachineMemory } from './pdf-memory.js'
import {
  OFFICE_EXTENSIONS,
  type OfficePdfCapabilities,
  type OfficePdfRequest,
  type OfficePdfResult
} from '../shared/pdf-office.js'

function run(executable: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      { windowsHide: true, timeout: 120_000, maxBuffer: 1024 * 1024, env },
      (error, stdout, stderr) => {
        if (error) reject(new Error(stderr.trim() || error.message))
        else resolve(stdout.trim())
      }
    )
  })
}

const powershell = join(
  process.env.SystemRoot || 'C:/Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe'
)
const encoded = (script: string): string[] => [
  '-NoLogo',
  '-NoProfile',
  '-NonInteractive',
  '-EncodedCommand',
  Buffer.from(script, 'utf16le').toString('base64')
]

async function libreOfficePath(): Promise<string | null> {
  for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
    if (!root) continue
    const path = join(root, 'LibreOffice/program/soffice.exe')
    try {
      await access(path)
      return path
    } catch {
      /* Try the next installation. */
    }
  }
  return null
}

export async function getOfficePdfCapabilities(): Promise<OfficePdfCapabilities> {
  const libreOffice = Boolean(await libreOfficePath())
  if (process.platform !== 'win32')
    return { word: false, powerpoint: false, excel: false, libreOffice }
  try {
    const result = await run(
      powershell,
      encoded(
        `@{word=($null -ne [type]::GetTypeFromProgID('Word.Application'));powerpoint=($null -ne [type]::GetTypeFromProgID('PowerPoint.Application'));excel=($null -ne [type]::GetTypeFromProgID('Excel.Application'))} | ConvertTo-Json -Compress`
      )
    )
    return { ...JSON.parse(result), libreOffice }
  } catch {
    return { word: false, powerpoint: false, excel: false, libreOffice }
  }
}

export function validateOfficePdfRequest(request: OfficePdfRequest): string {
  if (!request || !Object.hasOwn(OFFICE_EXTENSIONS, request.kind))
    throw new Error('Unsupported Office file type.')
  const extension = extname(String(request.fileName)).slice(1).toLowerCase()
  if (!OFFICE_EXTENSIONS[request.kind].includes(extension))
    throw new Error('The file extension does not match this conversion.')
  if (
    !(request.bytes instanceof Uint8Array) ||
    !request.bytes.length ||
    request.bytes.length > resolvePdfMemoryPolicy(getPdfMachineMemory()).maxInputBytes
  )
    throw new Error('Choose a non-empty Office file within the current memory limit.')
  return extension
}

// Paths are data in a private JSON file, never interpolated into PowerShell source.
const officeScript = `
$ErrorActionPreference='Stop'
$request=Get-Content -LiteralPath $env:PRINTER_PDF_OFFICE_REQUEST -Raw | ConvertFrom-Json
$office=$null; $document=$null
$existingPowerPoint=@(Get-Process POWERPNT -ErrorAction SilentlyContinue).Count -gt 0
try {
  switch ($request.kind) {
    'word' {
      $office=New-Object -ComObject Word.Application
      $office.Visible=$false; $office.DisplayAlerts=0; $office.AutomationSecurity=3
      $document=$office.Documents.Open($request.input,$false,$true,$false)
      $document.ExportAsFixedFormat($request.output,17)
    }
    'excel' {
      $office=New-Object -ComObject Excel.Application
      $office.Visible=$false; $office.DisplayAlerts=$false; $office.AskToUpdateLinks=$false; $office.AutomationSecurity=3
      $document=$office.Workbooks.Open($request.input,0,$true)
      $document.ExportAsFixedFormat(0,$request.output)
    }
    'powerpoint' {
      $office=New-Object -ComObject PowerPoint.Application
      $office.AutomationSecurity=3; $office.DisplayAlerts=1
      $document=$office.Presentations.Open($request.input,-1,0,0)
      $document.SaveAs($request.output,32)
    }
  }
} finally {
  if ($null -ne $document) {
    if ($request.kind -eq 'powerpoint') { $document.Close() } else { $document.Close($false) }
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)
  }
  if ($null -ne $office) {
    if ($request.kind -ne 'powerpoint' -or !$existingPowerPoint) { $office.Quit() }
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($office)
  }
}
`

export async function convertOfficePdf(request: OfficePdfRequest): Promise<OfficePdfResult> {
  let folder: string | undefined
  try {
    const extension = validateOfficePdfRequest(request)
    const capabilities = await getOfficePdfCapabilities()
    const libreOffice = await libreOfficePath()
    if (!capabilities[request.kind] && !libreOffice)
      return {
        ok: false,
        error: 'Install Microsoft Office or LibreOffice to convert Office files locally.'
      }
    folder = await mkdtemp(join(tmpdir(), 'my-printer-pdf-'))
    const input = join(folder, `source.${extension}`)
    await writeFile(input, request.bytes)
    if (capabilities[request.kind]) {
      const config = join(folder, 'request.json')
      await writeFile(
        config,
        JSON.stringify({ kind: request.kind, input, output: join(folder, 'source.pdf') })
      )
      await run(powershell, encoded(officeScript), {
        ...process.env,
        PRINTER_PDF_OFFICE_REQUEST: config
      })
    } else if (libreOffice) {
      await run(libreOffice, [
        `-env:UserInstallation=${pathToFileURL(join(folder, 'profile')).href}`,
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        folder,
        input
      ])
    }
    const output = (await readdir(folder)).find((name) => name.toLowerCase() === 'source.pdf')
    if (!output) throw new Error('Office did not create a PDF. Check the document and try again.')
    const bytes = new Uint8Array(await readFile(join(folder, output)))
    if (Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-')
      throw new Error('Office returned an invalid PDF.')
    return { ok: true, bytes }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Office conversion failed.'
    }
  } finally {
    if (folder) await rm(folder, { recursive: true, force: true }).catch(() => {})
  }
}
