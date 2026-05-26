import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('printerApp', {
  platform: process.platform,
  storageMode: 'local-first',
  saveFile: (request: {
    suggestedName: string
    bytes: Uint8Array
    filters: Array<{ name: string; extensions: string[] }>
  }) => ipcRenderer.invoke('booklet:save-file', request),
  selectOutputFolder: () => ipcRenderer.invoke('booklet:select-output-folder'),
  writeFilesToFolder: (
    folderPath: string,
    files: Array<{ fileName: string; bytes: Uint8Array }>
  ) => ipcRenderer.invoke('booklet:write-files-to-folder', folderPath, files)
})
