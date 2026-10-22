import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { writeJsonAtomically } from './atomic-json.js'

/** Separate from explicit printer preferences and Windows system defaults. */
export class LastFastPrintPrinter {
  constructor(readonly path: string) {}

  async read(): Promise<string | undefined> {
    try {
      const value = JSON.parse(await readFile(this.path, 'utf8'))
      return value.version === 1 && validName(value.printer) ? value.printer : undefined
    } catch {
      return undefined
    }
  }

  async save(printer: string): Promise<void> {
    if (!validName(printer)) throw new Error('Invalid printer name.')
    await mkdir(dirname(this.path), { recursive: true })
    await writeJsonAtomically(this.path, { version: 1, printer })
  }
}

function validName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 512 &&
    !/[\x00-\x1f]/.test(value)
  )
}
