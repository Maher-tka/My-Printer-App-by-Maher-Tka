import { readFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { writeJsonAtomically } from './atomic-json.js'
import {
  emptyPrinterPreferences,
  validatePrinterPreferences,
  type PrinterPreferences
} from '../shared/printer-preferences.js'
export class PrinterPreferencesStore {
  constructor(readonly path: string) {}
  async read(): Promise<PrinterPreferences> {
    try {
      return validatePrinterPreferences(JSON.parse(await readFile(this.path, 'utf8')))
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
        return emptyPrinterPreferences()
      throw new Error(
        'Saved printing preferences could not be read. Restore the preferences file before printing.'
      )
    }
  }
  async save(value: unknown): Promise<PrinterPreferences> {
    const preferences = validatePrinterPreferences(value)
    await mkdir(dirname(this.path), { recursive: true })
    await writeJsonAtomically(this.path, preferences, { backupExisting: true })
    return preferences
  }
}
