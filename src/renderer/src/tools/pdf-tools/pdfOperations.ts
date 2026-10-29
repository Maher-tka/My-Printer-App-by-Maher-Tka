import { PDFDocument, degrees } from 'pdf-lib'
import { parsePageGroups, type PdfInput } from './model'

export async function mergePdfs(
  inputs: Pick<PdfInput, 'bytes'>[],
  signal?: AbortSignal,
  progress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  if (inputs.length < 2) throw new Error('Add at least two PDF files to merge.')
  const result = await PDFDocument.create()
  for (const [index, input] of inputs.entries()) {
    signal?.throwIfAborted()
    const document = await PDFDocument.load(input.bytes)
    const indices = document.getPageIndices()
    for (let start = 0; start < indices.length; start += 32) {
      signal?.throwIfAborted()
      const pages = await result.copyPages(document, indices.slice(start, start + 32))
      pages.forEach((page) => result.addPage(page))
    }
    progress?.(index + 1, inputs.length)
  }
  return result.save()
}

export async function splitPdf(
  bytes: Uint8Array,
  ranges: string,
  every = false,
  signal?: AbortSignal,
  progress?: (current: number, total: number) => void,
  maxOutputBytes = Infinity
): Promise<Uint8Array[]> {
  const document = await PDFDocument.load(bytes)
  const groups = every
    ? document.getPageIndices().map((page) => [page])
    : parsePageGroups(ranges, document.getPageCount())
  const outputs: Uint8Array[] = []
  let outputBytes = 0
  for (const group of groups) {
    signal?.throwIfAborted()
    const result = await PDFDocument.create()
    ;(await result.copyPages(document, group)).forEach((page) => result.addPage(page))
    const bytes = await result.save()
    outputBytes += bytes.length
    if (outputBytes > maxOutputBytes)
      throw new Error(
        'The output exceeds the current memory budget. Select fewer pages or reduce the resolution.'
      )
    outputs.push(bytes)
    progress?.(outputs.length, groups.length)
  }
  return outputs
}

export async function optimizePdf(bytes: Uint8Array): Promise<Uint8Array> {
  const document = await PDFDocument.load(bytes)
  const optimized = await document.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false
  })
  return optimized.length < bytes.length ? optimized : bytes.slice()
}

export interface PageOverlay {
  page: number
  png: Uint8Array
}
export async function overlayPdf(bytes: Uint8Array, overlays: PageOverlay[]): Promise<Uint8Array> {
  const document = await PDFDocument.load(bytes)
  for (const overlay of overlays) {
    const page = document.getPage(overlay.page)
    const image = await document.embedPng(overlay.png)
    const { width, height } = page.getSize()
    const rotation = ((page.getRotation().angle % 360) + 360) % 360
    const crop = page.getCropBox()
    const options =
      rotation === 90
        ? { x: crop.x + crop.width, y: crop.y, width: crop.height, height: crop.width }
        : rotation === 180
          ? {
              x: crop.x + crop.width,
              y: crop.y + crop.height,
              width: crop.width,
              height: crop.height
            }
          : rotation === 270
            ? { x: crop.x, y: crop.y + crop.height, width: crop.height, height: crop.width }
            : { x: crop.x, y: crop.y, width: crop.width || width, height: crop.height || height }
    page.drawImage(image, { ...options, rotate: degrees(rotation) })
  }
  return document.save()
}
