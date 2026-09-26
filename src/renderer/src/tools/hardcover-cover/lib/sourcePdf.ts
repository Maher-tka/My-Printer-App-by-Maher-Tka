import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import { getPerformanceSettingsSnapshot } from '../../../performance/performanceSettings'
import { assertCanvasWithinLimit, resetCanvas } from '../../booklet-montage/lib/memoryCleanup'
import {
  canvasToThumbnailBlob,
  getOrCreateThumbnailUrl
} from '../../booklet-montage/lib/thumbnailCache'
import type {
  HardcoverPdfCoverSource,
  HardcoverPdfCoverTarget,
  HardcoverPdfPageGeometry,
  HardcoverPdfPagePreview,
  HardcoverPdfRectangle,
  HardcoverPdfSource
} from '../types'
import { isValidHardcoverPageNumber } from './coverCalculations'
import { DEFAULT_PDF_PAGE_POSITION } from './pdfPosition'

type HardcoverPdfPageTarget = 'front' | 'back'
type HardcoverPdfImportTarget = 'single' | HardcoverPdfCoverTarget

interface RuntimeCoverPdf {
  bytes: Uint8Array
}

const INITIAL_PAGE_PREVIEW_LIMIT = 10
export const HARDCOVER_PAGE_PREVIEW_BATCH_SIZE = 10

const runtimeCoverPdfs = new Map<string, RuntimeCoverPdf>()
const importTargets = new WeakMap<File, HardcoverPdfImportTarget>()
let runtimeSourceSequence = 0

export function markHardcoverPdfImportTarget(file: File, target: HardcoverPdfImportTarget): void {
  importTargets.set(file, target)
}

export function consumeHardcoverPdfImportTarget(file: File): HardcoverPdfImportTarget {
  const target = importTargets.get(file) ?? 'single'
  importTargets.delete(file)
  return target
}

export function hasHardcoverPdfCoverSourceBytes(source: HardcoverPdfCoverSource): boolean {
  return runtimeCoverPdfs.has(source.sourceId)
}

/** Runtime-only access for the future independent-source exporter. */
export function getHardcoverPdfCoverSourceBytes(
  source: HardcoverPdfCoverSource
): Uint8Array | undefined {
  return runtimeCoverPdfs.get(source.sourceId)?.bytes
}

export function hasHardcoverPdfSourceBytes(source: HardcoverPdfSource): boolean {
  if (source.sourceMode === 'separate' || source.frontSource || source.backSource) {
    return Boolean(
      source.frontSource &&
      hasHardcoverPdfCoverSourceBytes(source.frontSource) &&
      (!source.backCoverEnabled ||
        (source.backSource && hasHardcoverPdfCoverSourceBytes(source.backSource)))
    )
  }

  return Boolean(source.bytes)
}

export function releaseHardcoverPdfCoverSourceRuntime(source: HardcoverPdfCoverSource): void {
  runtimeCoverPdfs.delete(source.sourceId)
}

export function releaseHardcoverPdfSourceRuntime(source: HardcoverPdfSource | undefined): void {
  if (!source) return
  if (source.frontSource) releaseHardcoverPdfCoverSourceRuntime(source.frontSource)
  if (source.backSource) releaseHardcoverPdfCoverSourceRuntime(source.backSource)
}

export async function importHardcoverPdfSource(file: File): Promise<HardcoverPdfSource> {
  assertPdfFile(file)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const source: HardcoverPdfSource = {
    fileName: file.name,
    filePath: getFilePath(file),
    pageCount: 0,
    frontPageNumber: 1,
    backCoverEnabled: false,
    fitMode: 'fit',
    frontPosition: { ...DEFAULT_PDF_PAGE_POSITION },
    backPosition: { ...DEFAULT_PDF_PAGE_POSITION },
    pagePreviews: [],
    bytes
  }

  let pdf: PDFDocumentProxy | undefined

  try {
    pdf = await loadHardcoverPdfDocument(bytes)
    const pagePreviews = await renderHardcoverPdfPagePreviews(
      file.name,
      pdf,
      1,
      Math.min(INITIAL_PAGE_PREVIEW_LIMIT, pdf.numPages)
    )
    const previewsWithGeometry = await attachPageGeometries(bytes, pagePreviews)
    const firstPage = previewsWithGeometry[0]

    return {
      ...source,
      pageCount: pdf.numPages,
      frontPageRotation: firstPage?.rotation ?? 0,
      thumbnailDataUrl: firstPage?.thumbnailDataUrl,
      frontPageGeometry: firstPage?.geometry,
      pagePreviews: previewsWithGeometry
    }
  } catch (error) {
    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

/**
 * Imports one cover PDF into the independent-source runtime registry. The
 * returned descriptor is safe to put in project state: it contains metadata
 * and previews, but never the original bytes.
 */
export async function importHardcoverPdfCoverSource(file: File): Promise<HardcoverPdfCoverSource> {
  assertPdfFile(file)

  const bytes = new Uint8Array(await file.arrayBuffer())
  let pdf: PDFDocumentProxy | undefined

  try {
    pdf = await loadHardcoverPdfDocument(bytes)
    const pagePreviews = await renderHardcoverPdfPagePreviews(
      file.name,
      pdf,
      1,
      Math.min(INITIAL_PAGE_PREVIEW_LIMIT, pdf.numPages)
    )
    const previewsWithGeometry = await attachPageGeometries(bytes, pagePreviews)
    const firstPage = previewsWithGeometry[0]
    const sourceId = createRuntimeSourceId(file.name)
    runtimeCoverPdfs.set(sourceId, { bytes })

    return {
      sourceId,
      fileName: file.name,
      filePath: getFilePath(file),
      pageCount: pdf.numPages,
      pageNumber: 1,
      rotation: firstPage?.rotation ?? 0,
      fitMode: 'fit',
      position: { ...DEFAULT_PDF_PAGE_POSITION },
      thumbnailDataUrl: firstPage?.thumbnailDataUrl,
      pagePreviews: previewsWithGeometry,
      pageGeometry: firstPage?.geometry
    }
  } catch (error) {
    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

export function createHardcoverSeparatePdfSource(
  frontSource: HardcoverPdfCoverSource | undefined,
  backSource: HardcoverPdfCoverSource | undefined
): HardcoverPdfSource {
  const primary = frontSource ?? backSource

  if (!primary) {
    throw new Error('At least one independent front or back PDF source is required.')
  }

  return {
    sourceMode: 'separate',
    fileName: primary.fileName,
    filePath: primary.filePath,
    pageCount: primary.pageCount,
    frontPageNumber: frontSource?.pageNumber ?? 1,
    backPageNumber: backSource?.pageNumber,
    backCoverEnabled: Boolean(backSource),
    frontPageRotation: frontSource?.rotation,
    backPageRotation: backSource?.rotation,
    fitMode: frontSource?.fitMode ?? 'fit',
    thumbnailDataUrl: frontSource?.thumbnailDataUrl,
    backThumbnailDataUrl: backSource?.thumbnailDataUrl,
    frontPageGeometry: frontSource?.pageGeometry,
    backPageGeometry: backSource?.pageGeometry,
    pagePreviews: frontSource?.pagePreviews,
    frontSource,
    backSource
  }
}

export function updateHardcoverSeparatePdfSource(
  source: HardcoverPdfSource | undefined,
  target: HardcoverPdfCoverTarget,
  coverSource: HardcoverPdfCoverSource
): HardcoverPdfSource {
  const currentFront =
    source?.sourceMode === 'separate' || source?.frontSource ? source.frontSource : undefined
  const currentBack =
    source?.sourceMode === 'separate' || source?.backSource ? source.backSource : undefined

  const next = createHardcoverSeparatePdfSource(
    target === 'front' ? coverSource : currentFront,
    target === 'back' ? coverSource : currentBack
  )

  if (target === 'front' && source?.sourceMode === 'separate' && !source.backCoverEnabled) {
    return {
      ...next,
      backCoverEnabled: false,
      backPageNumber: undefined,
      backPageRotation: undefined,
      backThumbnailDataUrl: undefined,
      backPageGeometry: undefined
    }
  }

  return next
}

export async function selectHardcoverPdfFrontPage(
  source: HardcoverPdfSource,
  pageNumber: number
): Promise<HardcoverPdfSource> {
  if (source.sourceMode === 'separate' || source.frontSource || source.backSource) {
    if (!source.frontSource) throw new Error('Upload a front-cover PDF first.')
    const coverSource = await selectHardcoverPdfCoverPage(source.frontSource, pageNumber)
    return updateHardcoverSeparatePdfSource(source, 'front', coverSource)
  }

  return selectHardcoverPdfPage(source, 'front', pageNumber)
}

export async function loadHardcoverPdfPagePreviews(
  source: HardcoverPdfSource,
  startPage: number,
  count = HARDCOVER_PAGE_PREVIEW_BATCH_SIZE,
  target: HardcoverPdfCoverTarget = 'front'
): Promise<HardcoverPdfSource> {
  if (source.sourceMode === 'separate' || source.frontSource || source.backSource) {
    const selectedSource = target === 'back' ? source.backSource : source.frontSource
    if (!selectedSource) return source
    const nextCoverSource = await loadHardcoverPdfCoverPagePreviews(
      selectedSource,
      startPage,
      count
    )
    return updateHardcoverSeparatePdfSource(source, target, nextCoverSource)
  }

  if (!source.bytes) return source
  if (!isValidHardcoverPageNumber(startPage, source.pageCount)) {
    throw new Error(`Choose a page between 1 and ${source.pageCount}.`)
  }

  const safeCount = Math.max(1, Math.floor(count))
  const endPage = Math.min(source.pageCount, startPage + safeCount - 1)
  let pdf: PDFDocumentProxy | undefined

  try {
    pdf = await loadHardcoverPdfDocument(source.bytes)
    const nextPreviews = await renderHardcoverPdfPagePreviews(
      source.fileName,
      pdf,
      startPage,
      endPage
    )

    return {
      ...source,
      pagePreviews: nextPreviews.reduce(
        (previews, preview) => upsertPagePreview(previews, preview),
        source.pagePreviews ?? []
      )
    }
  } catch (error) {
    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

export async function selectHardcoverPdfBackPage(
  source: HardcoverPdfSource,
  pageNumber: number
): Promise<HardcoverPdfSource> {
  if (source.sourceMode === 'separate' || source.frontSource || source.backSource) {
    if (!source.backSource) throw new Error('Upload a back-cover PDF first.')
    const coverSource = await selectHardcoverPdfCoverPage(source.backSource, pageNumber)
    return updateHardcoverSeparatePdfSource(source, 'back', coverSource)
  }

  return selectHardcoverPdfPage(source, 'back', pageNumber)
}

export async function setHardcoverPdfBackCoverEnabled(
  source: HardcoverPdfSource,
  enabled: boolean
): Promise<HardcoverPdfSource> {
  if (source.sourceMode === 'separate' || source.frontSource || source.backSource) {
    if (enabled && !source.backSource) throw new Error('Upload a back-cover PDF first.')

    return {
      ...source,
      backCoverEnabled: enabled,
      backPageNumber: enabled ? source.backSource?.pageNumber : undefined,
      backPageRotation: enabled ? source.backSource?.rotation : undefined,
      backThumbnailDataUrl: enabled ? source.backSource?.thumbnailDataUrl : undefined,
      backPageGeometry: enabled ? source.backSource?.pageGeometry : undefined
    }
  }

  if (!enabled) {
    return {
      ...source,
      backCoverEnabled: false,
      backPageNumber: undefined,
      backPageRotation: undefined,
      backThumbnailDataUrl: undefined,
      backPageGeometry: undefined
    }
  }

  return selectHardcoverPdfBackPage(
    source,
    source.backPageNumber ?? Math.max(1, Math.min(2, source.pageCount))
  )
}

async function selectHardcoverPdfPage(
  source: HardcoverPdfSource,
  target: HardcoverPdfPageTarget,
  pageNumber: number
): Promise<HardcoverPdfSource> {
  if (!isValidHardcoverPageNumber(pageNumber, source.pageCount)) {
    throw new Error(`Choose a page between 1 and ${source.pageCount}.`)
  }

  const cachedPreview = findPagePreview(source, pageNumber)
  if (!source.bytes) {
    return applyPdfPageSelection(source, target, pageNumber, cachedPreview)
  }

  let pdf: PDFDocumentProxy | undefined

  try {
    pdf = await loadHardcoverPdfDocument(source.bytes)
    const previewWithoutGeometry =
      cachedPreview ?? (await renderHardcoverPdfPagePreview(source.fileName, pdf, pageNumber))
    const [preview] = await attachPageGeometries(source.bytes, [previewWithoutGeometry])
    const selectedPreview = preview ?? previewWithoutGeometry
    const pagePreviews = upsertPagePreview(source.pagePreviews ?? [], selectedPreview)

    return applyPdfPageSelection({ ...source, pagePreviews }, target, pageNumber, selectedPreview)
  } catch (error) {
    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

async function selectHardcoverPdfCoverPage(
  source: HardcoverPdfCoverSource,
  pageNumber: number
): Promise<HardcoverPdfCoverSource> {
  if (!isValidHardcoverPageNumber(pageNumber, source.pageCount)) {
    throw new Error(`Choose a page between 1 and ${source.pageCount}.`)
  }

  const cachedPreview = findPagePreview(source, pageNumber)
  const bytes = runtimeCoverPdfs.get(source.sourceId)?.bytes

  if (!bytes) {
    return applyPdfCoverPageSelection(source, pageNumber, cachedPreview)
  }

  let pdf: PDFDocumentProxy | undefined

  try {
    pdf = await loadHardcoverPdfDocument(bytes)
    const preview =
      cachedPreview ?? (await renderHardcoverPdfPagePreview(source.fileName, pdf, pageNumber))
    const [previewWithGeometry] = await attachPageGeometries(bytes, [preview])
    const pagePreviews = upsertPagePreview(
      source.pagePreviews ?? [],
      previewWithGeometry ?? preview
    )

    return applyPdfCoverPageSelection(
      { ...source, pagePreviews },
      pageNumber,
      previewWithGeometry ?? preview
    )
  } catch (error) {
    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

async function loadHardcoverPdfCoverPagePreviews(
  source: HardcoverPdfCoverSource,
  startPage: number,
  count = HARDCOVER_PAGE_PREVIEW_BATCH_SIZE
): Promise<HardcoverPdfCoverSource> {
  const bytes = runtimeCoverPdfs.get(source.sourceId)?.bytes
  if (!bytes) return source
  if (!isValidHardcoverPageNumber(startPage, source.pageCount)) {
    throw new Error(`Choose a page between 1 and ${source.pageCount}.`)
  }

  const safeCount = Math.max(1, Math.floor(count))
  const endPage = Math.min(source.pageCount, startPage + safeCount - 1)
  let pdf: PDFDocumentProxy | undefined

  try {
    pdf = await loadHardcoverPdfDocument(bytes)
    const previews = await renderHardcoverPdfPagePreviews(source.fileName, pdf, startPage, endPage)
    const previewsWithGeometry = await attachPageGeometries(bytes, previews)

    return {
      ...source,
      pagePreviews: previewsWithGeometry.reduce(
        (nextPreviews, preview) => upsertPagePreview(nextPreviews, preview),
        source.pagePreviews ?? []
      )
    }
  } catch (error) {
    throw normalizePdfError(error)
  } finally {
    await pdf?.destroy()
  }
}

async function renderHardcoverPdfPagePreviews(
  fileName: string,
  pdf: PDFDocumentProxy,
  startPage: number,
  endPage: number
): Promise<HardcoverPdfPagePreview[]> {
  const previews: HardcoverPdfPagePreview[] = []
  const firstPage = Math.max(1, startPage)
  const lastPage = Math.min(pdf.numPages, endPage)

  for (let pageNumber = firstPage; pageNumber <= lastPage; pageNumber += 1) {
    previews.push(await renderHardcoverPdfPagePreview(fileName, pdf, pageNumber))
  }

  return previews
}

async function renderHardcoverPdfPagePreview(
  fileName: string,
  pdf: PDFDocumentProxy,
  pageNumber: number
): Promise<HardcoverPdfPagePreview> {
  const page = await pdf.getPage(pageNumber)

  try {
    return {
      pageNumber,
      rotation: page.rotate ?? 0,
      thumbnailDataUrl: await renderHardcoverPdfThumbnail(fileName, page, pageNumber)
    }
  } finally {
    page.cleanup()
  }
}

async function renderHardcoverPdfThumbnail(
  fileName: string,
  page: PDFPageProxy,
  pageNumber: number
): Promise<string> {
  const performanceSettings = getPerformanceSettingsSnapshot()
  const maxWidth = performanceSettings.render.thumbnailMaxSizePx
  const maxHeight = Math.round(maxWidth * 1.45)
  const quality = performanceSettings.render.thumbnailJpegQuality
  const viewport = page.getViewport({ scale: 1 })
  const scale = Math.min(maxWidth / viewport.width, maxHeight / viewport.height, 1)
  const renderViewport = page.getViewport({ scale })
  const cacheKey = `hardcover:${fileName}:${pageNumber}:${maxWidth}:${quality}`

  return getOrCreateThumbnailUrl(cacheKey, async () => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Could not create a canvas context for PDF thumbnail rendering.')
    }

    canvas.width = Math.max(Math.floor(renderViewport.width), 1)
    canvas.height = Math.max(Math.floor(renderViewport.height), 1)
    assertCanvasWithinLimit(canvas.width, canvas.height, 'generating hardcover PDF thumbnail')

    try {
      await page.render({ canvas, canvasContext: context, viewport: renderViewport }).promise
      return canvasToThumbnailBlob(canvas, 'image/jpeg', quality)
    } finally {
      resetCanvas(canvas)
    }
  })
}

function applyPdfPageSelection(
  source: HardcoverPdfSource,
  target: HardcoverPdfPageTarget,
  pageNumber: number,
  preview: HardcoverPdfPagePreview | undefined
): HardcoverPdfSource {
  if (target === 'back') {
    return {
      ...source,
      backCoverEnabled: true,
      backPageNumber: pageNumber,
      backPageRotation: preview?.rotation,
      backThumbnailDataUrl: preview?.thumbnailDataUrl,
      backPageGeometry: preview?.geometry
    }
  }

  return {
    ...source,
    frontPageNumber: pageNumber,
    frontPageRotation: preview?.rotation,
    thumbnailDataUrl: preview?.thumbnailDataUrl,
    frontPageGeometry: preview?.geometry
  }
}

function applyPdfCoverPageSelection(
  source: HardcoverPdfCoverSource,
  pageNumber: number,
  preview: HardcoverPdfPagePreview | undefined
): HardcoverPdfCoverSource {
  return {
    ...source,
    pageNumber,
    rotation: preview?.rotation ?? source.rotation,
    thumbnailDataUrl: preview?.thumbnailDataUrl ?? source.thumbnailDataUrl,
    pageGeometry: preview?.geometry ?? source.pageGeometry
  }
}

function findPagePreview(
  source: Pick<HardcoverPdfSource, 'pagePreviews'> | Pick<HardcoverPdfCoverSource, 'pagePreviews'>,
  pageNumber: number
): HardcoverPdfPagePreview | undefined {
  return source.pagePreviews?.find((preview) => preview.pageNumber === pageNumber)
}

function upsertPagePreview(
  previews: HardcoverPdfPagePreview[],
  preview: HardcoverPdfPagePreview
): HardcoverPdfPagePreview[] {
  return [...previews.filter((item) => item.pageNumber !== preview.pageNumber), preview].sort(
    (first, second) => first.pageNumber - second.pageNumber
  )
}

export async function readHardcoverPdfPageGeometry(
  bytes: Uint8Array,
  pageNumber: number
): Promise<HardcoverPdfPageGeometry> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false })
  const pages = document.getPages()

  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pages.length) {
    throw new Error(`Choose a page between 1 and ${pages.length}.`)
  }

  const page = pages[pageNumber - 1]
  const mediaBox = toPdfRectangle(page.getMediaBox())
  const cropBox = toPdfRectangle(page.getCropBox())
  const bleedBox = toPdfRectangle(page.getBleedBox())
  const trimBox = toPdfRectangle(page.getTrimBox())
  const artBox = toPdfRectangle(page.getArtBox())
  const warnings: string[] = []

  if (rectanglesEqual(trimBox, cropBox)) {
    warnings.push('TrimBox is not distinct from CropBox; confirm the intended trim area.')
  }
  if (rectanglesEqual(bleedBox, cropBox)) {
    warnings.push('BleedBox is not distinct from CropBox; confirm the intended bleed area.')
  }

  return {
    widthPt: cropBox.width,
    heightPt: cropBox.height,
    rotation: page.getRotation().angle,
    mediaBox,
    cropBox,
    bleedBox,
    trimBox,
    artBox,
    warnings
  }
}

async function attachPageGeometries(
  bytes: Uint8Array,
  previews: HardcoverPdfPagePreview[]
): Promise<HardcoverPdfPagePreview[]> {
  if (previews.length === 0) return previews

  const document = await PDFDocument.load(bytes, { updateMetadata: false })
  const pages = document.getPages()
  const geometries = new Map<number, HardcoverPdfPageGeometry>()

  for (const preview of previews) {
    const page = pages[preview.pageNumber - 1]
    if (!page) continue
    const mediaBox = toPdfRectangle(page.getMediaBox())
    const cropBox = toPdfRectangle(page.getCropBox())
    const bleedBox = toPdfRectangle(page.getBleedBox())
    const trimBox = toPdfRectangle(page.getTrimBox())
    const artBox = toPdfRectangle(page.getArtBox())
    const warnings: string[] = []

    if (rectanglesEqual(trimBox, cropBox)) {
      warnings.push('TrimBox is not distinct from CropBox; confirm the intended trim area.')
    }
    if (rectanglesEqual(bleedBox, cropBox)) {
      warnings.push('BleedBox is not distinct from CropBox; confirm the intended bleed area.')
    }

    geometries.set(preview.pageNumber, {
      widthPt: cropBox.width,
      heightPt: cropBox.height,
      rotation: page.getRotation().angle,
      mediaBox,
      cropBox,
      bleedBox,
      trimBox,
      artBox,
      warnings
    })
  }

  return previews.map((preview) => ({
    ...preview,
    geometry: geometries.get(preview.pageNumber)
  }))
}

function toPdfRectangle(rectangle: {
  x: number
  y: number
  width: number
  height: number
}): HardcoverPdfRectangle {
  return {
    x: roundPdfNumber(rectangle.x),
    y: roundPdfNumber(rectangle.y),
    width: roundPdfNumber(rectangle.width),
    height: roundPdfNumber(rectangle.height)
  }
}

function rectanglesEqual(first: HardcoverPdfRectangle, second: HardcoverPdfRectangle): boolean {
  return (
    Math.abs(first.x - second.x) < 0.01 &&
    Math.abs(first.y - second.y) < 0.01 &&
    Math.abs(first.width - second.width) < 0.01 &&
    Math.abs(first.height - second.height) < 0.01
  )
}

function roundPdfNumber(value: number): number {
  return Math.round(value * 100) / 100
}

function createRuntimeSourceId(fileName: string): string {
  runtimeSourceSequence += 1
  return `hardcover-pdf-${Date.now().toString(36)}-${runtimeSourceSequence.toString(36)}-${fileName}`
}

function assertPdfFile(file: File): void {
  if (file.type && file.type !== 'application/pdf') {
    throw new Error(`${file.name} is not a PDF file.`)
  }
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error(`${file.name} is not a PDF file.`)
  }
}

async function loadHardcoverPdfDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const { loadPdfDocument } = await import('../../booklet-montage/lib/pdfWorker')
  return loadPdfDocument(bytes)
}

function normalizePdfError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error('Unsupported PDF. The app could not read this file.')
  }
  if (error.name === 'PasswordException') {
    return new Error('Password-protected PDF files are not supported yet.')
  }
  if (error.name === 'InvalidPDFException') {
    return new Error('Corrupted PDF. The file could not be parsed safely.')
  }
  if (error.name === 'MissingPDFException') {
    return new Error('PDF file could not be found or is empty.')
  }
  if (error.name === 'UnexpectedResponseException') {
    return new Error('Unsupported PDF. The file could not be loaded.')
  }
  if (error.name === 'UnknownErrorException') {
    return new Error('Unsupported PDF. The renderer reported an unknown PDF error.')
  }
  return error
}

function getFilePath(file: File): string | undefined {
  const candidate = file as File & { path?: unknown }

  return typeof candidate.path === 'string' ? candidate.path : undefined
}
