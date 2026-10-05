export type PdfPrintBytes = Uint8Array | ArrayBuffer | number[]

export interface PrintPdfRequest {
  bytes: PdfPrintBytes
  suggestedName: string
  jobTitle?: string
  silent?: boolean
  copies?: number
}

export interface PrintPdfFileRequest {
  toolId?: string
  filePath: string
  suggestedName?: string
  jobTitle?: string
  silent?: boolean
  copies?: number
}

export interface PrintPdfResult {
  ok: boolean
  canceled?: boolean
  error?: string
  pdfName?: string
  printerName?: string
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]

export function getPrintPdfRequestError(request: Partial<PrintPdfRequest> | null): string | null {
  if (!request) return 'Print request is missing.'
  if (!request.suggestedName?.trim()) return 'PDF print request needs a file name.'
  if (!request.bytes) return 'PDF print request is missing PDF bytes.'
  if (!isPdfByteSource(request.bytes)) return 'Print requires a valid PDF file.'
  if (
    request.copies !== undefined &&
    (!Number.isInteger(request.copies) || request.copies < 1 || request.copies > 999)
  )
    return 'Print copies must be a whole number from 1 to 999.'
  return null
}

export function getPrintPdfFileRequestError(
  request: Partial<PrintPdfFileRequest> | null
): string | null {
  if (!request) return 'Print request is missing.'
  if (!request.filePath?.trim()) return 'Choose a PDF file before printing.'
  if (!request.filePath.trim().toLowerCase().endsWith('.pdf')) {
    return 'Only exported PDF files can be printed from the app.'
  }
  if (
    request.copies !== undefined &&
    (!Number.isInteger(request.copies) || request.copies < 1 || request.copies > 999)
  )
    return 'Print copies must be a whole number from 1 to 999.'
  return null
}

export function isPdfByteSource(bytes: PdfPrintBytes): boolean {
  if (getByteLength(bytes) < PDF_SIGNATURE.length) return false

  return PDF_SIGNATURE.every((expected, index) => readByte(bytes, index) === expected)
}

export function normalizePdfPrintName(name: string): string {
  const trimmed = name.trim() || 'print-job.pdf'
  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`
}

export function createPrintDialogResult(success: boolean, failureReason?: string): PrintPdfResult {
  if (success) return { ok: true }
  if (/cancel/i.test(failureReason ?? '')) {
    return { ok: false, canceled: true, error: 'Print canceled.' }
  }

  return {
    ok: false,
    error: failureReason || 'The printer driver did not accept the job.'
  }
}

function getByteLength(bytes: PdfPrintBytes): number {
  if (bytes instanceof ArrayBuffer) return bytes.byteLength
  return bytes.length
}

function readByte(bytes: PdfPrintBytes, index: number): number | undefined {
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes)[index]
  return bytes[index]
}
