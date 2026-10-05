export const MAX_EPS_BYTES = 30 * 1024 * 1024
export const EPS_CONVERSION_ERROR =
  'Could not import EPS. Check that Adobe Illustrator is installed and activated, close its dialogs, and use embedded images and installed or outlined fonts. You can also export the design as PDF.'

export interface EpsImportRequest {
  fileName: string
  bytes: Uint8Array
}

export type EpsImportResult = { ok: true; bytesBase64: string } | { ok: false; error: string }

export function getEpsDimensions(bytes: Uint8Array): { widthPt: number; heightPt: number } {
  let section = bytes
  if (bytes[0] === 0xc5) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const offset = view.getUint32(4, true)
    section = bytes.subarray(offset, offset + view.getUint32(8, true))
  }
  const text = new TextDecoder('ascii').decode(section)
  for (const tag of ['HiResBoundingBox', 'BoundingBox']) {
    const matches = text.matchAll(
      new RegExp(
        `^%%${tag}:\\s*([-+\\d.eE]+)[ \\t]+([-+\\d.eE]+)[ \\t]+([-+\\d.eE]+)[ \\t]+([-+\\d.eE]+)[ \\t]*\\r?$`,
        'gm'
      )
    )
    for (const match of matches) {
      const [left, bottom, right, top] = match.slice(1).map(Number)
      if ([left, bottom, right, top].every(Number.isFinite) && right > left && top > bottom)
        return { widthPt: right - left, heightPt: top - bottom }
    }
  }
  throw new Error('The EPS has no valid bounding box. Export it as PDF from the original design.')
}

export function assertEpsImportRequest(value: unknown): asserts value is EpsImportRequest {
  const request = value as Partial<EpsImportRequest> | null
  if (
    !request ||
    typeof request.fileName !== 'string' ||
    !/\.eps$/i.test(request.fileName) ||
    !(request.bytes instanceof Uint8Array)
  )
    throw new Error('Choose an EPS design.')
  const bytes = request.bytes
  if (!bytes.length) throw new Error('This EPS file is empty.')
  if (bytes.length > MAX_EPS_BYTES) throw new Error('Choose a design smaller than 30 MB.')

  // DOS EPS files wrap the PostScript section with a binary preview header.
  let postScript = bytes
  if (bytes[0] === 0xc5 && bytes[1] === 0xd0 && bytes[2] === 0xd3 && bytes[3] === 0xc6) {
    if (bytes.length < 30) throw new Error('This EPS file has an invalid preview header.')
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const offset = view.getUint32(4, true)
    const length = view.getUint32(8, true)
    if (offset < 30 || !length || offset + length > bytes.length)
      throw new Error('This EPS file has an invalid PostScript section.')
    postScript = bytes.subarray(offset, offset + length)
  }
  const header = String.fromCharCode(...postScript.subarray(0, 256)).split(/[\r\n]/)[0]
  if (!/^%!PS-Adobe-\S+\s+EPSF-\S+/.test(header))
    throw new Error('This file is not a supported EPS design.')
}
