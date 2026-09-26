import type { NumberArtwork } from '../types'

const MAX_FILE_BYTES = 30 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000

export function artworkBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

export async function loadNumberArtwork(file: File, pageNumber = 1): Promise<NumberArtwork> {
  if (!file.size) throw new Error('This file is empty. Choose a PDF, PNG, or JPG design.')
  if (file.size > MAX_FILE_BYTES) throw new Error('Choose a design smaller than 30 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const signature = String.fromCharCode(...bytes.subarray(0, 1024))
  const kind = signature.includes('%PDF-')
    ? 'pdf'
    : bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
      ? 'png'
      : bytes[0] === 255 && bytes[1] === 216
        ? 'jpeg'
        : null
  if (!kind) throw new Error('This file is not a supported PDF, PNG, or JPG design.')
  const artwork: NumberArtwork = {
    name: file.name,
    kind,
    bytesBase64: encodeBytes(bytes),
    pageNumber: 1,
    pageCount: 1,
    widthMm: 0,
    heightMm: 0,
    previewDataUrl: ''
  }
  if (kind === 'pdf') return changeNumberArtworkPage(artwork, pageNumber)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/' + kind }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
      throw new Error('This image is too large to preview. Resize it below 40 megapixels.')
    }
    // Re-encode JPEGs at their decoded orientation so PDF embedding matches the
    // browser preview even for phone photos with EXIF rotation.
    let exportBytesBase64 = artwork.bytesBase64
    if (kind === 'jpeg') {
      const normalized = document.createElement('canvas')
      normalized.width = image.naturalWidth
      normalized.height = image.naturalHeight
      const normalizedContext = normalized.getContext('2d')
      if (!normalizedContext) throw new Error('Could not prepare the image orientation.')
      normalizedContext.drawImage(image, 0, 0)
      exportBytesBase64 = normalized.toDataURL('image/jpeg', 0.98).split(',')[1]
      normalized.width = normalized.height = 0
      if (exportBytesBase64.length > (MAX_FILE_BYTES * 4) / 3) {
        throw new Error('The decoded image is too large. Resize it before importing.')
      }
    }
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the image preview.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const previewDataUrl = canvas.toDataURL('image/png')
    canvas.width = canvas.height = 0
    return {
      ...artwork,
      bytesBase64: exportBytesBase64,
      widthMm: (image.naturalWidth * 25.4) / 300,
      heightMm: (image.naturalHeight * 25.4) / 300,
      previewDataUrl
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'This image could not be read.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function changeNumberArtworkPage(
  artwork: NumberArtwork,
  pageNumber: number
): Promise<NumberArtwork> {
  if (artwork.kind !== 'pdf') return artwork
  if (!Number.isInteger(pageNumber) || pageNumber < 1)
    throw new Error('Choose a valid PDF page number.')
  const { loadPdfDocument, destroyPdfDocument, normalizePdfError } =
    await import('../../booklet-montage/lib/pdfWorker')
  const pdf = await loadPdfDocument(artworkBytes(artwork.bytesBase64))
  try {
    if (pageNumber > pdf.numPages) throw new Error(`This PDF has ${pdf.numPages} pages.`)
    const page = await pdf.getPage(pageNumber)
    const actual = page.getViewport({ scale: 1 })
    const scale = Math.min(2, 1200 / Math.max(actual.width, actual.height))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(viewport.width))
    canvas.height = Math.max(1, Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the PDF preview.')
    try {
      await page.render({ canvas, canvasContext: context, viewport }).promise
      return {
        ...artwork,
        pageNumber,
        pageCount: pdf.numPages,
        widthMm: (actual.width * 25.4) / 72,
        heightMm: (actual.height * 25.4) / 72,
        previewDataUrl: canvas.toDataURL('image/png')
      }
    } finally {
      canvas.width = canvas.height = 0
    }
  } catch (error) {
    throw normalizePdfError(error)
  } finally {
    await destroyPdfDocument(pdf)
  }
}
