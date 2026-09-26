import type {
  PrintPdfFileRequest,
  PrintPdfRequest,
  PrintPdfResult
} from '../../../shared/print-types'

export async function printPdf(request: PrintPdfRequest): Promise<PrintPdfResult> {
  if (!window.printerApp?.printPdf) {
    return {
      ok: false,
      error: 'Printing is only available in the desktop app.'
    }
  }

  return window.printerApp.printPdf({
    ...request,
    silent: request.silent === true
  })
}

export async function printPdfFile(request: PrintPdfFileRequest): Promise<PrintPdfResult> {
  if (!window.printerApp?.printPdfFile) {
    return {
      ok: false,
      error: 'Printing is only available in the desktop app.'
    }
  }

  return window.printerApp.printPdfFile({
    ...request,
    silent: request.silent === true
  })
}

export function getPrintResultMessage(result: PrintPdfResult, fallbackName: string): string {
  if (result.ok) return `Sent ${result.pdfName ?? fallbackName} to the printer.`
  if (result.canceled) return 'Print canceled.'
  return result.error ?? 'Printing failed.'
}
