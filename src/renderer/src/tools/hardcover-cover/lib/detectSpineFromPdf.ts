import type { HardcoverPdfSource } from '../types'
import { getSpineDetectionSource } from './spineDetectionSource'
import { detectSpineText, type CoverTextBlock, type DetectedSpineText } from './spineDetection'

export async function detectSpineFromPdf(
  source: HardcoverPdfSource,
  signal: AbortSignal
): Promise<DetectedSpineText> {
  const input = getSpineDetectionSource(source)
  if (!input) throw new Error('Reimport the front-cover PDF to detect its spine text.')
  const { loadPdfDocument } = await import('../../booklet-montage/lib/pdfWorker')
  const { Util } = await import('pdfjs-dist')
  const pdf = await loadPdfDocument(input.bytes, signal)
  let canvas: HTMLCanvasElement | undefined
  try {
    const page = await pdf.getPage(input.pageNumber)
    signal.throwIfAborted()
    const viewport = page.getViewport({ scale: 1 })
    const text = await page.getTextContent()
    const blocks: CoverTextBlock[] = []
    for (const item of text.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const transform = Util.transform(viewport.transform, item.transform)
      const height = Math.max(Math.hypot(transform[2], transform[3]), 1)
      blocks.push({
        text: item.str,
        x: transform[4],
        y: transform[5] - height,
        width: Math.max(item.width, 1),
        height
      })
    }
    const embedded = detectSpineText({ width: viewport.width, height: viewport.height, blocks })
    const allText = blocks.map((b) => b.text).join(' ')
    const letters = (allText.match(/\p{L}/gu) ?? []).length
    const damaged = /[\ufffd\u0000-\u0008\u000e-\u001f]/.test(allText)
    // Normal text PDFs do not start OCR. Missing labels alone are not a reason
    // to spend CPU on an otherwise readable page.
    if (!damaged && (letters >= 80 || (embedded.studentName && embedded.shortTitle)))
      return embedded
    signal.throwIfAborted()
    // At most ~2.8 megapixels; do not render a full print-resolution PDF.
    const scale = Math.min(2.5, 1800 / Math.max(viewport.width, viewport.height))
    const rendered = page.getViewport({ scale })
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(rendered.width))
    canvas.height = Math.max(1, Math.ceil(rendered.height))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not read the scanned front cover.')
    const task = page.render({ canvas, canvasContext: context, viewport: rendered })
    const cancelRender = (): void => task.cancel()
    signal.addEventListener('abort', cancelRender, { once: true })
    try {
      await task.promise
    } finally {
      signal.removeEventListener('abort', cancelRender)
    }
    signal.throwIfAborted()
    const { recognizeSpinePage } = await import('./spineOcr')
    const recognized = await recognizeSpinePage(canvas, signal)
    signal.throwIfAborted()
    return detectSpineText({ width: canvas.width, height: canvas.height, blocks: recognized })
  } finally {
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
    await pdf.destroy()
  }
}
