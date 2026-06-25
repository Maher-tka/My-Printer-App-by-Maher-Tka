import type { PrinterProjectFile } from '@/types/projects'

export function writeProjectAutosave(
  project: PrinterProjectFile,
  originalFilePath?: string | null
) {
  return window.printerApp?.runtime.writeAutosave({ project, originalFilePath })
}

export function listProjectAutosaves() {
  return window.printerApp?.runtime.listAutosaves() ?? Promise.resolve([])
}
