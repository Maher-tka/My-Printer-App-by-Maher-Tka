import ClipperLib from 'clipper-lib'
import { traceMask, type StickerMakerResult } from './stickerMaker'

export interface PngWhiteContourSettings {
  widthMm: number
  borderMm: number
  insetMm: number
}

export const DEFAULT_PNG_WHITE_CONTOUR: PngWhiteContourSettings = {
  widthMm: 80,
  borderMm: 3,
  insetMm: 1
}

export function validatePngWhiteContourSettings(settings: PngWhiteContourSettings): void {
  if (
    !Number.isFinite(settings.widthMm) ||
    settings.widthMm < 5 ||
    settings.widthMm > 900 ||
    !Number.isFinite(settings.borderMm) ||
    settings.borderMm < 0.5 ||
    settings.borderMm > 20 ||
    !Number.isFinite(settings.insetMm) ||
    settings.insetMm < 0.2 ||
    settings.insetMm > settings.borderMm - 0.2
  )
    throw new Error('Keep at least 0.2 mm inside the white edge and 0.2 mm outside the artwork.')
}

/** Millimetre geometry shared by the visible white artwork and the independent cut path. */
export function makePngWhiteContourGeometry(
  mask: Uint8Array,
  width: number,
  height: number,
  sourceHeightMm: number,
  paddingMm: number,
  settings: PngWhiteContourSettings
): { whitePath: string; cutPath: string; regions: number } {
  validatePngWhiteContourSettings(settings)
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    mask.length !== width * height ||
    !Number.isFinite(sourceHeightMm) ||
    sourceHeightMm <= 0 ||
    !Number.isFinite(paddingMm) ||
    paddingMm < settings.borderMm
  )
    throw new Error('Invalid PNG contour dimensions.')
  const paths = traceMask(mask, width, height, 128)
    .filter((path) => ClipperLib.Clipper.Area(path) > 0)
    .map((path) =>
      path.map((p) => ({
        X: Math.round(((p.X * settings.widthMm) / width) * 1000),
        Y: Math.round(((p.Y * sourceHeightMm) / height) * 1000)
      }))
    )
  if (!paths.length) throw new Error('The PNG has no usable visible artwork.')
  const totalW = settings.widthMm + paddingMm * 2
  const totalH = sourceHeightMm + paddingMm * 2
  const offset = (mm: number) => {
    const offsetter = new ClipperLib.ClipperOffset(2, 20)
    offsetter.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
    const output: ClipperLib.Paths = []
    offsetter.Execute(output, mm * 1000)
    return output
      .filter((path) => ClipperLib.Clipper.Area(path) > 0)
      .map(
        (path) =>
          path
            .map(
              (p, i) =>
                `${i ? 'L' : 'M'} ${((p.X / 1000 + paddingMm) / totalW).toFixed(7)} ${((p.Y / 1000 + paddingMm) / totalH).toFixed(7)}`
            )
            .join(' ') + ' Z'
      )
      .join(' ')
  }
  return {
    whitePath: offset(settings.borderMm),
    cutPath: offset(settings.borderMm - settings.insetMm),
    regions: paths.length
  }
}

/** Local alpha tracing only: the original PNG is never rewritten or sent to AI. */
export async function createPngWhiteContour(
  file: File,
  settings: PngWhiteContourSettings
): Promise<StickerMakerResult> {
  validatePngWhiteContourSettings(settings)
  if (!/\.png$/i.test(file.name) || file.size > 65 * 1024 * 1024)
    throw new Error('Choose a PNG file smaller than 65 MB.')
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (signature.join(',') !== '137,80,78,71,13,10,26,10')
    throw new Error('Choose a valid PNG file.')
  const bitmap = await createImageBitmap(file)
  const canvases: HTMLCanvasElement[] = []
  const canvas = (width: number, height: number) => {
    const value = document.createElement('canvas')
    value.width = width
    value.height = height
    canvases.push(value)
    return value
  }
  try {
    const w = bitmap.width,
      h = bitmap.height
    const padding = Math.ceil((settings.borderMm * w) / settings.widthMm) + 1
    const outW = w + padding * 2,
      outH = h + padding * 2
    if (!w || !h || outW > 16000 || outH > 16000 || outW * outH > 24_000_000)
      throw new Error('The bordered PNG exceeds 24 megapixels. Use a smaller image.')
    const scale = Math.min(1, 1024 / Math.max(w, h))
    const cw = Math.max(1, Math.round(w * scale)),
      ch = Math.max(1, Math.round(h * scale))
    const small = canvas(cw, ch)
    const smallCtx = small.getContext('2d', { willReadFrequently: true })
    if (!smallCtx) throw new Error('Canvas processing is unavailable.')
    smallCtx.drawImage(bitmap, 0, 0, cw, ch)
    const pixels = smallCtx.getImageData(0, 0, cw, ch).data
    const mask = new Uint8Array(cw * ch)
    let transparent = false
    for (let i = 0; i < mask.length; i++) {
      mask[i] = pixels[i * 4 + 3]
      if (mask[i] < 128) transparent = true
    }
    if (!transparent)
      throw new Error(
        'This PNG has no transparent background. Remove its background in AI Sticker Maker first.'
      )
    const mmPerPx = settings.widthMm / w
    const geometry = makePngWhiteContourGeometry(
      mask,
      cw,
      ch,
      h * mmPerPx,
      padding * mmPerPx,
      settings
    )
    const artwork = canvas(outW, outH)
    const ctx = artwork.getContext('2d')
    if (!ctx) throw new Error('Canvas processing is unavailable.')
    ctx.save()
    ctx.scale(outW, outH)
    ctx.fillStyle = '#ffffff'
    ctx.fill(new Path2D(geometry.whitePath))
    ctx.restore()
    ctx.drawImage(bitmap, padding, padding)
    const blob = await new Promise<Blob>((resolve, reject) =>
      artwork.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('PNG encoding failed.'))),
        'image/png'
      )
    )
    return {
      fileName: file.name,
      png: new Uint8Array(await blob.arrayBuffer()),
      widthPx: outW,
      heightPx: outH,
      widthMm: outW * mmPerPx,
      heightMm: outH * mmPerPx,
      pathData: geometry.cutPath,
      contourMask: mask,
      contourWidth: cw,
      contourHeight: ch,
      preserveArtworkBleed: true,
      warnings:
        geometry.regions > 1
          ? ['Disconnected artwork may create multiple cut contours. Review the pink lines.']
          : []
    }
  } finally {
    bitmap.close()
    for (const value of canvases) value.width = value.height = 0
  }
}
