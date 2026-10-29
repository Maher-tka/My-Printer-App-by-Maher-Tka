import { mergePdfs, optimizePdf, overlayPdf, splitPdf } from './pdfOperations'
import type { PdfWorkerRequest } from './pdfWorkerClient'

self.onmessage = async ({ data }: MessageEvent<PdfWorkerRequest>) => {
  try {
    const progress = (current: number, total: number): void =>
      self.postMessage({ progress: { current, total } })
    const result =
      data.operation === 'merge'
        ? await mergePdfs(data.inputs, undefined, progress)
        : data.operation === 'split'
          ? await splitPdf(
              data.bytes,
              data.ranges,
              data.every,
              undefined,
              progress,
              data.maxOutputBytes
            )
          : data.operation === 'overlay'
            ? await overlayPdf(data.bytes, data.overlays)
            : await optimizePdf(data.bytes)
    const buffers = Array.isArray(result) ? result.map((bytes) => bytes.buffer) : [result.buffer]
    ;(
      self as unknown as { postMessage: (message: unknown, transfers: Transferable[]) => void }
    ).postMessage({ result }, [...new Set(buffers)] as ArrayBuffer[])
  } catch (error) {
    self.postMessage({ error: (error as Error).message })
  }
}
