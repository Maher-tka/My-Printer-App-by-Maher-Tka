import {
  fastPrintLayout,
  fastPrintSourceLayout,
  fastPrintContentTurns,
  fastPrintCell,
  type FastPrintSource,
  type FastPrintBatchSource,
  type FastPrintSubmitOptions,
  type IdPrinterSelection
} from '../../../shared/fast-print'
import { FAST_PRINT_MAX_PAGES, needsBatchBlankBack } from '../../../shared/fast-print-batch'
import type { IdPrintDraft } from '../../../shared/fast-print-id'
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
      back(draft: IdPrintDraft): Promise<void>
      saveIdDraft(draft: IdPrintDraft): Promise<void>
      selectIdPrinter(printer: string, draft: IdPrintDraft): Promise<IdPrinterSelection>
      selectIdPreset(id: string, draft: IdPrintDraft): Promise<IdPrinterSelection>
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
    if (preset.sourcePages && preset.sourcePages.length !== batch.files.length)
      throw new Error('Page selections do not match the selected files.')
    label('file', batch.name)
    label(
      'preset',
      `${preset.printer}${preset.profileName ? ` · ${preset.profileName}` : ''} · ${preset.paper} · ${preset.color ? 'Color' : 'Black & white'} · ${preset.pagesPerSheet} per sheet`
    )
    let layout = fastPrintLayout(preset)
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
      if (preset.combineFiles) groupEnd = batch.files.length - 1
      else if (preset.combineImages && source.extension !== '.pdf') {
        while (groupEnd + 1 < batch.files.length && batch.files[groupEnd + 1].extension !== '.pdf')
          groupEnd++
      }
      label(
        'file',
        batch.files.length === 1
          ? source.name
          : `${documentIndex + 1} of ${batch.files.length} · ${source.name}`
      )
      try {
        let loadedIndex = -1
        const load = async (index: number): Promise<void> => {
          if (loadedIndex === index) return
          image?.close()
          image = undefined
          await destroyPdfDocument(pdf)
          pdf = undefined
          const file = index === documentIndex ? source : await window.fastPrint.file(index)
          if (file.extension === '.pdf') pdf = await loadPdfDocument(new Uint8Array(file.bytes))
          else image = await createImageBitmap(new Blob([new Uint8Array(file.bytes)]))
          loadedIndex = index
        }
        const pages: Array<{ file: number; page: number }> = []
        for (let file = documentIndex; file <= groupEnd; file++) {
          const isPdf = batch.files[file].extension === '.pdf'
          if (isPdf) await load(file)
          const count = isPdf ? pdf!.numPages : 1
          const selected = preset.sourcePages?.[file]
          if (selected?.some((page) => page >= count))
            throw new Error('The selected pages no longer exist. Review the page selection.')
          for (const page of selected ?? Array.from({ length: count }, (_, index) => index))
            pages.push({ file, page })
          if (totalPages + pages.length > FAST_PRINT_MAX_PAGES)
            throw new Error(`Fast Print supports up to ${FAST_PRINT_MAX_PAGES} pages in one job.`)
        }
        const pageCount = pages.length
        totalPages += pageCount
        if (totalPages > FAST_PRINT_MAX_PAGES)
          throw new Error(
            `Fast Print supports up to ${FAST_PRINT_MAX_PAGES} pages in one job. Split this batch first.`
          )
        const documentSheets = Math.ceil(pageCount / preset.pagesPerSheet)
        // Each group starts a fresh sheet; combined files share one ordered page stream.
        for (let first = 0; first < pageCount; first += preset.pagesPerSheet) {
          if (preset.autoOrientation && preset.pagesPerSheet === 1) {
            await load(pages[first].file)
            const sourcePage = pdf ? await pdf.getPage(pages[first].page + 1) : undefined
            const turns = preset.sourceRotations?.[pages[first].file] ?? 0
            const view = sourcePage?.getViewport({
              scale: 1,
              rotation: (sourcePage.rotate + turns * 90) % 360
            })
            const width = view?.width ?? (turns % 2 ? image!.height : image!.width)
            const height = view?.height ?? (turns % 2 ? image!.width : image!.height)
            layout = fastPrintSourceLayout(preset, width, height)
            canvas.width = layout.width
            canvas.height = layout.height
          }
          context.filter = 'none'
          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, canvas.width, canvas.height)
          for (let slot = 0; slot < preset.pagesPerSheet && first + slot < pageCount; slot++) {
            const ref = pages[first + slot]
            label(
              'file',
              `${ref.file + 1} of ${batch.files.length} · ${batch.files[ref.file].name}`
            )
            await load(ref.file)
            const page = pdf ? await pdf.getPage(ref.page + 1) : undefined
            const manualTurns = preset.sourceRotations?.[ref.file] ?? 0
            const originalView = page?.getViewport({ scale: 1, rotation: page.rotate })
            const turns = fastPrintContentTurns(
              preset,
              layout,
              originalView?.width ?? image!.width,
              originalView?.height ?? image!.height,
              manualTurns
            )
            const rotation = page ? (page.rotate + turns * 90) % 360 : 0
            const viewport = page?.getViewport({ scale: 1, rotation })
            const sourceWidth = viewport?.width ?? image!.width
            const sourceHeight = viewport?.height ?? image!.height
            const rotatedWidth = !page && turns % 2 ? sourceHeight : sourceWidth,
              rotatedHeight = !page && turns % 2 ? sourceWidth : sourceHeight
            const scale = (preset.fitToFrame ? Math.max : Math.min)(
              layout.cellWidth / rotatedWidth,
              layout.cellHeight / rotatedHeight
            )
            const width = Math.max(1, Math.floor(rotatedWidth * scale))
            const height = Math.max(1, Math.floor(rotatedHeight * scale))
            const cell = fastPrintCell(
              layout,
              slot,
              Math.min(preset.pagesPerSheet, pageCount - first)
            )
            const x = cell.x + (cell.width - width) / 2,
              y = cell.y + (cell.height - height) / 2
            context.filter = preset.color ? 'none' : 'grayscale(1)'
            context.save()
            context.beginPath()
            context.rect(cell.x, cell.y, layout.cellWidth, layout.cellHeight)
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
                  viewport: page.getViewport({ scale, rotation }),
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
                  preset.fitToFrame ? cell.x : x,
                  preset.fitToFrame ? cell.y : y,
                  preset.fitToFrame ? layout.cellWidth : width,
                  preset.fitToFrame ? layout.cellHeight : height
                )
              } finally {
                pageCanvas.width = 0
                pageCanvas.height = 0
                page.cleanup()
              }
            } else {
              context.translate(cell.x + cell.width / 2, cell.y + cell.height / 2)
              context.rotate((turns * Math.PI) / 2)
              context.drawImage(
                image!,
                (-sourceWidth * scale) / 2,
                (-sourceHeight * scale) / 2,
                sourceWidth * scale,
                sourceHeight * scale
              )
            }
            context.restore()
          }
          await window.fastPrint.sheet(canvas.toDataURL('image/png'), {
            widthMm: (layout.width / 200) * 25.4,
            heightMm: (layout.height / 200) * 25.4
          })
          totalSheets++
          const count = Math.floor(first / preset.pagesPerSheet) + 1
          progress.value = documentIndex + ((groupEnd - documentIndex + 1) * count) / documentSheets
          label(
            'status',
            `File ${pages[Math.min(first + preset.pagesPerSheet, pageCount) - 1].file + 1} of ${batch.files.length} · Sheet ${count} of ${documentSheets}. Close to cancel.`
          )
        }
        const hasFollowingPages = preset.sourcePages
          ? preset.sourcePages.slice(groupEnd + 1).some((pages) => pages.length > 0)
          : groupEnd < batch.files.length - 1
        if (
          documentSheets > 0 &&
          hasFollowingPages &&
          needsBatchBlankBack(documentSheets, 0, 2, preset.duplex === true)
        ) {
          context.filter = 'none'
          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, canvas.width, canvas.height)
          await window.fastPrint.sheet(canvas.toDataURL('image/png'), {
            widthMm: (layout.width / 200) * 25.4,
            heightMm: (layout.height / 200) * 25.4
          })
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
    if (totalSheets === 0) throw new Error('Select at least one page to print.')
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
