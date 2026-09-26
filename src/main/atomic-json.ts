import { randomUUID } from 'node:crypto'
import { copyFile, open, rename, rm } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'

const writesByPath = new Map<string, Promise<void>>()

/** Replace a JSON file only after its complete contents have reached a temporary file. */
export function writeJsonAtomically(
  filePath: string,
  value: unknown,
  options: { backupExisting?: boolean } = {}
): Promise<void> {
  const key = process.platform === 'win32' ? filePath.toLowerCase() : filePath
  const precedingWrite = writesByPath.get(key) ?? Promise.resolve()
  const write = precedingWrite.catch(() => {}).then(() => writeJsonNow(filePath, value, options))
  writesByPath.set(key, write)
  void write
    .finally(() => {
      if (writesByPath.get(key) === write) writesByPath.delete(key)
    })
    .catch(() => {})
  return write
}

async function writeJsonNow(
  filePath: string,
  value: unknown,
  options: { backupExisting?: boolean }
): Promise<void> {
  const temporaryPath = join(dirname(filePath), `.${basename(filePath)}.${randomUUID()}.tmp`)
  const backupPath = `${filePath}.bak`
  const temporaryBackupPath = `${temporaryPath}.bak`
  let file: Awaited<ReturnType<typeof open>> | undefined

  try {
    // Serialize before touching the destination. A circular value must leave the old job intact.
    const contents = `${JSON.stringify(value, null, 2)}\n`
    file = await open(temporaryPath, 'wx')
    await file.writeFile(contents, 'utf8')
    await file.sync()
    await file.close()
    file = undefined

    if (options.backupExisting) {
      try {
        await copyFile(filePath, temporaryBackupPath)
        await rename(temporaryBackupPath, backupPath)
      } catch (error) {
        if (!isMissingFile(error)) throw error
      }
    }

    await rename(temporaryPath, filePath)
  } finally {
    await file?.close()
    await Promise.all([
      rm(temporaryPath, { force: true }),
      rm(temporaryBackupPath, { force: true })
    ])
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
