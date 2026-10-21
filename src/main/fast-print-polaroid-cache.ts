import { open, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { polaroidLayout, type PolaroidMode } from '../shared/fast-print-polaroid.js'
import { FAST_PRINT_MAX_PAGES } from '../shared/fast-print-batch.js'

/** Only read reviewed artwork inside the current native request's session. */
export async function loadReviewedPolaroid(directory: string, mode: PolaroidMode, files: string[]) {
  const folder = join(directory, 'reviewed-polaroid')
  const manifestPath = join(folder, 'sheets.json')
  if ((await stat(manifestPath)).size > 4 * 1024 * 1024)
    throw new Error('The reviewed Polaroid manifest is too large.')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const layout = polaroidLayout(mode)
  if (
    manifest.version !== 1 ||
    manifest.mode !== mode ||
    !Number.isInteger(manifest.photos) ||
    manifest.photos < files.length ||
    manifest.photos > FAST_PRINT_MAX_PAGES ||
    !Array.isArray(manifest.sources) ||
    manifest.sources.length !== files.length ||
    !Array.isArray(manifest.sheets) ||
    manifest.sheets.length !== Math.ceil(manifest.photos / layout.photos.length)
  )
    throw new Error('The reviewed Polaroid sheets are incomplete. Refresh the preview.')
  for (let index = 0; index < files.length; index++) {
    const source = manifest.sources[index]
    const info = await stat(files[index])
    if (
      source.path !== files[index] ||
      source.length !== info.size ||
      !Number.isFinite(source.modifiedMs) ||
      Math.abs(source.modifiedMs - info.mtimeMs) >= 1
    )
      throw new Error('Files changed after review. Refresh the Polaroid preview.')
  }
  const sheets: string[] = []
  let totalBytes = 0
  for (let index = 0; index < manifest.sheets.length; index++) {
    const name = manifest.sheets[index]
    if (name !== `${String(index + 1).padStart(5, '0')}.png`)
      throw new Error('Invalid reviewed Polaroid sheet.')
    const path = join(folder, name)
    const info = await stat(path)
    totalBytes += info.size
    if (info.size > 64 * 1024 * 1024 || totalBytes > 2 * 1024 * 1024 * 1024)
      throw new Error('The reviewed Polaroid batch is too large.')
    // Read only the PNG header; a slower PC need not load every full sheet into JS memory.
    const bytes = Buffer.alloc(24)
    const handle = await open(path, 'r')
    let bytesRead: number
    try {
      bytesRead = (await handle.read(bytes, 0, bytes.length, 0)).bytesRead
    } finally {
      await handle.close()
    }
    if (
      bytesRead < 24 ||
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      bytes.readUInt32BE(16) !== layout.width ||
      bytes.readUInt32BE(20) !== layout.height
    )
      throw new Error('Invalid reviewed Polaroid sheet size. Refresh the preview.')
    sheets.push(path)
  }
  return { sheets, photos: manifest.photos as number }
}
