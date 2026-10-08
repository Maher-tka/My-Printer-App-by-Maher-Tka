import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'

const execute = promisify(execFile)
export const ILLUSTRATOR_EXPORT_TIMEOUT_MS = 180_000
export const ILLUSTRATOR_EXPORT_MESSAGES = {
  notRunning: 'Open Adobe Illustrator, close its startup dialogs, then export again.',
  dialog:
    'Illustrator is waiting for a dialog. Switch to Illustrator, close the FineCut/Coat setup or other open dialog, then export again.',
  busy: 'Illustrator is busy with another operation. Wait for it to finish, then export again.',
  timeout:
    'Illustrator did not finish this export in time. Check Illustrator and its FineCut/Coat dialogs before trying again.',
  automation:
    'The Illustrator automation connection is unavailable. Open Illustrator once, then retry.',
  destination:
    'The destination PDF is already open in Illustrator. Close it or choose another filename.',
  verification:
    'Illustrator could not verify the saved PDF. Export it again before using it for production.',
  failed:
    'Illustrator could not export this sheet. Check its open dialogs and try again. Export diagnostics were kept in the cutting job folder.',
  write: 'The PDF could not be saved to this folder. Choose a writable local folder and try again.',
  space:
    'There is not enough free space to save the PDF. Free some disk space or choose another drive.'
} as const

/** Check readiness before a COM call, which can otherwise wait behind a plug-in dialog. */
export function createIllustratorExportPowerShell(jsxPath: string, processPath?: string): string {
  const literal = jsxPath.replace(/'/g, "''")
  const processRecord = processPath
    ? `[IO.File]::WriteAllText('${processPath.replace(/'/g, "''")}',($processes.Id -join [Environment]::NewLine))`
    : ''
  return `$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
try {
 $processes=@(Get-Process -Name Illustrator -ErrorAction SilentlyContinue)
 if(!$processes.Count){throw 'ILLUSTRATOR_NOT_RUNNING'}
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class IllustratorExportGate {
 private delegate bool EnumWindow(IntPtr window, IntPtr parameter);
 [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindow callback, IntPtr parameter);
 [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")] private static extern bool IsWindowEnabled(IntPtr window);
 [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint command);
 [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr window,StringBuilder name,int size);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr window,StringBuilder name,int size);
 [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr window,int index);
 public static bool HasDialog(uint process) {
  bool blocked=false;
  EnumWindow callback=delegate(IntPtr window,IntPtr parameter){
   uint owner;GetWindowThreadProcessId(window,out owner);
   if(owner==process && IsWindowVisible(window)) {
    var type=new StringBuilder(128);GetClassName(window,type,type.Capacity);
    var title=new StringBuilder(256);GetWindowText(window,title,title.Capacity);
    int extended=GetWindowLong(window,-20);
    bool dialog=type.ToString()=="#32770" || ((extended&1)!=0 && (extended&128)==0)
     || title.ToString()=="Script Alert" || title.ToString()=="Setup" || title.ToString().StartsWith("FineCut/Coat");
    if(dialog || (GetWindow(window,4)==IntPtr.Zero && !IsWindowEnabled(window))) blocked=true;
   }
   return true;
  };
  EnumWindows(callback,IntPtr.Zero);return blocked;
 }
}
'@
 foreach($process in $processes){
  if([IllustratorExportGate]::HasDialog([uint32]$process.Id)){throw 'ILLUSTRATOR_DIALOG_OPEN'}
  if(!$process.Responding){throw 'ILLUSTRATOR_BUSY'}
 }
 try {$illustrator=[Runtime.InteropServices.Marshal]::GetActiveObject('Illustrator.Application')}
 catch {throw 'ILLUSTRATOR_AUTOMATION_UNAVAILABLE'}
 ${processRecord}
 $result=$illustrator.DoJavaScriptFile('${literal}')
 [Console]::Out.WriteLine($result)
} catch {
 [Console]::Error.WriteLine($_.Exception.Message)
 exit 1
}`
}

export function getIllustratorExportErrorMessage(error: unknown): string {
  const failure = error as {
    stderr?: string
    message?: string
    code?: string
    killed?: boolean
    signal?: string
  } | null
  const detail = failure?.stderr ?? failure?.message ?? String(error)
  if (/ILLUSTRATOR_NOT_RUNNING/.test(detail)) return ILLUSTRATOR_EXPORT_MESSAGES.notRunning
  if (/ILLUSTRATOR_DIALOG_OPEN/.test(detail)) return ILLUSTRATOR_EXPORT_MESSAGES.dialog
  if (/ILLUSTRATOR_BUSY|80010001|8001010A/.test(detail)) return ILLUSTRATOR_EXPORT_MESSAGES.busy
  if (/ILLUSTRATOR_AUTOMATION_UNAVAILABLE|80040154/.test(detail))
    return ILLUSTRATOR_EXPORT_MESSAGES.automation
  if (/destination PDF is already open/i.test(detail))
    return ILLUSTRATOR_EXPORT_MESSAGES.destination
  if (/verify saved sheet:|reopen PDF:/i.test(detail))
    return ILLUSTRATOR_EXPORT_MESSAGES.verification
  if (failure?.killed || failure?.code === 'ETIMEDOUT') return ILLUSTRATOR_EXPORT_MESSAGES.timeout
  if (failure?.code === 'ENOSPC') return ILLUSTRATOR_EXPORT_MESSAGES.space
  if (failure?.code === 'EACCES' || failure?.code === 'EPERM')
    return ILLUSTRATOR_EXPORT_MESSAGES.write
  return ILLUSTRATOR_EXPORT_MESSAGES.failed
}

export function isIllustratorExportTimeout(error: unknown): boolean {
  const failure = error as { killed?: boolean; code?: string } | null
  return Boolean(failure?.killed || failure?.code === 'ETIMEDOUT')
}

/** A timed-out COM request may still be executing inside Illustrator. */
export async function isIllustratorJobUnfinished(
  statusPath: string,
  processPath?: string
): Promise<boolean> {
  try {
    const phase = (await readFile(statusPath, 'utf8')).trim().split(/\r?\n/)[0]
    if (phase === 'complete' || phase === 'error') return false
    if (processPath) {
      let processRecord: string
      try {
        processRecord = await readFile(processPath, 'utf8')
      } catch {
        return true
      }
      const pids = processRecord.trim().split(/\s+/).map(Number)
      if (pids.length && pids.every((pid) => Number.isSafeInteger(pid) && pid > 0)) {
        return pids.some((pid) => {
          try {
            process.kill(pid, 0)
            return true
          } catch (error) {
            return (error as NodeJS.ErrnoException).code !== 'ESRCH'
          }
        })
      }
    }
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ENOENT'
  }
}

export async function runIllustratorPdfScript(
  jsxPath: string,
  runnerPath: string
): Promise<string> {
  // Windows PowerShell 5 needs the BOM to preserve non-ASCII user-data paths.
  await writeFile(
    runnerPath,
    '\uFEFF' + createIllustratorExportPowerShell(jsxPath, runnerPath + '.process'),
    'utf8'
  )
  const { stdout } = await execute(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', runnerPath],
    { windowsHide: true, timeout: ILLUSTRATOR_EXPORT_TIMEOUT_MS, maxBuffer: 1024 * 1024 }
  )
  return stdout.trim()
}
