import { basename, dirname, resolve } from 'node:path'
import { normalizeFastPrintSelection } from './fast-print-batch.js'
import { validateFastPrintPreset, type FastPrintPreset } from './fast-print.js'

export interface NativePrintRequest {
  version: 1
  files: string[]
  preset: FastPrintPreset
  copies: number
  preparedPolaroid?: boolean
}

/** Only the helper-owned session directory is eligible for automatic cleanup. */
export function nativePrintSession(requestPath: string, tempPath: string): string {
  const file = resolve(requestPath)
  const session = dirname(file)
  if (
    basename(file) !== 'request.json' ||
    !/^[a-f0-9]{32}$/.test(basename(session)) ||
    dirname(session).toLowerCase() !== resolve(tempPath, 'maher-fast-print-native').toLowerCase()
  )
    throw new Error('Invalid native Fast Print session.')
  return session
}

export function parseNativePrintRequest(text: string): NativePrintRequest {
  const data = JSON.parse(text) as NativePrintRequest
  if (
    !data ||
    data.version !== 1 ||
    !Number.isInteger(data.copies) ||
    data.copies < 1 ||
    data.copies > 999
  )
    throw new Error('Invalid native Fast Print request.')
  const preset = validateFastPrintPreset(data.preset)
  if (
    data.preparedPolaroid !== undefined &&
    (typeof data.preparedPolaroid !== 'boolean' || !preset.mode?.startsWith('polaroid-'))
  )
    throw new Error('Invalid prepared Polaroid request.')
  if (!preset.profileId || preset.mode === 'document')
    throw new Error('Missing native printer settings.')
  const files = normalizeFastPrintSelection(data.files)
  if (
    preset.sourceCopies &&
    (preset.sourceCopies.length !== files.length ||
      preset.sourceCopies.some(
        (count, index) => count > 1 && !/\.(png|jpe?g|gif)$/i.test(files[index])
      ))
  )
    throw new Error('Image quantities do not match the selected files.')
  if (preset.sourcePages && preset.sourcePages.length !== files.length)
    throw new Error('Page selections do not match the selected files.')
  if (preset.imageSizesMm && preset.imageSizesMm.length !== files.length)
    throw new Error('Image dimensions do not match the selected files.')
  if (
    preset.preserveActualSize &&
    files.some((file, index) => !/\.pdf$/i.test(file) && !preset.imageSizesMm?.[index])
  )
    throw new Error('Actual-size images require their original physical dimensions.')
  if (preset.pageRotations?.some((entry) => entry.file >= files.length))
    throw new Error('Page rotations do not match the selected files.')
  return {
    version: 1,
    files,
    preset,
    copies: data.copies,
    ...(data.preparedPolaroid ? { preparedPolaroid: true } : {})
  }
}
