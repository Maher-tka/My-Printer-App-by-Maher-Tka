import type { PageOverlay } from './pdfOperations'
export type PdfWorkerRequest =
  | { operation: 'merge'; inputs: Array<{ bytes: Uint8Array }> }
  | {
      operation: 'split'
      bytes: Uint8Array
      ranges: string
      every: boolean
      maxOutputBytes: number
    }
  | { operation: 'optimize'; bytes: Uint8Array }
  | { operation: 'overlay'; bytes: Uint8Array; overlays: PageOverlay[] }

export function runPdfWorker(
  request: PdfWorkerRequest & { operation: 'split' },
  signal?: AbortSignal,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array[]>
export function runPdfWorker(
  request: Exclude<PdfWorkerRequest, { operation: 'split' }>,
  signal?: AbortSignal,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array>
export function runPdfWorker(
  request: PdfWorkerRequest,
  signal?: AbortSignal,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array | Uint8Array[]> {
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pdfOperations.worker.ts', import.meta.url), {
      type: 'module'
    })
    const cleanup = (): void => {
      signal?.removeEventListener('abort', cancel)
      worker.terminate()
    }
    const cancel = (): void => {
      cleanup()
      reject(new DOMException('Operation canceled.', 'AbortError'))
    }
    signal?.addEventListener('abort', cancel, { once: true })
    worker.onmessage = ({ data }) => {
      if (data.progress) {
        onProgress?.(data.progress.current, data.progress.total)
        return
      }
      cleanup()
      if (data.error) reject(new Error(data.error))
      else resolve(data.result)
    }
    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || 'Could not process this PDF.'))
    }
    try {
      worker.postMessage(request)
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}
