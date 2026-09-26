import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { getPerformanceSettingsSnapshot } from '../../../performance/performanceSettings'
import { getLargeProjectWarning as getSharedLargeProjectWarning } from '../../../performance/renderQuality'
import {
  assertCanvasWithinLimit,
  assertNotCanceled,
  resetCanvas
} from '../../booklet-montage/lib/memoryCleanup'
import { canvasToThumbnailBlob } from '../../booklet-montage/lib/thumbnailCache'
import { yieldAfterChunk } from '../../booklet-montage/lib/renderQueue'
import type {
  PdfPageBox,
  PdfPageBoxSummary,
  PdfPageProductionMetadata,
  PdfPhysicalSize,
  PdfProductionColorant,
  PdfProductionLayer,
  PdfProductionMetadata,
  PieceSourceFile
} from '../types'
import { createCutterId } from './nesting'
import { blobToDataUrl, getPdfPageFileName, hasPdfSignature, isPdfFile } from './sourcePreview'

export { parsePdfPageRange } from './pdfPageRange'

export const CUTTER_PDF_INITIAL_PAGE_LIMIT = 10
export const CUTTER_PDF_PAGE_BATCH_SIZE = 10

export interface CutterPdfPagePreview {
  pageNumber: number
  thumbnailUrl: string
  previewDataUrl: string
  naturalWidthPx: number
  naturalHeightPx: number
  productionMetadata?: PdfPageProductionMetadata
}

export interface CutterPdfImportSession {
  id: string
  fileName: string
  bytes: Uint8Array
  pageCount: number
  pages: CutterPdfPagePreview[]
  loadedPageCount: number
  productionMetadata: PdfProductionMetadata
  warning?: string
}

export async function loadCutterPdfImportSession(
  file: File,
  signal?: AbortSignal
): Promise<CutterPdfImportSession> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  if (!hasPdfSignature(bytes) && !isPdfFile(file)) {
    throw new Error(`${file.name} is not a PDF or PDF-compatible Illustrator file.`)
  }

  let pdf: PDFDocumentProxy | undefined

  try {
    assertNotCanceled(signal)
    const { loadPdfDocument } = await import('../../booklet-montage/lib/pdfWorker')
    pdf = await loadPdfDocument(bytes, signal)
    const pageCount = pdf.numPages
    const productionMetadata = await loadPdfProductionMetadata(bytes, file.name, pageCount, pdf)
    const pageNumbers = createPageRange(1, Math.min(pageCount, CUTTER_PDF_INITIAL_PAGE_LIMIT))
    const pages = await renderCutterPdfPagePreviews(
      file.name,
      pdf,
      pageNumbers,
      productionMetadata.pages ?? [],
      signal
    )
    const firstPageMetadata = pages[0]?.productionMetadata

    return {
      id: createCutterId('pdf'),
      fileName: file.name,
      bytes,
      pageCount,
      pages,
      loadedPageCount: pages.length,
      productionMetadata: {
        ...productionMetadata,
        pageCount,
        pageSizeMm: firstPageMetadata?.physicalSizeMm ?? productionMetadata.pageSizeMm,
        pageBoxes: firstPageMetadata?.boxes ?? productionMetadata.pageBoxes
      },
      warning: getLargePdfWarning(file.size, pageCount)
    }
  } catch (error) {
    const { normalizePdfError } = await import('../../booklet-montage/lib/pdfWorker')
    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

export async function loadMoreCutterPdfPagePreviews(
  session: CutterPdfImportSession,
  signal?: AbortSignal
): Promise<CutterPdfImportSession> {
  const nextStart = session.loadedPageCount + 1

  if (nextStart > session.pageCount) {
    return session
  }

  const nextEnd = Math.min(session.pageCount, nextStart + CUTTER_PDF_PAGE_BATCH_SIZE - 1)

  return ensureCutterPdfPagePreviews(session, createPageRange(nextStart, nextEnd), signal)
}

export async function createCutterPdfPageSources(
  session: CutterPdfImportSession,
  pageNumbers: number[],
  signal?: AbortSignal
): Promise<{ session: CutterPdfImportSession; sources: PieceSourceFile[] }> {
  const selectedPages = normalizePageNumbers(pageNumbers, session.pageCount)

  if (selectedPages.length === 0) {
    throw new Error('Select at least one PDF page to import.')
  }

  const updatedSession = await ensureCutterPdfPagePreviews(session, selectedPages, signal)
  const previewByPage = new Map(updatedSession.pages.map((page) => [page.pageNumber, page]))
  const sources = selectedPages.map((pageNumber) => {
    const preview = previewByPage.get(pageNumber)

    if (!preview) {
      throw new Error(`Could not prepare page ${pageNumber} for import.`)
    }

    return {
      id: createCutterId('source'),
      sourceKind: 'pdf-page' as const,
      fileName: getPdfPageFileName(session.fileName, pageNumber),
      displayName: getPdfPageFileName(session.fileName, pageNumber).replace(/\.[^.]+$/, ''),
      originalFileName: session.fileName,
      mimeType: 'application/pdf',
      bytes: session.bytes,
      previewUrl: preview.previewDataUrl,
      previewDataUrl: preview.previewDataUrl,
      pdfPageNumber: pageNumber,
      pageCount: session.pageCount,
      pdfProductionMetadata: session.productionMetadata,
      pdfPageMetadata: preview.productionMetadata,
      naturalWidthPx: preview.naturalWidthPx,
      naturalHeightPx: preview.naturalHeightPx
    }
  })

  return { session: updatedSession, sources }
}

export function releaseCutterPdfImportSession(session: CutterPdfImportSession | null): void {
  if (!session) return

  for (const page of session.pages) {
    URL.revokeObjectURL(page.thumbnailUrl)
  }
}

async function ensureCutterPdfPagePreviews(
  session: CutterPdfImportSession,
  pageNumbers: number[],
  signal?: AbortSignal
): Promise<CutterPdfImportSession> {
  const neededPages = normalizePageNumbers(pageNumbers, session.pageCount).filter(
    (pageNumber) => !session.pages.some((page) => page.pageNumber === pageNumber)
  )

  if (neededPages.length === 0) {
    return session
  }

  let pdf: PDFDocumentProxy | undefined

  try {
    const { loadPdfDocument } = await import('../../booklet-montage/lib/pdfWorker')
    pdf = await loadPdfDocument(session.bytes, signal)
    const nextPages = await renderCutterPdfPagePreviews(
      session.fileName,
      pdf,
      neededPages,
      session.productionMetadata.pages ?? [],
      signal
    )
    const mergedPages = [...session.pages, ...nextPages].sort(
      (first, second) => first.pageNumber - second.pageNumber
    )

    return {
      ...session,
      pages: mergedPages,
      loadedPageCount: Math.max(session.loadedPageCount, highestContiguousPage(mergedPages))
    }
  } catch (error) {
    const { normalizePdfError } = await import('../../booklet-montage/lib/pdfWorker')
    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

async function renderCutterPdfPagePreviews(
  fileName: string,
  pdf: PDFDocumentProxy,
  pageNumbers: number[],
  productionPages: PdfPageProductionMetadata[],
  signal?: AbortSignal
): Promise<CutterPdfPagePreview[]> {
  const pages: CutterPdfPagePreview[] = []
  const settings = getPerformanceSettingsSnapshot()
  const maxWidth = settings.render.thumbnailMaxSizePx
  const maxHeight = Math.round(maxWidth * 1.45)
  const quality = settings.render.thumbnailJpegQuality
  const batchSize = settings.render.pdfImportBatchSize

  for (let index = 0; index < pageNumbers.length; index += 1) {
    const pageNumber = pageNumbers[index]
    assertNotCanceled(signal)

    const page = await pdf.getPage(pageNumber)

    try {
      pages.push(
        await renderCutterPdfPagePreview(fileName, page, pageNumber, {
          maxWidth,
          maxHeight,
          quality,
          productionMetadata: productionPages.find((entry) => entry.pageNumber === pageNumber),
          signal
        })
      )
    } finally {
      page.cleanup()
    }

    await yieldAfterChunk(index + 1, batchSize)
  }

  return pages
}

async function renderCutterPdfPagePreview(
  fileName: string,
  page: PDFPageProxy,
  pageNumber: number,
  options: {
    maxWidth: number
    maxHeight: number
    quality: number
    productionMetadata?: PdfPageProductionMetadata
    signal?: AbortSignal
  }
): Promise<CutterPdfPagePreview> {
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = Math.min(
    options.maxWidth / baseViewport.width,
    options.maxHeight / baseViewport.height,
    1
  )
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not create a canvas context for PDF page thumbnails.')
  }

  canvas.width = Math.max(Math.floor(viewport.width), 1)
  canvas.height = Math.max(Math.floor(viewport.height), 1)
  assertCanvasWithinLimit(canvas.width, canvas.height, 'rendering cutter PDF page thumbnails')

  const renderTask = page.render({ canvas, canvasContext: context, viewport })
  const abort = () => renderTask.cancel()

  options.signal?.addEventListener('abort', abort, { once: true })

  try {
    await renderTask.promise
    assertNotCanceled(options.signal)

    const blob = await canvasToThumbnailBlob(canvas, 'image/jpeg', options.quality)

    return {
      pageNumber,
      thumbnailUrl: URL.createObjectURL(blob),
      previewDataUrl: await blobToDataUrl(blob),
      naturalWidthPx: Math.max(Math.round(baseViewport.width), 1),
      naturalHeightPx: Math.max(Math.round(baseViewport.height), 1),
      productionMetadata: options.productionMetadata ?? {
        pageNumber,
        physicalSizeMm: pdfPageViewToPhysicalSize(page.view)
      }
    }
  } finally {
    options.signal?.removeEventListener('abort', abort)
    resetCanvas(canvas)
  }
}

const PDF_POINT_TO_MM = 25.4 / 72
const MAX_METADATA_SCAN_BYTES = 32 * 1024 * 1024

/**
 * Inspect only PDF dictionaries and names. This deliberately does not turn
 * optional-content layers or spot colors into editor objects: the original
 * source remains the production authority and the app only reports what it
 * can safely identify.
 */
export function inspectPdfProductionMetadata(
  bytes: Uint8Array,
  fileName: string,
  pageCount?: number
): PdfProductionMetadata {
  const { text, sampled } = getMetadataScanText(bytes)
  const sanitizedText = stripPdfStreams(text)
  const objects = extractPdfObjects(sanitizedText)
  const pages = extractPdfPageBoxes(objects)
  const layers = extractPdfLayers(sanitizedText, objects)
  const colorants = extractPdfColorants(sanitizedText)
  const sourceFormat =
    hasPdfSignature(bytes) && /\.ai$/i.test(fileName) ? 'pdf-compatible-ai' : 'pdf'
  const classification = classifyPdfProductionStructure(layers, colorants)
  const warnings = createPdfProductionWarnings(layers, colorants, classification)
  const notes = [
    'Original PDF/AI bytes are preserved. Page previews are raster thumbnails for safe page selection.',
    'Hidden layers and Separation/DeviceN colors are informational only; they are not editable CutContour objects.'
  ]

  if (sourceFormat === 'pdf-compatible-ai') {
    notes.unshift(
      'PDF-compatible Illustrator file detected from its %PDF signature; the .ai extension is preserved.'
    )
  }

  if (sampled) {
    notes.push(
      'This large file was sampled at its beginning and end for metadata. Compressed or object-stream content may not be fully listed.'
    )
  }

  if (pages.length === 0) {
    notes.push(
      'Page box dictionaries were not available to the lightweight inspector; PDF.js page size is used for previews.'
    )
  }

  const firstPage = pages[0]
  const firstPhysicalSize = getPhysicalSizeFromBoxes(firstPage)

  return {
    sourceFormat,
    classification,
    pageCount,
    pageSizeMm: firstPhysicalSize,
    pageBoxes: firstPage,
    pages: pages.map((boxes, index) => ({
      pageNumber: index + 1,
      physicalSizeMm: getPhysicalSizeFromBoxes(boxes),
      boxes
    })),
    layers,
    colorants,
    warnings,
    notes
  }
}

/** Useful for parser tests and diagnostics without loading PDF.js. */
export function parsePdfPageBoxSummaries(bytes: Uint8Array): PdfPageBoxSummary[] {
  const { text } = getMetadataScanText(bytes)
  return extractPdfPageBoxes(extractPdfObjects(stripPdfStreams(text)))
}

async function loadPdfProductionMetadata(
  bytes: Uint8Array,
  fileName: string,
  pageCount: number,
  pdf: PDFDocumentProxy
): Promise<PdfProductionMetadata> {
  const metadata = inspectPdfProductionMetadata(bytes, fileName, pageCount)

  try {
    const documentMetadata = await pdf.getMetadata()
    const info = documentMetadata.info as Record<string, unknown>
    const creator = typeof info.Creator === 'string' ? info.Creator.trim() : ''

    if (creator) metadata.creator = creator
  } catch {
    metadata.notes.push('Document authoring metadata was unavailable.')
  }

  if (metadata.layers.length === 0) {
    try {
      const optionalContentConfig = await pdf.getOptionalContentConfig({ intent: 'display' })
      const fallbackLayers: PdfProductionLayer[] = [...optionalContentConfig].map(([id, group]) => {
        const record = group as { name?: unknown; intent?: unknown }
        const intent = Array.isArray(record.intent)
          ? record.intent.filter((value): value is string => typeof value === 'string')
          : undefined

        return {
          id: String(id),
          name: typeof record.name === 'string' ? record.name : String(id),
          defaultVisible: Boolean(optionalContentConfig.isVisible(id)),
          intent
        }
      })

      if (fallbackLayers.length > 0) {
        metadata.layers = fallbackLayers
        metadata.notes.push(
          'Layer visibility came from PDF.js because the lightweight dictionary scan found no OCG names.'
        )
      }
    } catch {
      metadata.notes.push('Optional-content layer information could not be read safely.')
    }
  }

  return metadata
}

function getMetadataScanText(bytes: Uint8Array): { text: string; sampled: boolean } {
  const decoder = new TextDecoder('latin1')

  if (bytes.length <= MAX_METADATA_SCAN_BYTES) {
    return { text: decoder.decode(bytes), sampled: false }
  }

  const half = Math.floor(MAX_METADATA_SCAN_BYTES / 2)
  return {
    text: `${decoder.decode(bytes.slice(0, half))}\n${decoder.decode(bytes.slice(-half))}`,
    sampled: true
  }
}

function stripPdfStreams(text: string): string {
  return text.replace(/stream(?:\r\n|\n|\r)[\s\S]*?endstream/g, 'stream endstream')
}

interface RawPdfObject {
  key: string
  body: string
  index: number
}

function extractPdfObjects(text: string): RawPdfObject[] {
  const objects: RawPdfObject[] = []
  const objectPattern = /(\d+)\s+(\d+)\s+obj\b/g
  let match: RegExpExecArray | null

  while ((match = objectPattern.exec(text))) {
    const endIndex = text.indexOf('endobj', objectPattern.lastIndex)
    if (endIndex < 0) break

    objects.push({
      key: `${match[1]} ${match[2]}`,
      body: text.slice(objectPattern.lastIndex, endIndex),
      index: match.index
    })
    objectPattern.lastIndex = endIndex + 'endobj'.length
  }

  return objects
}

function extractPdfPageBoxes(objects: RawPdfObject[]): PdfPageBoxSummary[] {
  const objectByKey = new Map(objects.map((object) => [object.key, object]))
  const pageObjects = objects.filter((object) => /\/Type\s*\/Page(?:\s|\/|>)/i.test(object.body))

  return pageObjects.map((pageObject) => {
    const boxNames: Array<[keyof PdfPageBoxSummary, string]> = [
      ['media', 'MediaBox'],
      ['crop', 'CropBox'],
      ['trim', 'TrimBox'],
      ['bleed', 'BleedBox'],
      ['art', 'ArtBox']
    ]
    const summary: PdfPageBoxSummary = {}
    const resolved = new Set<string>()

    for (const [property, boxName] of boxNames) {
      const box = resolvePdfBox(pageObject.body, boxName, objectByKey, resolved)
      if (box) summary[property] = box
    }

    return summary
  })
}

function resolvePdfBox(
  body: string,
  boxName: string,
  objectByKey: Map<string, RawPdfObject>,
  resolved: Set<string>
): PdfPageBox | undefined {
  const pattern = new RegExp(`/${boxName}\\s*(?:\\[([^\\]]+)\\]|(\\d+)\\s+(\\d+)\\s+R)`, 'i')
  const match = pattern.exec(body)

  if (!match) {
    const parentMatch = /\/Parent\s+(\d+)\s+(\d+)\s+R/i.exec(body)
    if (!parentMatch) return undefined

    const parentKey = `${parentMatch[1]} ${parentMatch[2]}`
    if (resolved.has(parentKey)) return undefined
    const parent = objectByKey.get(parentKey)
    if (!parent) return undefined
    resolved.add(parentKey)
    return resolvePdfBox(parent.body, boxName, objectByKey, resolved)
  }

  if (match[1]) return parsePdfBoxNumbers(match[1])

  const referenced = objectByKey.get(`${match[2]} ${match[3]}`)
  return referenced ? parsePdfBoxNumbers(referenced.body) : undefined
}

function parsePdfBoxNumbers(value: string): PdfPageBox | undefined {
  const numbers = value.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)?.map(Number)
  if (
    !numbers ||
    numbers.length < 4 ||
    numbers.slice(0, 4).some((number) => !Number.isFinite(number))
  ) {
    return undefined
  }

  const [firstX, firstY, secondX, secondY] = numbers
  const xPt = Math.min(firstX, secondX)
  const yPt = Math.min(firstY, secondY)
  const widthPt = Math.abs(secondX - firstX)
  const heightPt = Math.abs(secondY - firstY)

  return {
    xPt,
    yPt,
    widthPt,
    heightPt,
    widthMm: widthPt * PDF_POINT_TO_MM,
    heightMm: heightPt * PDF_POINT_TO_MM
  }
}

function extractPdfLayers(text: string, objects: RawPdfObject[]): PdfProductionLayer[] {
  const off = new Set(extractPdfReferences(text, /\/OFF\s*\[([^\]]*)\]/i))
  const on = new Set(extractPdfReferences(text, /\/ON\s*\[([^\]]*)\]/i))
  const layers: PdfProductionLayer[] = []

  for (const object of objects) {
    if (!/\/Type\s*\/OCG(?:\s|\/|>)/i.test(object.body)) continue

    const nameMatch = /\/Name\s*(\((?:\\.|[^)])*\))/is.exec(object.body)
    const name = nameMatch ? decodePdfLiteralString(nameMatch[1]) : object.key
    const intentMatch = /\/Intent\s*(\[([^\]]*)\]|\/([^\s/<>()[\]]+))/is.exec(object.body)
    const intent = intentMatch
      ? decodePdfNameTokens(intentMatch[2] ?? intentMatch[3] ?? '')
      : undefined

    layers.push({
      id: `${object.key.replace(' ', ':')}`,
      name,
      defaultVisible: off.has(object.key) ? false : on.size === 0 || on.has(object.key),
      intent: intent?.length ? intent : undefined
    })
  }

  return layers
}

function extractPdfReferences(text: string, pattern: RegExp): string[] {
  const match = pattern.exec(text)
  if (!match) return []

  const references: string[] = []
  for (const reference of match[1].matchAll(/(\d+)\s+(\d+)\s+R/g)) {
    references.push(`${reference[1]} ${reference[2]}`)
  }
  return references
}

function decodePdfLiteralString(value: string): string {
  const inner = value.startsWith('(') && value.endsWith(')') ? value.slice(1, -1) : value
  return inner
    .replace(/\\([nrtbf()\\])/g, (_match, escaped: string) => {
      const replacements: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        '(': '(',
        ')': ')',
        '\\': '\\'
      }
      return replacements[escaped] ?? escaped
    })
    .replace(/#([0-9a-f]{2})/gi, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .trim()
}

function decodePdfNameTokens(value: string): string[] {
  return [...value.matchAll(/\/([^\s/<>()[\]]+)/g)].map((match) =>
    match[1].replace(/#([0-9a-f]{2})/gi, (_full, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
  )
}

function extractPdfColorants(text: string): PdfProductionColorant[] {
  const colorants: PdfProductionColorant[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(/\/Separation\s*\/([^\s/<>()[\]]+)/gi)) {
    addPdfColorant(colorants, seen, 'Separation', decodePdfName(match[1]))
  }

  for (const match of text.matchAll(/\/DeviceN\s*\[([^\]]*)\]/gi)) {
    for (const name of decodePdfNameTokens(match[1])) {
      addPdfColorant(colorants, seen, 'DeviceN', name)
    }
  }

  return colorants
}

function addPdfColorant(
  colorants: PdfProductionColorant[],
  seen: Set<string>,
  kind: PdfProductionColorant['kind'],
  name: string
): void {
  const normalizedName = name.trim()
  if (!normalizedName || /^(DeviceCMYK|DeviceRGB|DeviceGray)$/i.test(normalizedName)) return

  const key = `${kind}:${normalizedName.toLowerCase()}`
  if (seen.has(key)) return
  seen.add(key)
  colorants.push({ kind, name: normalizedName })
}

function decodePdfName(value: string): string {
  return value.replace(/#([0-9a-f]{2})/gi, (_full, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  )
}

function classifyPdfProductionStructure(
  layers: PdfProductionLayer[],
  colorants: PdfProductionColorant[]
): PdfProductionMetadata['classification'] {
  const productionLayer = layers.some((layer) =>
    /cut|contour|finecut|register\s*mark|registration|calque\s*2/i.test(layer.name)
  )
  const productionColorant = colorants.some((colorant) =>
    /cut|contour|mimaki|fcrm|registration/i.test(colorant.name)
  )

  if (!productionLayer && colorants.length === 0) {
    return layers.some((layer) => !layer.defaultVisible) ? 'ambiguous' : 'artwork-only'
  }

  return productionLayer || productionColorant ? 'likely-print-and-cut' : 'ambiguous'
}

function createPdfProductionWarnings(
  layers: PdfProductionLayer[],
  colorants: PdfProductionColorant[],
  classification: PdfProductionMetadata['classification']
): string[] {
  const warnings: string[] = []
  const hiddenCalqueTwo = layers.some(
    (layer) => !layer.defaultVisible && /^calque\s*2$/i.test(layer.name.trim())
  )
  const mimakiRegistration = colorants.some((colorant) => /mimakifcrm/i.test(colorant.name))

  if (hiddenCalqueTwo) {
    warnings.push(
      'Hidden “Calque 2” is preserved for inspection. It is not automatically converted into an editable CutContour.'
    )
  }

  if (mimakiRegistration) {
    warnings.push(
      'MimakiFCRM/MimakiFCRMDir separations look like FineCut registration marks. They are not automatically treated as editable CutContour.'
    )
  }

  if (classification === 'likely-print-and-cut') {
    warnings.push(
      'This file has production-like layers or spot names, but the app cannot prove which geometry is the sticker cut path. Review and create the editable CutContour explicitly.'
    )
  } else if (classification === 'ambiguous') {
    warnings.push(
      'The file contains optional layers or spot colors, but its print/cut purpose is ambiguous. No hidden content is imported as a cutline.'
    )
  } else {
    warnings.push(
      'No production cut layer or Separation/DeviceN marker was detected; this is treated as artwork-only.'
    )
  }

  return warnings
}

function getPhysicalSizeFromBoxes(
  boxes: PdfPageBoxSummary | undefined
): PdfPhysicalSize | undefined {
  const box = boxes?.media ?? boxes?.crop ?? boxes?.trim ?? boxes?.bleed ?? boxes?.art
  return box ? { widthMm: box.widthMm, heightMm: box.heightMm } : undefined
}

function pdfPageViewToPhysicalSize(view: number[]): PdfPhysicalSize | undefined {
  if (view.length < 4) return undefined
  const widthPt = Math.abs(view[2] - view[0])
  const heightPt = Math.abs(view[3] - view[1])
  return {
    widthMm: widthPt * PDF_POINT_TO_MM,
    heightMm: heightPt * PDF_POINT_TO_MM
  }
}

function getLargePdfWarning(fileSize: number, pageCount: number): string | undefined {
  return (
    getSharedLargeProjectWarning({ pageCount, totalBytes: fileSize }) ??
    (pageCount > CUTTER_PDF_INITIAL_PAGE_LIMIT
      ? `Only the first ${CUTTER_PDF_INITIAL_PAGE_LIMIT} page thumbnails are loaded at first.`
      : undefined)
  )
}

function createPageRange(start: number, end: number): number[] {
  const pages: number[] = []

  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  return pages
}

function normalizePageNumbers(pageNumbers: number[], pageCount: number): number[] {
  const pages = new Set<number>()

  for (const pageNumber of pageNumbers) {
    assertPageNumber(pageNumber, pageCount)
    pages.add(pageNumber)
  }

  return [...pages].sort((first, second) => first - second)
}

function assertPageNumber(pageNumber: number, pageCount: number): void {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
    throw new Error(`Choose pages between 1 and ${pageCount}.`)
  }
}

function highestContiguousPage(pages: CutterPdfPagePreview[]): number {
  const loaded = new Set(pages.map((page) => page.pageNumber))
  let page = 1

  while (loaded.has(page)) {
    page += 1
  }

  return page - 1
}
