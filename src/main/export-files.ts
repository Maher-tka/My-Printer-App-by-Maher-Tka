import { randomUUID } from 'node:crypto'
import { open, rename, rm } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep, win32 } from 'node:path'

export type ExportBytes = Uint8Array | ArrayBuffer | number[]
export interface OutputFileRequest {
  fileName: string
  bytes: ExportBytes
}

const writesByPath = new Map<string, Promise<void>>()

export function exportBuffer(bytes: ExportBytes): Buffer {
  if (!(bytes instanceof Uint8Array) && !(bytes instanceof ArrayBuffer) && !Array.isArray(bytes)) {
    throw new Error('The export did not produce valid file data. Please try exporting again.')
  }
  const buffer = bytes instanceof ArrayBuffer ? Buffer.from(bytes) : Buffer.from(bytes)
  if (!buffer.length) throw new Error('The export is empty. No file was saved.')
  return buffer
}

/** Validate the entire batch before creating folders or replacing any files. */
export function planOutputFiles(folderPath: string, files: OutputFileRequest[]) {
  if (!Array.isArray(files) || !files.length) throw new Error('No files were produced for export.')
  const folder = resolve(folderPath)
  const destinations = new Set<string>()
  return files.map((file) => {
    const name = file.fileName
    if (
      typeof name !== 'string' ||
      !name ||
      isAbsolute(name) ||
      win32.isAbsolute(name) ||
      !name
        .split(/[\\/]/)
        .every(
          (part) =>
            part.length > 0 &&
            part !== '.' &&
            part !== '..' &&
            !/[<>:"|?*\x00-\x1f]/.test(part) &&
            !/[. ]$/.test(part) &&
            !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
        )
    )
      throw new Error(`Invalid output file path: ${name}`)
    const filePath = resolve(folder, name)
    const child = relative(folder, filePath)
    if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
      throw new Error(`Invalid output file path: ${name}`)
    }
    const key = filePath.toLowerCase()
    if (destinations.has(key)) throw new Error(`Duplicate output file path: ${name}`)
    destinations.add(key)
    return { filePath, bytes: exportBuffer(file.bytes) }
  })
}

/** A failed write must never truncate an existing customer's export. */
export function writeExportFile(filePath: string, bytes: ExportBytes): Promise<void> {
  const buffer = exportBuffer(bytes)
  const key = process.platform === 'win32' ? resolve(filePath).toLowerCase() : resolve(filePath)
  const previous = writesByPath.get(key) ?? Promise.resolve()
  const write = previous
    .catch(() => {})
    .then(async () => {
      const temporaryPath = join(dirname(filePath), `.export-${randomUUID()}.tmp`)
      let file: Awaited<ReturnType<typeof open>> | undefined
      try {
        file = await open(temporaryPath, 'wx')
        await file.writeFile(buffer)
        await file.sync()
        await file.close()
        file = undefined
        await rename(temporaryPath, filePath)
      } catch (error) {
        throw new Error(getExportWriteError(error, filePath), { cause: error })
      } finally {
        await file?.close().catch(() => {})
        await rm(temporaryPath, { force: true }).catch(() => {})
      }
    })
  writesByPath.set(key, write)
  void write
    .finally(() => {
      if (writesByPath.get(key) === write) writesByPath.delete(key)
    })
    .catch(() => {})
  return write
}

function getExportWriteError(error: unknown, filePath: string): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  const name = basename(filePath)
  if (code === 'ENOSPC')
    return `Not enough free space to save ${name}. Free space or choose another drive.`
  if (code === 'EACCES' || code === 'EPERM' || code === 'EBUSY') {
    return `Could not replace ${name}. Close it in other applications or choose another folder or filename.`
  }
  return `Could not save ${name}: ${error instanceof Error ? error.message : 'file write failed'}`
}
