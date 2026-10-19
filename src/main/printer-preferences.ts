import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { PrinterPreferencesStore } from './printer-preferences-store.js'
import { runPrinterScript } from './printer-driver-runtime.js'
import {
  PRINTING_OPTIONS,
  validatePrinterPreferences,
  type CaptureDriverPresetRequest,
  type DriverPresetSummary,
  type PrinterDevice,
  type PrinterPreferences,
  type PrinterSettingsSnapshot
} from '../shared/printer-preferences.js'

export function printerPreferencesStore(): PrinterPreferencesStore {
  return new PrinterPreferencesStore(
    join(
      process.env.LOCALAPPDATA || join(app.getPath('appData'), '..', 'Local'),
      'MaherTka',
      'FastPrint',
      'preferences.json'
    )
  )
}
export async function getPrinterSettings(): Promise<PrinterSettingsSnapshot> {
  if (process.platform !== 'win32') throw new Error('Driver presets are available on Windows.')
  const [preferences, devices, presets] = await Promise.all([
    printerPreferencesStore().read(),
    runPrinterScript('fast-print-menu.ps1', ['-Action', 'List']).then(
      (text) => JSON.parse(text) as PrinterDevice[]
    ),
    runPrinterScript('printer-preferences.ps1', ['-Action', 'List']).then(
      (text) => JSON.parse(text) as DriverPresetSummary[]
    )
  ])
  return { preferences, devices, presets }
}
function validateAssignments(
  preferences: PrinterPreferences,
  presets: DriverPresetSummary[],
  previous: PrinterPreferences
): void {
  for (const [printer, assignments] of Object.entries(preferences.profiles))
    for (const [optionId, id] of Object.entries(assignments)) {
      const preset = presets.find((item) => item.id === id)
      const option = PRINTING_OPTIONS.find((item) => item.id === optionId)!
      const unchanged = previous.profiles[printer]?.[optionId] === id
      if (
        !unchanged &&
        (!preset || preset.printer !== printer || (option.paper && preset.paper !== option.paper))
      )
        throw new Error('Choose a matching driver preset for this printer and paper.')
    }
}
export async function withPrinterRequest(
  action: 'Capture' | 'Delete',
  request: object
): Promise<string> {
  const folder = await mkdtemp(join(app.getPath('temp'), 'maher-driver-settings-'))
  try {
    const file = join(folder, 'request.json')
    await writeFile(file, JSON.stringify(request))
    return await runPrinterScript('printer-preferences.ps1', [
      '-Action',
      action,
      '-RequestPath',
      file
    ])
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}
let capturing = false
export function registerPrinterPreferenceHandlers(): void {
  const authorize = (event: IpcMainInvokeEvent) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner || event.senderFrame !== event.sender.mainFrame)
      throw new Error('Printing settings are unavailable in this window.')
    return owner
  }
  ipcMain.handle('printers:get', async (event) => {
    authorize(event)
    return getPrinterSettings()
  })
  ipcMain.handle('printers:save', async (event, value: unknown) => {
    authorize(event)
    const preferences = validatePrinterPreferences(value)
    const snapshot = await getPrinterSettings()
    validateAssignments(preferences, snapshot.presets, snapshot.preferences)
    await printerPreferencesStore().save(preferences)
    return { ...snapshot, preferences }
  })
  ipcMain.handle('printers:capture', async (event, request: CaptureDriverPresetRequest) => {
    const owner = authorize(event)
    if (capturing) throw new Error('A printer driver dialog is already open.')
    if (
      !request ||
      typeof request.printer !== 'string' ||
      typeof request.name !== 'string' ||
      !request.name.trim() ||
      request.name.trim().length > 100 ||
      (request.id !== undefined && !/^[a-f0-9]{32}$/.test(request.id))
    )
      throw new Error('Choose a printer and give the preset a name.')
    capturing = true
    try {
      const handle = owner.getNativeWindowHandle()
      const nativeOwner =
        handle.length >= 8 ? handle.readBigUInt64LE().toString() : handle.readUInt32LE().toString()
      const result = JSON.parse(
        await withPrinterRequest('Capture', {
          printer: request.printer,
          id: request.id,
          name: request.name.trim(),
          owner: nativeOwner
        })
      ) as { canceled?: boolean; profile?: DriverPresetSummary }
      if (result.canceled) return { canceled: true }
      const snapshot = await getPrinterSettings()
      let changed = false
      for (const assignments of Object.values(snapshot.preferences.profiles))
        for (const [key, value] of Object.entries(assignments)) {
          const option = PRINTING_OPTIONS.find((item) => item.id === key)
          if (
            value === result.profile?.id &&
            option?.paper &&
            result.profile.paper !== option.paper
          ) {
            delete assignments[key]
            changed = true
          }
        }
      if (changed) await printerPreferencesStore().save(snapshot.preferences)
      return { snapshot }
    } finally {
      capturing = false
      if (!owner.isDestroyed()) owner.focus()
    }
  })
  ipcMain.handle('printers:remove', async (event, id: string) => {
    authorize(event)
    if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id))
      throw new Error('Invalid driver preset.')
    const preferences = await printerPreferencesStore().read()
    for (const assignments of Object.values(preferences.profiles))
      for (const [key, value] of Object.entries(assignments))
        if (value === id) delete assignments[key]
    // Commit cleared assignments first: a failed removal leaves a reusable preset, never a dangling preference.
    await printerPreferencesStore().save(preferences)
    await withPrinterRequest('Delete', { id })
    return getPrinterSettings()
  })
}
