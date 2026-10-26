import { bytesToArrayBuffer } from './sourcePreview'

export interface PngContourInput {
  sourceId: string
  artworkVersion: File | Uint8Array
  file: File
  widthMm: number
  quantity: number
}

export interface PngContourImport {
  id: string
  stickers: PngContourInput[]
}

/** Carry current pixels, including mask edits and prepared crops, without changing the AI queue. */
export async function preparePngContourHandoff(
  items: Array<{
    id: string
    file: File
    preparedFile?: File
    result?: { png: Uint8Array }
    isSheet?: boolean
    widthMm: number
    quantity: number
  }>
): Promise<PngContourInput[]> {
  if (items.some((item) => item.isSheet))
    throw new Error('Separate sticker sheets before adding white contours.')
  if (items.length > 100) throw new Error('Import up to 100 PNG images at a time.')
  const stickers: PngContourInput[] = []
  let totalBytes = 0
  for (const item of items) {
    const original = item.preparedFile ?? item.file
    const artworkVersion = item.result?.png ?? original
    let png: Blob = item.result
      ? new Blob([bytesToArrayBuffer(item.result.png)], { type: 'image/png' })
      : original
    if (!item.result && original.type !== 'image/png') {
      const bitmap = await createImageBitmap(original)
      const canvas = document.createElement('canvas')
      try {
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas processing is unavailable.')
        context.drawImage(bitmap, 0, 0)
        png = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))),
            'image/png'
          )
        )
      } finally {
        bitmap.close()
        canvas.width = canvas.height = 0
      }
    }
    totalBytes += png.size
    if (totalBytes > 200 * 1024 * 1024)
      throw new Error('The bordered artwork exceeds 200 MB. Use fewer or smaller PNG images.')
    stickers.push({
      sourceId: item.id,
      artworkVersion,
      file: new File([png], `${item.file.name.replace(/\.[^.]+$/, '')}.png`, { type: 'image/png' }),
      widthMm: item.widthMm,
      quantity: item.quantity
    })
  }
  return stickers
}
