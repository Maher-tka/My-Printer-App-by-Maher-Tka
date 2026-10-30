export type OfficePdfKind = 'word' | 'powerpoint' | 'excel'

export interface OfficePdfCapabilities {
  word: boolean
  powerpoint: boolean
  excel: boolean
  libreOffice: boolean
}

export interface OfficePdfRequest {
  kind: OfficePdfKind
  fileName: string
  bytes: Uint8Array
}

export type OfficePdfResult = { ok: true; bytes: Uint8Array } | { ok: false; error: string }

export const OFFICE_EXTENSIONS: Record<OfficePdfKind, string[]> = {
  word: ['doc', 'docx'],
  powerpoint: ['ppt', 'pptx'],
  excel: ['xls', 'xlsx']
}
