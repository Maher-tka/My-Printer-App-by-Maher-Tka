export const PDF_PICKER_TYPES = {
  pdf: { extensions: ['pdf'], multiple: false },
  merge: { extensions: ['pdf'], multiple: true },
  images: { extensions: ['jpg', 'jpeg', 'png'], multiple: true },
  word: { extensions: ['doc', 'docx'], multiple: false },
  powerpoint: { extensions: ['ppt', 'pptx'], multiple: false },
  excel: { extensions: ['xls', 'xlsx'], multiple: false }
} as const
export type PdfPickerKind = keyof typeof PDF_PICKER_TYPES
export function pdfPickerOptions(kind: PdfPickerKind): {
  title: string
  properties: Array<'openFile' | 'multiSelections'>
  filters: Array<{ name: string; extensions: string[] }>
} {
  if (!Object.prototype.hasOwnProperty.call(PDF_PICKER_TYPES, kind))
    throw new Error('Unsupported PDF import type.')
  const config = PDF_PICKER_TYPES[kind]
  return {
    title: 'Import files',
    properties: config.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [{ name: 'Supported files', extensions: [...config.extensions] }]
  }
}
export interface PdfSelectedFile {
  id: string
  name: string
  size: number
  lastModified: number
}
export type PdfSelectedFilesResult =
  | { ok: true; files: PdfSelectedFile[] }
  | { ok: false; canceled?: boolean; error?: string }
export type PdfReadFileResult = { ok: true; bytes: Uint8Array } | { ok: false; error: string }
