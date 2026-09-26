import { getPerformanceSettingsSnapshot } from '../../../performance/performanceSettings'

const thumbnailUrlByKey = new Map<string, string>()
const thumbnailKeyByUrl = new Map<string, string>()
const thumbnailLastUsedByKey = new Map<string, number>()
const pendingThumbnailByKey = new Map<string, Promise<string>>()

/**
 * Keep the import path responsive for long PDFs. The first pages are useful
 * for immediate ordering work and the last page is useful for cover/back
 * checks; the remaining pages can be rendered by the existing preview path.
 */
export const DEFAULT_INITIAL_THUMBNAIL_PAGE_LIMIT = 24

let thumbnailCacheGeneration = 0

export async function getOrCreateThumbnailUrl(
  key: string,
  renderBlob: () => Promise<Blob>
): Promise<string> {
  const cached = thumbnailUrlByKey.get(key)

  if (cached) {
    thumbnailLastUsedByKey.set(key, Date.now())
    return cached
  }

  const pending = pendingThumbnailByKey.get(key)

  if (pending) {
    return pending
  }

  const generation = thumbnailCacheGeneration
  const next = Promise.resolve()
    .then(() => renderBlob())
    .then((blob) => {
      const url = URL.createObjectURL(blob)

      if (generation !== thumbnailCacheGeneration) {
        URL.revokeObjectURL(url)
        throw new Error('Thumbnail cache was cleared while a thumbnail was rendering.')
      }

      const existing = thumbnailUrlByKey.get(key)

      if (existing) {
        URL.revokeObjectURL(url)
        thumbnailLastUsedByKey.set(key, Date.now())
        return existing
      }

      thumbnailUrlByKey.set(key, url)
      thumbnailKeyByUrl.set(url, key)
      thumbnailLastUsedByKey.set(key, Date.now())
      trimThumbnailCache()

      return url
    })
    .finally(() => {
      if (pendingThumbnailByKey.get(key) === next) {
        pendingThumbnailByKey.delete(key)
      }
    })

  pendingThumbnailByKey.set(key, next)

  return next
}

export function revokeThumbnailUrl(url: string): void {
  const key = thumbnailKeyByUrl.get(url)

  if (!key) {
    return
  }

  URL.revokeObjectURL(url)
  thumbnailKeyByUrl.delete(url)
  thumbnailUrlByKey.delete(key)
  thumbnailLastUsedByKey.delete(key)
}

export function clearThumbnailCache(): void {
  thumbnailCacheGeneration += 1

  for (const url of thumbnailUrlByKey.values()) {
    URL.revokeObjectURL(url)
  }

  thumbnailUrlByKey.clear()
  thumbnailKeyByUrl.clear()
  thumbnailLastUsedByKey.clear()
  pendingThumbnailByKey.clear()
}

export function clearUnusedThumbnailUrls(activeKeys: Set<string>): void {
  for (const [key, url] of thumbnailUrlByKey) {
    if (!activeKeys.has(key)) {
      URL.revokeObjectURL(url)
      thumbnailUrlByKey.delete(key)
      thumbnailKeyByUrl.delete(url)
      thumbnailLastUsedByKey.delete(key)
    }
  }
}

export function getThumbnailCacheSize(): number {
  return thumbnailUrlByKey.size
}

export function getPendingThumbnailCount(): number {
  return pendingThumbnailByKey.size
}

export function getInitialThumbnailPageIndexes(
  pageCount: number,
  requestedLimit = DEFAULT_INITIAL_THUMBNAIL_PAGE_LIMIT
): number[] {
  const normalizedPageCount = Number.isFinite(pageCount) ? Math.max(0, Math.floor(pageCount)) : 0
  const normalizedLimit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.floor(requestedLimit))
    : DEFAULT_INITIAL_THUMBNAIL_PAGE_LIMIT

  if (normalizedPageCount === 0 || normalizedLimit === 0) {
    return []
  }

  const limit = Math.min(normalizedPageCount, normalizedLimit)

  if (limit === 1) {
    return [0]
  }

  const indexes = Array.from({ length: limit - 1 }, (_, index) => index)
  const lastPageIndex = normalizedPageCount - 1

  if (indexes[indexes.length - 1] !== lastPageIndex) {
    indexes.push(lastPageIndex)
  }

  return indexes
}

export function canvasToThumbnailBlob(
  canvas: HTMLCanvasElement,
  type = 'image/jpeg',
  quality = 0.62
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not generate page thumbnail.'))
          return
        }

        resolve(blob)
      },
      type,
      quality
    )
  })
}

function trimThumbnailCache(): void {
  const limit = getPerformanceSettingsSnapshot().memory.objectUrlCacheLimit

  if (thumbnailUrlByKey.size <= limit) {
    return
  }

  const orderedKeys = [...thumbnailLastUsedByKey.entries()]
    .sort((first, second) => first[1] - second[1])
    .map(([key]) => key)

  for (const key of orderedKeys) {
    if (thumbnailUrlByKey.size <= limit) {
      break
    }

    const url = thumbnailUrlByKey.get(key)

    if (url) {
      URL.revokeObjectURL(url)
      thumbnailKeyByUrl.delete(url)
    }

    thumbnailUrlByKey.delete(key)
    thumbnailLastUsedByKey.delete(key)
  }
}
