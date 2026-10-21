export interface StickerVectorImportRequest {
  fileName: string
  bytes: Uint8Array
}
export interface StickerVectorAsset {
  name: string
  widthMm: number
  heightMm: number
  svgBase64: string
  pdfBase64: string
}
export type StickerVectorImportResult =
  | { ok: true; stickers: StickerVectorAsset[] }
  | { ok: false; error: string }

export function assertStickerVectorImportRequest(
  value: unknown
): asserts value is StickerVectorImportRequest {
  const request = value as StickerVectorImportRequest | null
  if (
    !request ||
    typeof request.fileName !== 'string' ||
    !/\.ai$/i.test(request.fileName) ||
    !(request.bytes instanceof Uint8Array) ||
    !request.bytes.length ||
    request.bytes.length > 65 * 1024 * 1024
  )
    throw new Error('Choose an Illustrator AI file smaller than 65 MB.')
  const header = Buffer.from(request.bytes.subarray(0, 1024)).toString('latin1')
  if (!/%PDF-|%!PS/.test(header)) throw new Error('This file is not an Illustrator document.')
}
