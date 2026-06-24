const INVALID_FILE_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/g

export function safeFileName(value: string, fallback = 'untitled'): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(INVALID_FILE_CHARACTERS, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '')
  return normalized || fallback
}

export function versionedFileName(baseName: string, version: number, extension: string): string {
  return `${safeFileName(baseName)}_v${String(Math.max(1, version)).padStart(2, '0')}.${extension.replace(/^\./, '')}`
}

export function batchCoverFileName(index: number, studentName: string): string {
  return `${String(index + 1).padStart(3, '0')}_${safeFileName(studentName, 'Student')}_Cover.pdf`
}
