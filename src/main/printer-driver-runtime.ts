import { app } from 'electron'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
const execute = promisify(execFile)
export function printerScriptPath(name: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'fast-print', name)
    : join(app.getAppPath(), 'scripts', name)
}
export async function runPrinterScript(name: string, parameters: string[]): Promise<string> {
  const result = await execute(
    join(
      process.env.SystemRoot || 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    ),
    [
      '-NoProfile',
      '-STA',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      printerScriptPath(name),
      ...parameters
    ],
    { windowsHide: true, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
  )
  return result.stdout.trim()
}
