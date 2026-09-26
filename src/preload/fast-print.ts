import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fastPrint', {
  source: () => ipcRenderer.invoke('fast-print:source'),
  sheet: (png: string) => ipcRenderer.invoke('fast-print:sheet', png),
  submit: () => ipcRenderer.invoke('fast-print:submit'),
  finish: (error?: string) => ipcRenderer.invoke('fast-print:finish', error)
})
