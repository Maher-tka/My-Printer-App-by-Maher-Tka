import { PDFDocument } from 'pdf-lib'
import {
  artworkBytes,
  changeNumberArtworkPage,
  loadNumberArtwork
} from '../../sequential-number/lib/artwork'
import type { CardArtwork } from '../types'
import { inspectCardPageFonts } from './pdfFonts'
import { loadCardJpegArtwork } from './jpegArtwork'
import { getPerformanceSettingsSnapshot } from '../../../performance/performanceSettings'
import {
  assertEpsImportRequest,
  getEpsDimensions,
  MAX_EPS_BYTES
} from '../../../../../shared/eps-import'

export async function prepareCardArtworkFile(file: File): Promise<File> {
  if (!file.size) throw new Error('This file is empty. Choose an AI, EPS, PDF, PNG, or JPG design.')
  if (file.size > MAX_EPS_BYTES) throw new Error('Choose a design smaller than 30 MB.')
  if (!/\.eps$/i.test(file.name)) return file
  const request = { fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
  assertEpsImportRequest(request)
  getEpsDimensions(request.bytes)
  const converter = window.printerApp?.runtime?.importEpsArtwork
  if (!converter)
    throw new Error(
      'EPS import requires the desktop app and Adobe Illustrator. Export the EPS as PDF to import it here.'
    )
  const result = await converter(request)
  if (!result.ok) throw new Error(result.error)
  return new File([new Uint8Array(artworkBytes(result.bytesBase64))], file.name, {
    type: 'application/pdf'
  })
}

export function assertCardFileSupported(bytes: Uint8Array, fileName: string): void {
  if (
    /\.ai$/i.test(fileName) &&
    !String.fromCharCode(...bytes.subarray(0, 1024)).includes('%PDF-')
  ) {
    throw new Error(
      'This Illustrator file was saved without PDF compatibility. Ask for an AI saved with “Create PDF Compatible File”, or a PDF with embedded fonts. The app cannot preserve artwork and fonts from this native-only AI file without Illustrator.'
    )
  }
}

async function addPdfInfo(artwork: CardArtwork): Promise<CardArtwork> {
  if (artwork.kind !== 'pdf' || artwork.pdfInfo) return artwork
  const source = await PDFDocument.load(artworkBytes(artwork.bytesBase64))
  return {
    ...artwork,
    pdfInfo: {
      sourceFormat: /\.eps$/i.test(artwork.name)
        ? 'eps'
        : /\.ai$/i.test(artwork.name)
          ? 'illustrator'
          : 'pdf',
      pages: source
        .getPages()
        .map((page, index) => ({ pageNumber: index + 1, fonts: inspectCardPageFonts(page) }))
    }
  }
}

export async function loadCardArtwork(file: File): Promise<CardArtwork> {
  const prepared = await prepareCardArtworkFile(file)
  const header = new Uint8Array(await prepared.slice(0, 1024).arrayBuffer())
  assertCardFileSupported(header, prepared.name)
  if (header[0] === 0xff && header[1] === 0xd8) return loadCardJpegArtwork(prepared)
  const artwork = await addPdfInfo(await loadNumberArtwork(prepared))
  return artwork.kind === 'pdf' && artwork.pageCount > 1
    ? loadCardPagePreviews(artwork, 1)
    : artwork
}

export async function changeCardArtworkPage(
  artwork: CardArtwork,
  pageNumber: number
): Promise<CardArtwork> {
  const next = await addPdfInfo(await changeNumberArtworkPage(artwork, pageNumber))
  return {
    ...next,
    pagePreviews: [
      ...(artwork.pagePreviews ?? []).filter((page) => page.pageNumber !== pageNumber),
      { pageNumber, thumbnailDataUrl: next.previewDataUrl }
    ].sort((a, b) => a.pageNumber - b.pageNumber)
  }
}

export async function loadCardPagePreviews(
  artwork: CardArtwork,
  startPage: number
): Promise<CardArtwork> {
  if (artwork.kind !== 'pdf') return artwork
  if (!Number.isInteger(startPage) || startPage < 1 || startPage > artwork.pageCount)
    throw new Error('Choose a valid thumbnail page.')
  const { loadPdfDocument, destroyPdfDocument } =
    await import('../../booklet-montage/lib/pdfWorker')
  const settings = getPerformanceSettingsSnapshot()
  const batchSize = Math.min(8, settings.render.pdfImportBatchSize)
  const pdf = await loadPdfDocument(artworkBytes(artwork.bytesBase64))
  const previews = new Map((artwork.pagePreviews ?? []).map((page) => [page.pageNumber, page]))
  try {
    for (
      let number = startPage;
      number <= Math.min(pdf.numPages, startPage + batchSize - 1);
      number++
    ) {
      if (previews.has(number)) continue
      const page = await pdf.getPage(number)
      const actual = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({
        scale: Math.min(
          1,
          settings.render.thumbnailMaxSizePx / Math.max(actual.width, actual.height)
        )
      })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not create the page thumbnail.')
      try {
        await page.render({ canvas, canvasContext: context, viewport }).promise
        previews.set(number, {
          pageNumber: number,
          thumbnailDataUrl: canvas.toDataURL('image/png')
        })
      } finally {
        canvas.width = canvas.height = 0
        page.cleanup()
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    return {
      ...artwork,
      pagePreviews: [...previews.values()].sort((a, b) => a.pageNumber - b.pageNumber)
    }
  } finally {
    await destroyPdfDocument(pdf)
  }
}
