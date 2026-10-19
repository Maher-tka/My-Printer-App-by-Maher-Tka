import type { FastPrintBatchSource } from '../../../shared/fast-print'
import { loadPdfDocument, destroyPdfDocument } from '../tools/booklet-montage/lib/pdfWorker'
import { FAST_PRINT_MAX_PAGES } from '../../../shared/fast-print-batch'
export async function printDriverDocument(batch: FastPrintBatchSource): Promise<void> {
  const label = (id: string, value: string) => {
    document.getElementById(id)!.textContent = value
  }
  const source = await window.fastPrint.file(0)
  label('file', source.name)
  label('preset', `${batch.preset.printer} · ${batch.preset.profileName ?? ''}`)
  const pdf = await loadPdfDocument(new Uint8Array(source.bytes))
  const canvas = document.createElement('canvas')
  try {
    if (pdf.numPages > FAST_PRINT_MAX_PAGES)
      throw new Error(`Choose up to ${FAST_PRINT_MAX_PAGES} pages.`)
    const progress = document.getElementById('progress') as HTMLProgressElement
    progress.max = pdf.numPages
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index)
      try {
        const original = page.getViewport({ scale: 1 })
        const widthMm = (original.width * 25.4) / 72,
          heightMm = (original.height * 25.4) / 72
        const actual = [widthMm, heightMm].sort((a, b) => a - b)
        const expected = [batch.preset.paperWidthMm!, batch.preset.paperHeightMm!].sort(
          (a, b) => a - b
        )
        if (
          actual.some(
            (size, i) => !Number.isFinite(expected[i]) || Math.abs(size - expected[i]) > 1
          )
        )
          throw new Error(
            'The PDF page size does not match the saved driver preset. Choose a matching paper size in Printing settings.'
          )
        const viewport = page.getViewport({
          scale: Math.min(300 / 72, 6000 / Math.max(original.width, original.height))
        })
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        await page.render({ canvas, viewport, intent: 'print', background: '#ffffff' }).promise
        await window.fastPrint.sheet(canvas.toDataURL('image/png'), { widthMm, heightMm })
        progress.value = index
        label('status', `${index} / ${pdf.numPages}`)
      } finally {
        page.cleanup()
        canvas.width = 0
        canvas.height = 0
      }
    }
    label('heading', 'Sending to your printer')
    const result = await window.fastPrint.submit()
    label('heading', result.verified ? 'Print settings verified' : 'Sent to print queue')
    await window.fastPrint.finish()
  } finally {
    canvas.width = 0
    canvas.height = 0
    await destroyPdfDocument(pdf)
  }
}
