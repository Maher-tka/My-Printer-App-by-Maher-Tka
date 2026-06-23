import { contextBridge, ipcRenderer } from 'electron'
import type {
  LicenseActivationResult,
  LicenseSnapshot
} from '../shared/licensing-types.js'

contextBridge.exposeInMainWorld('printerApp', {
  platform: process.platform,
  storageMode: 'local-first',
  license: {
    getState: (): Promise<LicenseSnapshot> => ipcRenderer.invoke('license:get-state'),
    activateSerial: (serialKey: string): Promise<LicenseActivationResult> =>
      ipcRenderer.invoke('license:activate-serial', serialKey)
  },
  saveFile: (request: {
    suggestedName: string
    bytes: Uint8Array
    filters: Array<{ name: string; extensions: string[] }>
  }) => ipcRenderer.invoke('booklet:save-file', request),
  saveProject: (request: {
    suggestedName: string
    filePath?: string | null
    project: unknown
  }) => ipcRenderer.invoke('projects:save', request),
  openProject: (filePath?: string | null) =>
    ipcRenderer.invoke('projects:open', filePath ?? null),
  listRecentProjects: () => ipcRenderer.invoke('projects:list-recent'),
  selectOutputFolder: () => ipcRenderer.invoke('booklet:select-output-folder'),
  writeFilesToFolder: (
    folderPath: string,
    files: Array<{ fileName: string; bytes: Uint8Array }>
  ) => ipcRenderer.invoke('booklet:write-files-to-folder', folderPath, files)
})
