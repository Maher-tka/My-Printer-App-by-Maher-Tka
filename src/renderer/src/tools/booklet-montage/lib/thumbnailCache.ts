import { getPerformanceSettingsSnapshot } from '../../../performance/performanceSettings'

const thumbnailUrlByKey = new Map<string, string>()
const thumbnailKeyByUrl = new Map<string, string>()
const thumbnailLastUsedByKey = new Map<string, number>()

export async function getOrCreateThumbnailUrl(
  key: string,
  renderBlob: () => Promise<Blob>
): Promise<string> {
  const cached = thumbnailUrlByKey.get(key)

  if (cached) {
    thumbnailLastUsedByKey.set(key, Date.now())
    return cached
  }

  const blob = await renderBlob()
  const url = URL.createObjectURL(blob)

  thumbnailUrlByKey.set(key, url)
  thumbnailKeyByUrl.set(url, key)
  thumbnailLastUsedByKey.set(key, Date.now())
  trimThumbnailCache()

  return url
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
  for (const url of thumbnailUrlByKey.values()) {
    URL.revokeObjectURL(url)
  }

  thumbnailUrlByKey.clear()
  thumbnailKeyByUrl.clear()
  thumbnailLastUsedByKey.clear()
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
