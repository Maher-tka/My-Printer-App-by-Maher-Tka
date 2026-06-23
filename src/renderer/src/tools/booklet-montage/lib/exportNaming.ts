import type { BookletSource, ExportImageFormat, SheetSettings } from '../types'

const FALLBACK_EXPORT_NAME = 'booklet_montage'

export function getBookletImageExportFolderName(
  sources: BookletSource[],
  settings: Pick<SheetSettings, 'scaleMode'>
): string {
  const sourceName = sources[0]?.name ?? FALLBACK_EXPORT_NAME
  const baseName = sanitizeFileSystemName(stripFileExtension(sourceName), FALLBACK_EXPORT_NAME)

  return `${baseName}_${settings.scaleMode}`
}

export function getNumberedMontageImageFileName(
  index: number,
  format: ExportImageFormat
): string {
  return `${String(Math.max(1, index)).padStart(3, '0')}.${format}`
}

function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '')
}

function sanitizeFileSystemName(value: string, fallback: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')

  return sanitized || fallback
}
