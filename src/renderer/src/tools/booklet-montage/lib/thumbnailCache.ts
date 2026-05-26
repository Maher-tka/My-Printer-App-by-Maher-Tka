const thumbnailUrlByKey = new Map<string, string>()
const thumbnailKeyByUrl = new Map<string, string>()

export async function getOrCreateThumbnailUrl(
  key: string,
  renderBlob: () => Promise<Blob>
): Promise<string> {
  const cached = thumbnailUrlByKey.get(key)

  if (cached) {
    return cached
  }

  const blob = await renderBlob()
  const url = URL.createObjectURL(blob)

  thumbnailUrlByKey.set(key, url)
  thumbnailKeyByUrl.set(url, key)

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
}

export function clearThumbnailCache(): void {
  for (const url of thumbnailUrlByKey.values()) {
    URL.revokeObjectURL(url)
  }

  thumbnailUrlByKey.clear()
  thumbnailKeyByUrl.clear()
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
