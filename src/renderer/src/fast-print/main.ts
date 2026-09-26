import { fastPrintLayout, type FastPrintSource } from '../../../shared/fast-print'
import {
  loadPdfDocument,
  destroyPdfDocument,
  type PDFDocumentProxy
} from '../tools/booklet-montage/lib/pdfWorker'

declare global {
  interface Window {
    fastPrint: {
      source(): Promise<FastPrintSource>
      sheet(png: string): Promise<void>
      submit(): Promise<{ verified: boolean }>
      finish(error?: string): Promise<void>
    }
  }
}

function label(id: string, value: string): void {
  document.getElementById(id)!.textContent = value
}

async function run(): Promise<void> {
  let pdf: PDFDocumentProxy | undefined
  let image: ImageBitmap | undefined
  try {
    const source = await window.fastPrint.source()
    const { preset } = source
    label('file', source.name)
    label(
      'preset',
      `${preset.printer}${preset.profileName ? ` · ${preset.profileName}` : ''} · ${preset.paper} · ${preset.color ? 'Color' : 'Black & white'} · ${preset.pagesPerSheet} per sheet`
    )
    if (source.extension === '.pdf') pdf = await loadPdfDocument(new Uint8Array(source.bytes))
    else image = await createImageBitmap(new Blob([new Uint8Array(source.bytes)]))
    const pageCount = pdf?.numPages ?? 1
    if (pageCount > 2000)
      throw new Error('Fast Print supports up to 2,000 pages per job. Split this PDF first.')
    const layout = fastPrintLayout(preset)
    const canvas = document.createElement('canvas')
    canvas.width = layout.width
    canvas.height = layout.height
    const context = canvas.getContext('2d')!
    const progress = document.getElementById('progress') as HTMLProgressElement
    const totalSheets = Math.ceil(pageCount / preset.pagesPerSheet)
    progress.max = totalSheets
    for (let first = 0; first < pageCount; first += preset.pagesPerSheet) {
      context.filter = 'none'
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      for (let slot = 0; slot < preset.pagesPerSheet && first + slot < pageCount; slot++) {
        const page = pdf ? await pdf.getPage(first + slot + 1) : undefined
        const viewport = page?.getViewport({ scale: 1 })
        const sourceWidth = viewport?.width ?? image!.width
        const sourceHeight = viewport?.height ?? image!.height
        const scale = Math.min(layout.cellWidth / sourceWidth, layout.cellHeight / sourceHeight)
        const width = Math.max(1, Math.floor(sourceWidth * scale))
        const height = Math.max(1, Math.floor(sourceHeight * scale))
        const x =
          (slot % layout.columns) * (layout.cellWidth + layout.gap) + (layout.cellWidth - width) / 2
        const y =
          Math.floor(slot / layout.columns) * (layout.cellHeight + layout.gap) +
          (layout.cellHeight - height) / 2
        context.filter = preset.color ? 'none' : 'grayscale(1)'
        if (page) {
          const pageCanvas = document.createElement('canvas')
          pageCanvas.width = width
          pageCanvas.height = height
          try {
            await page.render({
              canvas: pageCanvas,
              viewport: page.getViewport({ scale }),
              intent: 'print',
              background: '#ffffff'
            }).promise
            context.drawImage(pageCanvas, x, y, width, height)
          } finally {
            pageCanvas.width = 0
            pageCanvas.height = 0
            page.cleanup()
          }
        } else context.drawImage(image!, x, y, width, height)
      }
      await window.fastPrint.sheet(canvas.toDataURL('image/png'))
      const count = Math.floor(first / preset.pagesPerSheet) + 1
      progress.value = count
      label('status', `Prepared sheet ${count} of ${totalSheets}. Close to cancel.`)
    }
    canvas.width = 0
    canvas.height = 0
    label('heading', 'Sending to your printer')
    label('status', 'Applying your settings. A PDF printer may ask where to save.')
    const result = await window.fastPrint.submit()
    label('heading', result.verified ? 'Print settings verified' : 'Sent to print queue')
    label('status', `${totalSheets} sheet${totalSheets === 1 ? '' : 's'} · ${preset.printer}`)
    await new Promise((resolve) => setTimeout(resolve, 1600))
    await window.fastPrint.finish()
  } catch (error) {
    await window.fastPrint
      .finish(error instanceof Error ? error.message : String(error))
      .catch(() => undefined)
  } finally {
    image?.close()
    await destroyPdfDocument(pdf)
  }
}
void run()
