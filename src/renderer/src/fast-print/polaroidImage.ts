import { readCardJpegInfo } from '../tools/card-montage/lib/jpegArtwork'

/** Decode only the resolution needed to fill a print slot, without upscaling.
 * Unknown headers fall back to the browser decoder so valid images are not rejected.
 */
export function polaroidDecodeOptions(
  bytes: Uint8Array,
  extension: string,
  targetWidth: number,
  targetHeight: number
): ImageBitmapOptions {
  let width = 0
  let height = 0
  try {
    if (extension === '.jpg' || extension === '.jpeg') {
      const info = readCardJpegInfo(bytes)
      const rotated = info.orientation >= 5
      width = rotated ? info.height : info.width
      height = rotated ? info.width : info.height
    } else if (
      extension === '.png' &&
      bytes.length >= 24 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    ) {
      const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      width = header.getUint32(16)
      height = header.getUint32(20)
    }
  } catch {
    return {}
  }
  if (!width || !height) return {}
  const scale = Math.min(
    1,
    2200 / Math.max(width, height),
    Math.max(targetWidth / width, targetHeight / height)
  )
  return {
    resizeWidth: Math.max(1, Math.ceil(width * scale)),
    resizeHeight: Math.max(1, Math.ceil(height * scale)),
    resizeQuality: 'high'
  }
}
