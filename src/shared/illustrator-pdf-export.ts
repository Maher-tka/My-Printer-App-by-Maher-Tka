import { validateFineCutHandoff, type FineCutHandoffRequest } from './finecut-handoff.js'

export interface IllustratorPdfExportRequest {
  layouts: Array<FineCutHandoffRequest & { repeatCount: number }>
  layoutNumber?: number
}
export interface IllustratorPdfExportResult {
  ok: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}
export interface IllustratorPdfBatchRequest {
  sheets: IllustratorPdfExportRequest[]
}
export interface IllustratorPdfBatchResult extends IllustratorPdfExportResult {
  folderPath?: string
  filePaths?: string[]
}

export function getCutterSheetPdfFileName(
  layoutNumber: number,
  repeatCount: number,
  mode = 'print-cut'
): string {
  const suffix =
    mode === 'print-only'
      ? '_print'
      : mode === 'customer-preview'
        ? '_preview'
        : mode === 'cut-only' || mode === 'test-cut'
          ? '_cut'
          : ''
  return `sheet_${String(layoutNumber).padStart(2, '0')}_x${repeatCount}${suffix}.pdf`
}

export function validateIllustratorPdfBatch(value: unknown): value is IllustratorPdfBatchRequest {
  if (!value || typeof value !== 'object') return false
  const sheets = (value as IllustratorPdfBatchRequest).sheets
  return (
    Array.isArray(sheets) &&
    sheets.length > 0 &&
    sheets.length <= 100 &&
    sheets.every(
      (sheet) =>
        validateIllustratorPdfExport(sheet) &&
        Number.isSafeInteger(sheet.layoutNumber) &&
        (sheet.layoutNumber ?? 0) > 0
    ) &&
    new Set(sheets.map((sheet) => sheet.layoutNumber)).size === sheets.length &&
    sheets.reduce((total, sheet) => total + sheet.layouts[0].svg.length, 0) < 100 * 1024 * 1024
  )
}
export function validateIllustratorPdfExport(value: unknown): value is IllustratorPdfExportRequest {
  if (!value || typeof value !== 'object') return false
  const layouts = (value as IllustratorPdfExportRequest).layouts
  return (
    Array.isArray(layouts) &&
    layouts.length === 1 &&
    ((value as IllustratorPdfExportRequest).layoutNumber === undefined ||
      (Number.isSafeInteger((value as IllustratorPdfExportRequest).layoutNumber) &&
        (value as IllustratorPdfExportRequest).layoutNumber! > 0)) &&
    layouts.every(
      (layout) =>
        validateFineCutHandoff(layout) &&
        Number.isSafeInteger(layout.repeatCount) &&
        layout.repeatCount > 0 &&
        layout.repeatCount <= 5000
    ) &&
    layouts.reduce((total, layout) => total + layout.svg.length, 0) < 100 * 1024 * 1024
  )
}
