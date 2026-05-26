import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { assertNotCanceled, createCanceledError } from './memoryCleanup'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type { PDFDocumentProxy, PDFPageProxy }

export async function loadPdfDocument(
  bytes: Uint8Array,
  signal?: AbortSignal
): Promise<PDFDocumentProxy> {
  assertNotCanceled(signal)

  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    stopAtErrors: false
  })
  const abort = () => {
    void loadingTask.destroy()
  }

  signal?.addEventListener('abort', abort, { once: true })

  try {
    return await loadingTask.promise
  } catch (error) {
    if (signal?.aborted) {
      throw createCanceledError('PDF import canceled.')
    }

    throw normalizePdfError(error)
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}

export function normalizePdfError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error('Unsupported PDF. The app could not read this file.')
  }

  if (error.name === 'PasswordException') {
    return new Error('Password-protected PDF files are not supported yet.')
  }

  if (error.name === 'InvalidPDFException') {
    return new Error('Corrupted PDF. The file could not be parsed safely.')
  }

  if (error.name === 'MissingPDFException') {
    return new Error('PDF file could not be found or is empty.')
  }

  if (error.name === 'UnexpectedResponseException') {
    return new Error('Unsupported PDF. The file could not be loaded.')
  }

  if (error.name === 'UnknownErrorException') {
    return new Error('Unsupported PDF. The renderer reported an unknown PDF error.')
  }

  return error
}
