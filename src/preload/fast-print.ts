import { contextBridge, ipcRenderer } from 'electron'
import type { FastPrintSubmitOptions } from '../shared/fast-print.js'
import type { IdPrintDraft } from '../shared/fast-print-id.js'

contextBridge.exposeInMainWorld('fastPrint', {
  source: () => ipcRenderer.invoke('fast-print:source'),
  file: (index: number) => ipcRenderer.invoke('fast-print:file', index),
  sheet: (png: string, size?: { widthMm: number; heightMm: number }) =>
    ipcRenderer.invoke('fast-print:sheet', png, size),
  submit: (options?: FastPrintSubmitOptions) => ipcRenderer.invoke('fast-print:submit', options),
  finish: (error?: string) => ipcRenderer.invoke('fast-print:finish', error),
  back: (draft: IdPrintDraft) => ipcRenderer.invoke('fast-print:back', draft),
  saveIdDraft: (draft: IdPrintDraft) => ipcRenderer.invoke('fast-print:save-id', draft)
})
