import type { PrinterAppProjectResult, PrinterProjectFile } from '@/types/projects'

export function savePrinterProject(
  project: PrinterProjectFile,
  filePath?: string | null
): Promise<PrinterAppProjectResult> {
  if (!window.printerApp?.saveProject)
    return Promise.resolve({ ok: false, error: 'Desktop project storage is unavailable.' })
  return window.printerApp.saveProject({
    suggestedName: project.metadata.jobName,
    filePath,
    project
  })
}

export function openPrinterProject(filePath?: string | null): Promise<PrinterAppProjectResult> {
  if (!window.printerApp?.openProject)
    return Promise.resolve({ ok: false, error: 'Desktop project storage is unavailable.' })
  return window.printerApp.openProject(filePath)
}
