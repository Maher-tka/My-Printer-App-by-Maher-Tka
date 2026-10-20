import {
  fastPrintLayout,
  type FastPrintSource,
  type FastPrintBatchSource,
  type FastPrintSubmitOptions
} from '../../../shared/fast-print'
import { FAST_PRINT_MAX_PAGES, needsBatchBlankBack } from '../../../shared/fast-print-batch'
import {
  loadPdfDocument,
  destroyPdfDocument,
  type PDFDocumentProxy
} from '../tools/booklet-montage/lib/pdfWorker'

declare global {
  interface Window {
    fastPrint: {
      source(): Promise<FastPrintBatchSource>
      file(index: number): Promise<FastPrintSource>
      sheet(png: string, size?: { widthMm: number; heightMm: number }): Promise<void>
      submit(
        options?: FastPrintSubmitOptions
      ): Promise<{ verified: boolean; manualBackCanceled?: boolean }>
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
  const canvas = document.createElement('canvas')
  try {
    const batch = await window.fastPrint.source()
    if (batch.preset.mode === 'document') {
      const { printDriverDocument } = await import('./driverDocument')
      await printDriverDocument(batch)
      return
    }
    if (batch.preset.mode === 'polaroid-8' || batch.preset.mode === 'polaroid-9') {
      const { printPolaroid } = await import('./polaroid')
      await printPolaroid(batch)
      return
    }
    if (batch.preset.mode === 'id-card') {
      const { openIdPrint } = await import('./IdPrint')
      openIdPrint(batch)
      return
    }
    const { preset } = batch
    label('file', batch.name)
    label(
      'preset',
      `${preset.printer}${preset.profileName ? ` · ${preset.profileName}` : ''} · ${preset.paper} · ${preset.color ? 'Color' : 'Black & white'} · ${preset.pagesPerSheet} per sheet`
    )
    const layout = fastPrintLayout(preset)
    canvas.width = layout.width
    canvas.height = layout.height
    const context = canvas.getContext('2d')!
    const progress = document.getElementById('progress') as HTMLProgressElement
    progress.max = batch.files.length
    let totalPages = 0
    let totalSheets = 0
    for (let documentIndex = 0; documentIndex < batch.files.length; documentIndex++) {
      const source = await window.fastPrint.file(documentIndex)
      let groupEnd = documentIndex
      if (preset.combineImages && source.extension !== '.pdf') {
        while (groupEnd + 1 < batch.files.length && batch.files[groupEnd + 1].extension !== '.pdf')
          groupEnd++
      }
      const imageGroup = source.extension !== '.pdf' && groupEnd > documentIndex
      label(
        'file',
        batch.files.length === 1
          ? source.name
          : `${documentIndex + 1} of ${batch.files.length} · ${source.name}`
      )
      try {
        if (source.extension === '.pdf') pdf = await loadPdfDocument(new Uint8Array(source.bytes))
        else image = await createImageBitmap(new Blob([new Uint8Array(source.bytes)]))
        const pageCount = pdf?.numPages ?? groupEnd - documentIndex + 1
        totalPages += pageCount
        if (totalPages > FAST_PRINT_MAX_PAGES)
          throw new Error(
            `Fast Print supports up to ${FAST_PRINT_MAX_PAGES} pages in one job. Split this batch first.`
          )
        const documentSheets = Math.ceil(pageCount / preset.pagesPerSheet)
        // Reset n-up at each document boundary; never fill a document's final sheet
        // with pages from the next document.
        for (let first = 0; first < pageCount; first += preset.pagesPerSheet) {
          context.filter = 'none'
          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, canvas.width, canvas.height)
          for (let slot = 0; slot < preset.pagesPerSheet && first + slot < pageCount; slot++) {
            if (imageGroup && first + slot > 0) {
              image?.close()
              const next = await window.fastPrint.file(documentIndex + first + slot)
              image = await createImageBitmap(new Blob([new Uint8Array(next.bytes)]))
            }
            const page = pdf ? await pdf.getPage(first + slot + 1) : undefined
            const viewport = page?.getViewport({ scale: 1 })
            const sourceWidth = viewport?.width ?? image!.width
            const sourceHeight = viewport?.height ?? image!.height
            const scale = (preset.fitToFrame ? Math.max : Math.min)(
              layout.cellWidth / sourceWidth,
              layout.cellHeight / sourceHeight
            )
            const width = Math.max(1, Math.floor(sourceWidth * scale))
            const height = Math.max(1, Math.floor(sourceHeight * scale))
            const x =
              (slot % layout.columns) * (layout.cellWidth + layout.gap) +
              (layout.cellWidth - width) / 2
            const y =
              Math.floor(slot / layout.columns) * (layout.cellHeight + layout.gap) +
              (layout.cellHeight - height) / 2
            context.filter = preset.color ? 'none' : 'grayscale(1)'
            context.save()
            context.beginPath()
            context.rect(
              (slot % layout.columns) * (layout.cellWidth + layout.gap),
              Math.floor(slot / layout.columns) * (layout.cellHeight + layout.gap),
              layout.cellWidth,
              layout.cellHeight
            )
            context.clip()
            if (page) {
              const pageCanvas = document.createElement('canvas')
              // Cover mode crops into a bounded cell instead of allocating an
              // arbitrarily wide/tall bitmap for panoramic PDF pages.
              pageCanvas.width = preset.fitToFrame ? Math.ceil(layout.cellWidth) : width
              pageCanvas.height = preset.fitToFrame ? Math.ceil(layout.cellHeight) : height
              try {
                await page.render({
                  canvas: pageCanvas,
                  viewport: page.getViewport({ scale }),
                  ...(preset.fitToFrame
                    ? {
                        transform: [
                          1,
                          0,
                          0,
                          1,
                          (layout.cellWidth - width) / 2,
                          (layout.cellHeight - height) / 2
                        ]
                      }
                    : {}),
                  intent: 'print',
                  background: '#ffffff'
                }).promise
                context.drawImage(
                  pageCanvas,
                  preset.fitToFrame ? (slot % layout.columns) * (layout.cellWidth + layout.gap) : x,
                  preset.fitToFrame
                    ? Math.floor(slot / layout.columns) * (layout.cellHeight + layout.gap)
                    : y,
                  preset.fitToFrame ? layout.cellWidth : width,
                  preset.fitToFrame ? layout.cellHeight : height
                )
              } finally {
                pageCanvas.width = 0
                pageCanvas.height = 0
                page.cleanup()
              }
            } else context.drawImage(image!, x, y, width, height)
            context.restore()
          }
          await window.fastPrint.sheet(canvas.toDataURL('image/png'))
          totalSheets++
          const count = Math.floor(first / preset.pagesPerSheet) + 1
          progress.value = documentIndex + ((groupEnd - documentIndex + 1) * count) / documentSheets
          label(
            'status',
            `File ${documentIndex + 1} of ${batch.files.length} · Sheet ${count} of ${documentSheets}. Close to cancel.`
          )
        }
        if (
          needsBatchBlankBack(documentSheets, groupEnd, batch.files.length, preset.duplex === true)
        ) {
          context.filter = 'none'
          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, canvas.width, canvas.height)
          await window.fastPrint.sheet(canvas.toDataURL('image/png'))
          totalSheets++
        }
        documentIndex = groupEnd
      } catch (error) {
        throw new Error(
          `${source.name}: ${error instanceof Error ? error.message : String(error)}. The batch has not been sent to the printer.`
        )
      } finally {
        image?.close()
        image = undefined
        await destroyPdfDocument(pdf)
        pdf = undefined
      }
    }
    canvas.width = 0
    canvas.height = 0
    label('heading', 'Sending to your printer')
    label('status', 'Applying your settings. A PDF printer may ask where to save.')
    const result = await window.fastPrint.submit()
    label('heading', result.verified ? 'Print settings verified' : 'Sent to print queue')
    label(
      'status',
      `${batch.files.length} file${batch.files.length === 1 ? '' : 's'} · ${preset.duplex ? Math.ceil(totalSheets / 2) : totalSheets} sheet${(preset.duplex ? Math.ceil(totalSheets / 2) : totalSheets) === 1 ? '' : 's'} · ${preset.printer}`
    )
    await new Promise((resolve) => setTimeout(resolve, 1600))
    await window.fastPrint.finish()
  } catch (error) {
    await window.fastPrint
      .finish(error instanceof Error ? error.message : String(error))
      .catch(() => undefined)
  } finally {
    canvas.width = 0
    canvas.height = 0
    image?.close()
    await destroyPdfDocument(pdf)
  }
}
void run()
