import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import jbig2WasmUrl from 'pdfjs-dist/wasm/jbig2.wasm?url'
import openJpegFallbackUrl from 'pdfjs-dist/wasm/openjpeg_nowasm_fallback.js?url'
import openJpegWasmUrl from 'pdfjs-dist/wasm/openjpeg.wasm?url'
import qcmsWasmUrl from 'pdfjs-dist/wasm/qcms_bg.wasm?url'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { assertNotCanceled, createCanceledError } from './memoryCleanup'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const PDF_JS_DECODER_ASSET_URLS = {
  'openjpeg.wasm': openJpegWasmUrl,
  'openjpeg_nowasm_fallback.js': openJpegFallbackUrl,
  'jbig2.wasm': jbig2WasmUrl,
  'qcms_bg.wasm': qcmsWasmUrl
} as const

export const PDF_JS_DECODER_ASSET_FILENAMES = Object.keys(PDF_JS_DECODER_ASSET_URLS)

const PDF_JS_WASM_BASE_URL = new URL('.', new URL(openJpegWasmUrl, import.meta.url)).href

type PdfJsDecoderAssetName = keyof typeof PDF_JS_DECODER_ASSET_URLS

/**
 * PDF.js creates this factory in the renderer when `useWorkerFetch` is false.
 * Keeping the asset map in application code makes Vite emit the decoder files
 * into both the dev server and packaged renderer output; no node_modules path
 * is resolved at runtime.
 */
export class PdfJsWasmFactory {
  constructor(_options?: { baseUrl?: string | null }) {}

  async fetch({ filename }: { filename: string }): Promise<Uint8Array> {
    const assetUrl = PDF_JS_DECODER_ASSET_URLS[filename as PdfJsDecoderAssetName]

    if (!assetUrl) {
      throw new Error(`Unsupported PDF.js decoder asset: ${filename}`)
    }

    return readPdfJsDecoderAsset(assetUrl, filename)
  }
}

async function readPdfJsDecoderAsset(url: string, filename: string): Promise<Uint8Array> {
  try {
    const response = await fetch(url)
    if (response.ok || response.status === 0) {
      return new Uint8Array(await response.arrayBuffer())
    }
  } catch {
    // Electron packaged builds can require the XHR file:// path below.
  }

  if (typeof XMLHttpRequest === 'function') {
    return new Promise<Uint8Array>((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.open('GET', url, true)
      request.responseType = 'arraybuffer'
      request.onreadystatechange = () => {
        if (request.readyState !== XMLHttpRequest.DONE) return

        if (request.status === 200 || request.status === 0) {
          resolve(new Uint8Array(request.response))
        } else {
          reject(new Error(`Unable to load PDF.js decoder asset: ${filename}`))
        }
      }
      request.onerror = () => reject(new Error(`Unable to load PDF.js decoder asset: ${filename}`))
      request.send()
    })
  }

  throw new Error(`Unable to load PDF.js decoder asset: ${filename}`)
}

export type { PDFDocumentProxy, PDFPageProxy }

export async function loadPdfDocument(
  bytes: Uint8Array,
  signal?: AbortSignal,
  colorManaged = false
): Promise<PDFDocumentProxy> {
  assertNotCanceled(signal)

  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    stopAtErrors: false,
    wasmUrl: PDF_JS_WASM_BASE_URL,
    WasmFactory: PdfJsWasmFactory,
    // PDF.js disables its ICC engine when worker fetch is disabled. Opt in
    // for color-managed artwork using the same locally bundled WASM files.
    useWorkerFetch: colorManaged,
    useWasm: true
  })
  const destroyLoadingTask = async (): Promise<void> => {
    try {
      await loadingTask.destroy()
    } catch {
      // The loading task can already be settled when cancellation arrives.
    }
  }
  const abort = () => {
    void destroyLoadingTask()
  }

  signal?.addEventListener('abort', abort, { once: true })

  try {
    const pdf = await loadingTask.promise
    assertNotCanceled(signal)
    return pdf
  } catch (error) {
    if (signal?.aborted) {
      await destroyLoadingTask()
      throw createCanceledError('PDF import canceled.')
    }

    throw normalizePdfError(error)
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}

/**
 * Keep document cleanup in one place so import and future PDF consumers do
 * not leave worker-side page resources behind after cancellation or failure.
 */
export async function destroyPdfDocument(pdf: PDFDocumentProxy | undefined): Promise<void> {
  if (!pdf) return

  try {
    pdf.cleanup()
  } catch {
    // Cleanup is best effort; destroy below still releases the worker.
  }

  try {
    await pdf.destroy()
  } catch {
    // A canceled PDF.js task may already have destroyed the document.
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
