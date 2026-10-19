import type { AppRoute } from '@/types/navigation'
import { planHardcoverPdfDrop } from '../hardcover-cover/lib/pdfDrop'

export const toolDropFormats = {
  'card-montage': 'AI, EPS, PDF, PNG, JPG',
  'booklet-montage': 'PDF, PNG, JPG',
  'hardcover-cover': 'PDF',
  'cutter-montage': 'AI, PDF, SVG, PNG, JPG',
  'sequential-number': 'PDF, PNG, JPG'
} as const

export type FileDropTool = keyof typeof toolDropFormats
export interface ToolFileImport {
  id: number
  files: File[]
}
export interface ToolFileDropProps {
  droppedFileImport?: ToolFileImport | null
  onDroppedFileImportConsumed?: (id: number, error?: string) => void
}

export function isFileDropTool(route: AppRoute): route is FileDropTool {
  return Object.prototype.hasOwnProperty.call(toolDropFormats, route)
}

const extensions: Record<FileDropTool, RegExp> = {
  'card-montage': /\.(ai|eps|pdf|png|jpe?g)$/i,
  'booklet-montage': /\.(pdf|png|jpe?g)$/i,
  'hardcover-cover': /\.pdf$/i,
  'cutter-montage': /\.(ai|pdf|svg|png|jpe?g)$/i,
  'sequential-number': /\.(pdf|png|jpe?g)$/i
}

/** Validate the entire batch before navigating or importing any artwork. */
export function validateToolFileDrop(route: FileDropTool, files: File[]): string | null {
  if (!files.length) return 'Drop files, not folders or links.'
  if (files.some((file) => !extensions[route].test(file.name)))
    return 'These files are not supported by this tool.'
  if (files.some((file) => !file.size)) return 'One or more dropped files are empty.'
  if (route === 'card-montage' && files.length > 2)
    return 'Drop one file, or two files for the front and back.'
  if (route === 'sequential-number' && files.length !== 1)
    return 'Drop one front design at a time. Use the back import to add a separate back.'
  if (route === 'hardcover-cover') {
    try {
      planHardcoverPdfDrop(files)
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not read the dropped files.'
    }
  }
  return null
}
