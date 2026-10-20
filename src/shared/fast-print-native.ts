import { basename, dirname, resolve } from 'node:path'
import { normalizeFastPrintSelection } from './fast-print-batch.js'
import { validateFastPrintPreset, type FastPrintPreset } from './fast-print.js'

export interface NativePrintRequest {
  version: 1
  files: string[]
  preset: FastPrintPreset
  copies: number
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
  if (!preset.profileId || preset.mode === 'document')
    throw new Error('Missing native printer settings.')
  return { version: 1, files: normalizeFastPrintSelection(data.files), preset, copies: data.copies }
}
