import { contextBridge, ipcRenderer } from 'electron'
import type { LicenseActivationResult, LicenseSnapshot } from '../shared/licensing-types.js'
import type { UnsavedChangesRequest, UnsavedChangesResult } from '../shared/project-types.js'

contextBridge.exposeInMainWorld('printerApp', {
  platform: process.platform,
  storageMode: 'local-first',
  license: {
    getState: (): Promise<LicenseSnapshot> => ipcRenderer.invoke('license:get-state'),
    activateSerial: (serialKey: string): Promise<LicenseActivationResult> =>
      ipcRenderer.invoke('license:activate-serial', serialKey),
    resetLocal: (): Promise<LicenseSnapshot> => ipcRenderer.invoke('license:reset-local')
  },
  saveFile: (request: {
    suggestedName: string
    bytes: Uint8Array
    filters: Array<{ name: string; extensions: string[] }>
  }) => ipcRenderer.invoke('booklet:save-file', request),
  saveProject: (request: { suggestedName: string; filePath?: string | null; project: unknown }) =>
    ipcRenderer.invoke('projects:save', request),
  openProject: (filePath?: string | null) => ipcRenderer.invoke('projects:open', filePath ?? null),
  confirmUnsavedChanges: (request: UnsavedChangesRequest): Promise<UnsavedChangesResult> =>
    ipcRenderer.invoke('projects:confirm-unsaved', request),
  setProjectDirty: (dirty: boolean, projectName: string): Promise<void> =>
    ipcRenderer.invoke('projects:set-dirty', { dirty, projectName }),
  onSaveBeforeClose: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('projects:request-save-before-close', listener)

    return () => ipcRenderer.removeListener('projects:request-save-before-close', listener)
  },
  finishCloseAfterSave: (saved: boolean): Promise<void> =>
    ipcRenderer.invoke('projects:close-after-save', saved),
  listRecentProjects: () => ipcRenderer.invoke('projects:list-recent'),
  selectOutputFolder: () => ipcRenderer.invoke('booklet:select-output-folder'),
  writeFilesToFolder: (folderPath: string, files: Array<{ fileName: string; bytes: Uint8Array }>) =>
    ipcRenderer.invoke('booklet:write-files-to-folder', folderPath, files)
})
