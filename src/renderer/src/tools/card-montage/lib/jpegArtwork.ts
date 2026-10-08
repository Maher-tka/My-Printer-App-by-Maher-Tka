import {
  PDFDocument,
  PDFName,
  PDFStream,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState
} from 'pdf-lib'
import type { CardArtwork } from '../types'

const text = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length))
const FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
])

export interface CardJpegInfo {
  width: number
  height: number
  channels: 1 | 3 | 4
  orientation: number
  adobe: boolean
  profile?: Uint8Array
}

function exifOrientation(segment: Uint8Array): number {
  if (text(segment, 0, 6) !== 'Exif\0\0' || segment.length < 14) return 1
  const tiff = new DataView(segment.buffer, segment.byteOffset + 6, segment.length - 6)
  const order = tiff.getUint16(0)
  if (order !== 0x4949 && order !== 0x4d4d) return 1
  const little = order === 0x4949
  if (tiff.getUint16(2, little) !== 42) return 1
  const offset = tiff.getUint32(4, little)
  if (offset > tiff.byteLength - 2) return 1
  const count = tiff.getUint16(offset, little)
  for (let index = 0; index < count; index++) {
    const entry = offset + 2 + index * 12
    if (entry > tiff.byteLength - 12) return 1
    if (tiff.getUint16(entry, little) !== 274) continue
    if (tiff.getUint16(entry + 2, little) !== 3 || tiff.getUint32(entry + 4, little) !== 1) return 1
    const value = tiff.getUint16(entry + 8, little)
    return value >= 1 && value <= 8 ? value : 1
  }
  return 1
}

export function readCardJpegInfo(bytes: Uint8Array): CardJpegInfo {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('This is not a supported JPEG.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0,
    height = 0,
    channels = 0,
    orientation = 1,
    adobe = false,
    chunkCount = 0
  const chunks = new Map<number, Uint8Array>()
  for (let offset = 2; offset < bytes.length; ) {
    if (bytes[offset++] !== 0xff) throw new Error('The JPEG header is corrupted.')
    while (bytes[offset] === 0xff) offset++
    const marker = bytes[offset++]
    if (marker === 0xda || marker === 0xd9) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) throw new Error('The JPEG header is incomplete.')
    const length = view.getUint16(offset)
    if (length < 2 || offset + length > bytes.length)
      throw new Error('The JPEG header is incomplete.')
    const segment = bytes.subarray(offset + 2, offset + length)
    if (FRAME_MARKERS.has(marker)) {
      if (segment.length < 6) throw new Error('The JPEG dimensions are missing.')
      height = view.getUint16(offset + 3)
      width = view.getUint16(offset + 5)
      channels = segment[5]
    } else if (marker === 0xe1 && text(segment, 0, 6) === 'Exif\0\0') {
      orientation = exifOrientation(segment)
    } else if (marker === 0xee && text(segment, 0, 5) === 'Adobe') {
      adobe = true
    } else if (marker === 0xe2 && text(segment, 0, 12) === 'ICC_PROFILE\0') {
      const sequence = segment[12],
        count = segment[13]
      if (
        !sequence ||
        !count ||
        sequence > count ||
        (chunkCount && count !== chunkCount) ||
        chunks.has(sequence)
      )
        throw new Error('The JPEG color profile is incomplete or corrupted.')
      chunkCount = count
      chunks.set(sequence, segment.subarray(14))
    }
    offset += length
  }
  if (!width || !height || ![1, 3, 4].includes(channels))
    throw new Error('The JPEG dimensions or colors are unsupported.')
  let profile: Uint8Array | undefined
  if (chunkCount) {
    if (chunks.size !== chunkCount)
      throw new Error('The JPEG color profile is incomplete or corrupted.')
    profile = new Uint8Array([...chunks.values()].reduce((total, chunk) => total + chunk.length, 0))
    let offset = 0
    for (let sequence = 1; sequence <= chunkCount; sequence++) {
      const chunk = chunks.get(sequence)!
      profile.set(chunk, offset)
      offset += chunk.length
    }
    const expected = channels === 4 ? 'CMYK' : channels === 3 ? 'RGB ' : 'GRAY'
    if (
      profile.length < 128 ||
      text(profile, 36, 4) !== 'acsp' ||
      text(profile, 16, 4) !== expected
    )
      throw new Error('The JPEG color profile does not match its image colors.')
  }
  return { width, height, channels: channels as 1 | 3 | 4, orientation, adobe, profile }
}

export function getCardJpegPlacement(info: CardJpegInfo): {
  width: number
  height: number
  matrix: number[]
} {
  const { width: w, height: h, orientation } = info
  const matrices = [
    [w, 0, 0, h, 0, 0],
    [-w, 0, 0, h, w, 0],
    [-w, 0, 0, -h, w, h],
    [w, 0, 0, -h, 0, h],
    [0, -w, -h, 0, h, w],
    [0, -w, h, 0, 0, w],
    [0, w, h, 0, 0, 0],
    [0, w, -h, 0, h, 0]
  ]
  return {
    width: orientation >= 5 ? h : w,
    height: orientation >= 5 ? w : h,
    matrix: matrices[orientation - 1]
  }
}

// Use the same ICC-tagged, lossless JPEG representation for preview and output.
// A browser canvas conversion can brighten CMYK artwork and discard the profile.
export async function createCardJpegPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const info = readCardJpegInfo(bytes)
  const doc = await PDFDocument.create()
  const image = await doc.embedJpg(new Uint8Array(bytes))
  await image.embed()
  const stream = doc.context.lookup(image.ref, PDFStream)
  if (info.channels === 4 && !info.adobe) stream.dict.delete(PDFName.of('Decode'))
  if (info.profile) {
    const profile = doc.context.register(
      doc.context.flateStream(info.profile, {
        N: info.channels,
        Alternate:
          info.channels === 4 ? 'DeviceCMYK' : info.channels === 3 ? 'DeviceRGB' : 'DeviceGray'
      })
    )
    stream.dict.set(PDFName.of('ColorSpace'), doc.context.obj(['ICCBased', profile]))
  }
  const placement = getCardJpegPlacement(info)
  const page = doc.addPage([placement.width, placement.height])
  const key = page.node.newXObject('CardJpeg', image.ref)
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(
      ...(placement.matrix as [number, number, number, number, number, number])
    ),
    drawObject(key),
    popGraphicsState()
  )
  return doc.save()
}

export async function loadCardJpegArtwork(file: File): Promise<CardArtwork> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const info = readCardJpegInfo(bytes)
  if (info.width * info.height > 40_000_000)
    throw new Error('This image is too large to preview. Resize it below 40 megapixels.')
  const encode = (data: Uint8Array) => {
    let binary = ''
    for (let offset = 0; offset < data.length; offset += 8192)
      binary += String.fromCharCode(...data.subarray(offset, offset + 8192))
    return btoa(binary)
  }
  const placement = getCardJpegPlacement(info)
  const { loadPdfDocument, destroyPdfDocument } =
    await import('../../booklet-montage/lib/pdfWorker')
  const pdf = await loadPdfDocument(await createCardJpegPdf(bytes), undefined, true)
  const canvas = document.createElement('canvas')
  try {
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({
      scale: Math.min(2, 1200 / Math.max(placement.width, placement.height))
    })
    canvas.width = Math.max(1, Math.ceil(viewport.width))
    canvas.height = Math.max(1, Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the image preview.')
    await page.render({ canvas, canvasContext: context, viewport }).promise
    return {
      name: file.name,
      kind: 'jpeg',
      bytesBase64: encode(bytes),
      pageNumber: 1,
      pageCount: 1,
      previewDataUrl: canvas.toDataURL('image/png'),
      widthMm: (placement.width * 25.4) / 300,
      heightMm: (placement.height * 25.4) / 300
    }
  } finally {
    canvas.width = canvas.height = 0
    await destroyPdfDocument(pdf)
  }
}
