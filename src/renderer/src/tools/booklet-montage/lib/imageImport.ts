import type { ImportedPagesResult, ImportProgress } from '../types'
import { createStableId } from './bookletImposition'
import { assertNotCanceled, releasePageThumbnails, resetCanvas, yieldToUi } from './memoryCleanup'
import { naturalSortFiles } from './naturalSort'
import { canvasToThumbnailBlob, getOrCreateThumbnailUrl } from './thumbnailCache'
import { pixelsToMm } from './units'

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])
const THUMBNAIL_MAX_SIZE = 360
const THUMBNAIL_QUALITY = 0.72

interface ImageImportOptions {
  signal?: AbortSignal
}

export async function importImageFiles(
  files: File[],
  onProgress: (progress: ImportProgress) => void,
  options: ImageImportOptions = {}
): Promise<ImportedPagesResult> {
  const imageFiles = naturalSortFiles(files.filter(isSupportedImageFile))

  if (imageFiles.length !== files.length) {
    throw new Error('Only JPG and PNG image files are supported.')
  }

  const sources = []
  const pages = []
  const signal = options.signal

  try {
    for (let index = 0; index < imageFiles.length; index += 1) {
      assertNotCanceled(signal)

      const file = imageFiles[index]

      onProgress({
        phase: 'reading',
        current: index + 1,
        total: imageFiles.length,
        message: `Importing ${file.name}`
      })

      const bytes = new Uint8Array(await file.arrayBuffer())
      assertNotCanceled(signal)

      const sourceId = createStableId('image')
      const mimeType = getImageMimeType(file)
      const imageInfo = await readImageInfo(bytes, mimeType, `image:${sourceId}`, signal)

      sources.push({
        id: sourceId,
        kind: 'image' as const,
        name: file.name,
        mimeType,
        bytes,
        pageCount: 1
      })

      pages.push({
        id: createStableId('page'),
        kind: 'image' as const,
        sourceType: 'image' as const,
        sourceId,
        sourceName: file.name,
        sourceFileName: file.name,
        sourcePageIndex: 0,
        originalPageNumber: index + 1,
        currentOrderIndex: index,
        originalOrderIndex: index,
        importBatchId: sourceId,
        importBatchIndex: index,
        label: file.name,
        displayName: file.name,
        thumbnailUrl: imageInfo.thumbnailUrl,
        widthMm: pixelsToMm(imageInfo.width),
        heightMm: pixelsToMm(imageInfo.height)
      })

      await yieldToUi()
    }
  } catch (error) {
    releasePageThumbnails(pages)
    throw error
  }

  onProgress({
    phase: 'done',
    current: imageFiles.length,
    total: imageFiles.length,
    message: `Imported ${imageFiles.length} image pages`
  })

  return { sources, pages }
}

function isSupportedImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.has(file.type) || /\.(jpe?g|png)$/i.test(file.name)
}

function getImageMimeType(file: File): string {
  if (ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return file.type
  }

  return /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg'
}

async function readImageInfo(
  bytes: Uint8Array,
  mimeType: string,
  cacheKey: string,
  signal?: AbortSignal
): Promise<{ width: number; height: number; thumbnailUrl: string }> {
  assertNotCanceled(signal)

  const blob = new Blob([bytesToArrayBuffer(bytes)], { type: mimeType })
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(THUMBNAIL_MAX_SIZE / bitmap.width, THUMBNAIL_MAX_SIZE / bitmap.height, 1)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    bitmap.close()
    throw new Error('Could not create a canvas context for image thumbnail rendering.')
  }

  try {
    canvas.width = Math.max(Math.round(bitmap.width * scale), 1)
    canvas.height = Math.max(Math.round(bitmap.height * scale), 1)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const thumbnailUrl = await getOrCreateThumbnailUrl(cacheKey, () =>
      canvasToThumbnailBlob(canvas, 'image/jpeg', THUMBNAIL_QUALITY)
    )

    return { width: bitmap.width, height: bitmap.height, thumbnailUrl }
  } finally {
    resetCanvas(canvas)
    bitmap.close()
  }
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
