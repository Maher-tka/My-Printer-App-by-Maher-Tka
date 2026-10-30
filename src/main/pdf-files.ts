import { BrowserWindow, dialog, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { PDF_PICKER_TYPES, pdfPickerOptions, type PdfPickerKind } from '../shared/pdf-files.js'
import { resolvePdfMemoryPolicy } from '../shared/pdf-memory.js'
import { getPdfMachineMemory } from './pdf-memory.js'

export function registerPdfFileHandlers(): void {
  const selected = new Map<string, { path: string; owner: number; expires: number }>()
  ipcMain.handle('pdf:machine-memory', () => getPdfMachineMemory())
  ipcMain.handle('pdf:select-files', async (event, kind: PdfPickerKind) => {
    try {
      const options = pdfPickerOptions(kind),
        owner = BrowserWindow.fromWebContents(event.sender)
      const result = owner
        ? await dialog.showOpenDialog(owner, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true }
      for (const [id, entry] of selected)
        if (entry.owner === event.sender.id || entry.expires < Date.now()) selected.delete(id)
      const files = []
      for (const path of result.filePaths) {
        const metadata = await stat(path)
        if (!metadata.isFile()) throw new Error('Choose files, not folders.')
        if (
          !(PDF_PICKER_TYPES[kind].extensions as readonly string[]).includes(
            extname(path).slice(1).toLowerCase()
          )
        )
          throw new Error('This file type is not supported by the selected tool.')
        const id = randomUUID()
        selected.set(id, { path, owner: event.sender.id, expires: Date.now() + 30 * 60_000 })
        files.push({
          id,
          name: basename(path),
          size: metadata.size,
          lastModified: metadata.mtimeMs
        })
      }
      return { ok: true, files }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })
  ipcMain.handle('pdf:read-selected-file', async (event, id: string) => {
    const entry = selected.get(id)
    if (!entry || entry.owner !== event.sender.id || entry.expires < Date.now())
      return { ok: false, error: 'Choose the file again before importing.' }
    selected.delete(id)
    try {
      const metadata = await stat(entry.path)
      if (
        !metadata.isFile() ||
        metadata.size > resolvePdfMemoryPolicy(getPdfMachineMemory()).maxInputBytes
      )
        throw new Error(
          'This file exceeds the current memory limit. Close other apps or use a smaller file.'
        )
      return { ok: true, bytes: new Uint8Array(await readFile(entry.path)) }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })
}
