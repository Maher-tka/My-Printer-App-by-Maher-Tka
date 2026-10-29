import { PDFDocument } from 'pdf-lib'
import { zip } from 'fflate'
import { loadPdfDocument } from '../booklet-montage/lib/pdfWorker'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  fileStem,
  parsePageGroups,
  type PdfInput,
  type PdfOptions,
  type PdfOutput,
  type PdfToolId
} from './model'
import { runPdfWorker } from './pdfWorkerClient'
import { getPdfMemoryPolicy } from './memoryPolicy'
import { createCardJpegPdf } from '../card-montage/lib/jpegArtwork'

export type PdfProgress = (current: number, total: number) => void
export async function withPdf<T>(
  bytes: Uint8Array,
  work: (pdf: PDFDocumentProxy) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const pdf = await loadPdfDocument(bytes.slice(), signal)
  try {
    return await work(pdf)
  } finally {
    await pdf.destroy()
  }
}

export async function renderPdfPage(
  pdf: PDFDocumentProxy,
  index: number,
  dpi = 100,
  signal?: AbortSignal
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  signal?.throwIfAborted()
  const page = await pdf.getPage(index + 1)
  const original = page.getViewport({ scale: 1 })
  const scale = Math.min(
    dpi / 72,
    Math.sqrt(getPdfMemoryPolicy().maxCanvasPixels / (original.width * original.height)),
    8000 / Math.max(original.width, original.height)
  )
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')!
  const task = page.render({ canvasContext: context, canvas, viewport, background: 'white' })
  const cancel = (): void => task.cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    await task.promise
    signal?.throwIfAborted()
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('Could not render this page.'))),
        'image/jpeg',
        0.88
      )
    )
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      width: original.width,
      height: original.height
    }
  } finally {
    signal?.removeEventListener('abort', cancel)
    canvas.width = 0
    canvas.height = 0
    page.cleanup()
  }
}

export async function inspectPdf(input: PdfInput, signal?: AbortSignal): Promise<PdfInput> {
  return withPdf(
    input.bytes,
    async (pdf) => {
      if (!pdf.numPages) throw new Error('The PDF has no pages.')
      if (await pdf.getPermissions()) throw new Error('Unlock this PDF before importing it.')
      let thumbnail: string | undefined
      try {
        const first = await renderPdfPage(pdf, 0, 25, signal)
        thumbnail = URL.createObjectURL(
          new Blob([new Uint8Array(first.bytes)], { type: 'image/jpeg' })
        )
      } catch (error) {
        if (signal?.aborted) throw error
      }
      return {
        ...input,
        pages: pdf.numPages,
        thumbnail
      }
    },
    signal
  )
}

export interface TextCell {
  text: string
  x: number
  y: number
  width: number
  height: number
}
export async function pageText(pdf: PDFDocumentProxy, index: number): Promise<TextCell[]> {
  const page = await pdf.getPage(index + 1)
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  return content.items.flatMap((item) => {
    if (!('str' in item) || !item.str.trim()) return []
    const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
    return [{ text: item.str, x, y, width: item.width, height: item.height || 12 }]
  })
}

export function textRows(cells: TextCell[]): TextCell[][] {
  const rows: TextCell[][] = []
  for (const cell of [...cells].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find(
      (row) =>
        Math.abs(row[0].y - cell.y) < Math.max(3, Math.min(row[0].height, cell.height) * 0.45)
    )
    if (row) row.push(cell)
    else rows.push([cell])
  }
  return rows.map((row) => row.sort((a, b) => a.x - b.x))
}

async function zipOutputs(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    zip(files, { level: 0 }, (error, bytes) => (error ? reject(error) : resolve(bytes)))
  )
}

export async function imagesToPdf(
  inputs: PdfInput[],
  options: PdfOptions,
  progress: PdfProgress,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const result = await PDFDocument.create()
  for (const [index, input] of inputs.entries()) {
    signal?.throwIfAborted()
    const source =
      input.bytes[0] === 0x89
        ? await PDFDocument.create()
        : await PDFDocument.load(await createCardJpegPdf(input.bytes))
    if (input.bytes[0] === 0x89) {
      const png = await source.embedPng(input.bytes)
      source
        .addPage([png.width, png.height])
        .drawImage(png, { x: 0, y: 0, width: png.width, height: png.height })
    }
    const sourcePage = source.getPage(0),
      image = sourcePage.getSize()
    let width = options.paper === 'Letter' ? 612 : 595.276
    let height = options.paper === 'Letter' ? 792 : 841.89
    const margin = (options.margin * 72) / 25.4
    if (options.paper === 'Fit') {
      width = image.width * 0.75 + margin * 2
      height = image.height * 0.75 + margin * 2
    } else if (options.orientation === 'landscape') [width, height] = [height, width]
    const page = result.addPage([width, height])
    const scale = (options.imageFit === 'cover' ? Math.max : Math.min)(
      (width - margin * 2) / image.width,
      (height - margin * 2) / image.height
    )
    if (options.imageFit === 'cover') {
      // A clipped embedded page keeps fill-to-page artwork inside its margins.
      const cropWidth = (width - margin * 2) / scale,
        cropHeight = (height - margin * 2) / scale
      const [embedded] = await result.embedPages(
        [sourcePage],
        [
          {
            left: (image.width - cropWidth) / 2,
            bottom: (image.height - cropHeight) / 2,
            right: (image.width + cropWidth) / 2,
            top: (image.height + cropHeight) / 2
          }
        ]
      )
      page.drawPage(embedded, {
        x: margin,
        y: margin,
        width: width - margin * 2,
        height: height - margin * 2
      })
    } else {
      const [embedded] = await result.embedPages([sourcePage])
      page.drawPage(embedded, {
        x: (width - image.width * scale) / 2,
        y: (height - image.height * scale) / 2,
        width: image.width * scale,
        height: image.height * scale
      })
    }
    progress(index + 1, inputs.length)
  }
  return result.save()
}

async function convertFromPdf(
  id: PdfToolId,
  input: PdfInput,
  options: PdfOptions,
  progress: PdfProgress,
  signal?: AbortSignal
): Promise<PdfOutput> {
  return withPdf(
    input.bytes,
    async (pdf) => {
      const pages = [...new Set(parsePageGroups(options.ranges, pdf.numPages).flat())]
      const name = fileStem(input.name)
      const pictures: Record<string, Uint8Array> = {}
      let totalBytes = 0
      const reserveOutput = (bytes: number): void => {
        totalBytes += bytes
        if (totalBytes > getPdfMemoryPolicy().maxOutputBytes)
          throw new Error(
            'The output exceeds the current memory budget. Select fewer pages or reduce the resolution.'
          )
      }
      if (id === 'pdf-jpg') {
        for (const [index, page] of pages.entries()) {
          const rendered = await renderPdfPage(pdf, page, options.dpi, signal)
          reserveOutput(rendered.bytes.length)
          pictures[`${name}-${String(page + 1).padStart(3, '0')}.jpg`] = rendered.bytes
          progress(index + 1, pages.length)
        }
        return {
          name: `${name}-jpg.zip`,
          bytes: await zipOutputs(pictures),
          mime: 'application/zip'
        }
      }
      if (id === 'compress') {
        const result = await PDFDocument.create()
        for (const [index, page] of pages.entries()) {
          const rendered = await renderPdfPage(
            pdf,
            page,
            options.compression === 'small' ? 72 : 120,
            signal
          )
          const image = await result.embedJpg(rendered.bytes)
          reserveOutput(rendered.bytes.length)
          result
            .addPage([rendered.width, rendered.height])
            .drawImage(image, { x: 0, y: 0, width: rendered.width, height: rendered.height })
          progress(index + 1, pages.length)
        }
        const bytes = await result.save()
        return {
          name: `${name}-compressed.pdf`,
          bytes: bytes.length < input.bytes.length ? bytes : input.bytes.slice(),
          mime: 'application/pdf'
        }
      }
      let foundText = false
      if (id === 'pdf-word') {
        const { Document, Paragraph, TextRun, ImageRun, Packer } = await import('docx')
        const sections = []
        for (const [index, pageIndex] of pages.entries()) {
          signal?.throwIfAborted()
          const page = await pdf.getPage(pageIndex + 1),
            viewport = page.getViewport({ scale: 1 })
          const children = []
          if (options.officeMode === 'appearance') {
            const rendered = await renderPdfPage(pdf, pageIndex, options.dpi, signal)
            reserveOutput(rendered.bytes.length)
            const fit = Math.min(
              (viewport.width - 24) / viewport.width,
              (viewport.height - 48) / viewport.height,
              1
            )
            const imageWidth = (viewport.width * fit * 96) / 72
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    type: 'jpg',
                    data: rendered.bytes,
                    transformation: {
                      width: imageWidth,
                      height: (imageWidth * viewport.height) / viewport.width
                    }
                  })
                ]
              })
            )
          } else {
            const rows = textRows(await pageText(pdf, pageIndex))
            reserveOutput(rows.flat().reduce((size, cell) => size + cell.text.length * 4, 0))
            foundText ||= rows.length > 0
            children.push(
              ...rows.map(
                (row) =>
                  new Paragraph({
                    bidirectional: row.some((cell) => /[\u0600-\u06ff]/.test(cell.text)),
                    children: [new TextRun(row.map((cell) => cell.text).join(' '))]
                  })
              )
            )
          }
          sections.push({
            properties: {
              page: {
                size: {
                  width: Math.round(viewport.width * 20),
                  height: Math.round(viewport.height * 20)
                },
                margin: { top: 240, bottom: 240, left: 240, right: 240 }
              }
            },
            children
          })
          progress(index + 1, pages.length)
        }
        if (options.officeMode === 'text' && !foundText)
          throw new Error(
            'No selectable text was found. Use Preserve appearance for scanned pages.'
          )
        const blob = await Packer.toBlob(new Document({ sections }))
        return {
          name: `${name}.docx`,
          bytes: new Uint8Array(await blob.arrayBuffer()),
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
      }
      if (id === 'pdf-powerpoint') {
        const { default: PptxGenJS } = await import('pptxgenjs')
        const presentation = new PptxGenJS()
        presentation.author = 'My Printer App'
        for (const [index, pageIndex] of pages.entries()) {
          signal?.throwIfAborted()
          const page = await pdf.getPage(pageIndex + 1),
            viewport = page.getViewport({ scale: 1 })
          // Presentations have a single canvas size; mixed-size pages are fitted, never stretched.
          if (index === 0) {
            presentation.defineLayout({
              name: 'PDF',
              width: viewport.width / 72,
              height: viewport.height / 72
            })
            presentation.layout = 'PDF'
          }
          const first = await pdf.getPage(pages[0] + 1),
            canvas = first.getViewport({ scale: 1 })
          const scale = Math.min(canvas.width / viewport.width, canvas.height / viewport.height)
          const x = (canvas.width - viewport.width * scale) / 144,
            y = (canvas.height - viewport.height * scale) / 144
          const slide = presentation.addSlide()
          if (options.officeMode === 'appearance') {
            const rendered = await renderPdfPage(pdf, pageIndex, options.dpi, signal)
            reserveOutput(rendered.bytes.length)
            const data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(String(reader.result))
              reader.onerror = reject
              reader.readAsDataURL(
                new Blob([new Uint8Array(rendered.bytes)], { type: 'image/jpeg' })
              )
            })
            slide.addImage({
              data,
              x,
              y,
              w: (viewport.width * scale) / 72,
              h: (viewport.height * scale) / 72
            })
          } else {
            const cells = await pageText(pdf, pageIndex)
            reserveOutput(cells.reduce((size, cell) => size + cell.text.length * 4, 0))
            foundText ||= cells.length > 0
            cells.forEach((cell) =>
              slide.addText(cell.text, {
                x: x + (cell.x * scale) / 72,
                y: y + ((cell.y - cell.height) * scale) / 72,
                w: (Math.max(cell.width, 12) * scale) / 72 + 0.1,
                h: (cell.height * scale) / 72 + 0.1,
                fontSize: cell.height * scale,
                margin: 0,
                breakLine: false
              })
            )
          }
          progress(index + 1, pages.length)
        }
        if (options.officeMode === 'text' && !foundText)
          throw new Error(
            'No selectable text was found. Use Preserve appearance for scanned pages.'
          )
        const bytes = (await presentation.write({ outputType: 'arraybuffer' })) as ArrayBuffer
        return {
          name: `${name}.pptx`,
          bytes: new Uint8Array(bytes),
          mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        }
      }
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      for (const [index, pageIndex] of pages.entries()) {
        signal?.throwIfAborted()
        const rows = textRows(await pageText(pdf, pageIndex))
        reserveOutput(rows.flat().reduce((size, cell) => size + cell.text.length * 4, 0))
        foundText ||= rows.length > 0
        const worksheet = workbook.addWorksheet(`Page ${pageIndex + 1}`)
        // Cluster x positions across the whole page, keeping missing cells in their columns.
        const columns: number[] = []
        rows
          .flat()
          .sort((a, b) => a.x - b.x)
          .forEach((cell) => {
            if (!columns.some((x) => Math.abs(x - cell.x) < 12)) columns.push(cell.x)
          })
        for (const row of rows) {
          const values: string[] = []
          for (const cell of row) {
            const column = columns.reduce(
              (best, x, i) => (Math.abs(x - cell.x) < Math.abs(columns[best] - cell.x) ? i : best),
              0
            )
            values[column] = [values[column], cell.text].filter(Boolean).join(' ')
          }
          // Strings stay strings: extracted customer data must never become formulas.
          worksheet.addRow(values)
        }
        worksheet.columns?.forEach((column) => {
          column.width = 24
        })
        worksheet.views = [{ state: 'frozen', ySplit: 1 }]
        progress(index + 1, pages.length)
      }
      if (!foundText)
        throw new Error(
          'No selectable text was found. Scanned pages need OCR before Excel conversion.'
        )
      return {
        name: `${name}.xlsx`,
        bytes: new Uint8Array(await workbook.xlsx.writeBuffer()),
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    },
    signal
  )
}

export async function runPdfTool(
  id: PdfToolId,
  inputs: PdfInput[],
  options: PdfOptions,
  progress: PdfProgress,
  signal?: AbortSignal
): Promise<PdfOutput> {
  if (!inputs.length) throw new Error('Import a file to continue.')
  const name = fileStem(inputs[0].name)
  if (id === 'merge')
    return {
      name: `${name}-merged.pdf`,
      bytes: await runPdfWorker(
        { operation: 'merge', inputs: inputs.map(({ bytes }) => ({ bytes })) },
        signal,
        progress
      ),
      mime: 'application/pdf'
    }
  if (id === 'split') {
    const parts = await runPdfWorker(
      {
        operation: 'split',
        bytes: inputs[0].bytes,
        ranges: options.ranges,
        every: options.splitMode === 'every',
        maxOutputBytes: getPdfMemoryPolicy().maxOutputBytes
      },
      signal,
      progress
    )
    progress(parts.length, parts.length)
    if (parts.length === 1)
      return { name: `${name}-split.pdf`, bytes: parts[0], mime: 'application/pdf' }
    return {
      name: `${name}-split.zip`,
      bytes: await zipOutputs(
        Object.fromEntries(
          parts.map((bytes, i) => [`${name}-${String(i + 1).padStart(3, '0')}.pdf`, bytes])
        )
      ),
      mime: 'application/zip'
    }
  }
  if (id === 'compress' && options.compression === 'lossless')
    return {
      name: `${name}-compressed.pdf`,
      bytes: await runPdfWorker({ operation: 'optimize', bytes: inputs[0].bytes }, signal),
      mime: 'application/pdf'
    }
  if (id === 'jpg-pdf')
    return {
      name: `${name}.pdf`,
      bytes: await imagesToPdf(inputs, options, progress, signal),
      mime: 'application/pdf'
    }
  return convertFromPdf(id, inputs[0], options, progress, signal)
}
