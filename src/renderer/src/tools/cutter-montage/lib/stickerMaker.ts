import ClipperLib from 'clipper-lib'

export interface StickerMakerSettings {
  offsetMm: number
  threshold: number
  smoothing: number
  widthMm: number
}

export interface StickerMakerResult {
  fileName: string
  png: Uint8Array
  widthPx: number
  heightPx: number
  widthMm: number
  heightMm: number
  pathData: string
  contourMask: Uint8Array
  contourWidth: number
  contourHeight: number
  warnings: string[]
}

export type StickerMaskBrushMode = 'erase' | 'restore'
export type StickerBackgroundMode = 'auto' | 'remove' | 'keep'

/** A transparent source can supply its own cut mask without model inference. */
export function shouldRemoveStickerBackground(
  rgba: Uint8ClampedArray,
  mode: StickerBackgroundMode
): boolean {
  if (mode !== 'auto') return mode === 'remove'
  for (let index = 3; index < rgba.length; index += 4) {
    if (rgba[index] < 255) return false
  }
  return true
}

/** Paint one stroke into a working mask. Callers keep a copy for undo. */
export function paintStickerMaskStroke(
  mask: Uint8Array,
  width: number,
  height: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  diameter: number,
  hardness: number,
  mode: StickerMaskBrushMode
): void {
  if (mask.length !== width * height || diameter <= 0) return
  const radius = diameter / 2
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(1, Math.ceil(length / Math.max(1, radius / 2)))
  for (let step = 0; step <= steps; step += 1) {
    const x = from.x + ((to.x - from.x) * step) / steps
    const y = from.y + ((to.y - from.y) * step) / steps
    const left = Math.max(0, Math.floor(x - radius))
    const right = Math.min(width - 1, Math.ceil(x + radius))
    const top = Math.max(0, Math.floor(y - radius))
    const bottom = Math.min(height - 1, Math.ceil(y + radius))
    for (let py = top; py <= bottom; py += 1) {
      for (let px = left; px <= right; px += 1) {
        const distance = Math.hypot(px + 0.5 - x, py + 0.5 - y)
        if (distance > radius) continue
        const solidRadius = radius * Math.max(0, Math.min(1, hardness))
        const strength =
          distance <= solidRadius
            ? 1
            : Math.max(0, (radius - distance) / Math.max(0.001, radius - solidRadius))
        const index = py * width + px
        const current = mask[index]
        mask[index] = Math.round(
          mode === 'restore' ? current + (255 - current) * strength : current * (1 - strength)
        )
      }
    }
  }
}

const MODEL = 'studioludens/birefnet-lite-512'
let segmenterPromise: Promise<unknown> | undefined

async function getSegmenter(onStatus: (message: string) => void): Promise<unknown> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { env, pipeline } = await import('@huggingface/transformers')
      env.useBrowserCache = true
      onStatus('Loading local AI model (first use downloads about 192 MB)…')
      return pipeline('background-removal', MODEL, {
        device: 'wasm',
        dtype: 'fp32',
        progress_callback: (event: { status?: string; progress?: number }) => {
          if (event.status === 'progress' && Number.isFinite(event.progress)) {
            onStatus(`Downloading AI model ${Math.round(event.progress!)}%`)
          }
        }
      })
    })().catch((error) => {
      segmenterPromise = undefined
      throw error
    })
  }
  return segmenterPromise
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    // decode() retains the decoded bitmap after releasing the source URL.
    URL.revokeObjectURL(url)
  }
}

function simplify(points: Array<{ X: number; Y: number }>, epsilon: number) {
  if (points.length < 4) return points
  const result: typeof points = []
  for (let i = 0; i < points.length; i += 1) {
    const previous = points[(i + points.length - 1) % points.length]
    const current = points[i]
    const next = points[(i + 1) % points.length]
    const cross = Math.abs(
      (current.X - previous.X) * (next.Y - current.Y) -
        (current.Y - previous.Y) * (next.X - current.X)
    )
    if (cross > epsilon) result.push(current)
  }
  return result.length >= 3 ? result : points
}

/** Trace the outside of a thresholded mask on a bounded preview grid. */
export function traceMask(mask: Uint8Array, width: number, height: number, threshold: number) {
  const edges = new Map<string, Array<{ X: number; Y: number }>>()
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] >= threshold
  const add = (ax: number, ay: number, bx: number, by: number) => {
    const key = `${ax},${ay}`
    const list = edges.get(key) ?? []
    list.push({ X: bx, Y: by })
    edges.set(key, list)
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!opaque(x, y)) continue
      if (!opaque(x, y - 1)) add(x, y, x + 1, y)
      if (!opaque(x + 1, y)) add(x + 1, y, x + 1, y + 1)
      if (!opaque(x, y + 1)) add(x + 1, y + 1, x, y + 1)
      if (!opaque(x - 1, y)) add(x, y + 1, x, y)
    }
  }
  const paths: Array<Array<{ X: number; Y: number }>> = []
  while (edges.size) {
    const first = edges.keys().next().value as string
    const [x, y] = first.split(',').map(Number)
    const path = [{ X: x, Y: y }]
    let current = first
    for (let safety = 0; safety < width * height * 4 + 1; safety += 1) {
      const list = edges.get(current)
      if (!list?.length) break
      const next = list.pop()!
      if (!list.length) edges.delete(current)
      current = `${next.X},${next.Y}`
      if (current === first) break
      path.push(next)
    }
    if (path.length >= 4) paths.push(path)
  }
  return paths
}

export function makeOffsetPath(
  mask: Uint8Array,
  width: number,
  height: number,
  settings: StickerMakerSettings
): { pathData: string; warnings: string[] } {
  if (
    !Number.isFinite(settings.widthMm) ||
    settings.widthMm <= 0 ||
    !Number.isFinite(settings.offsetMm) ||
    settings.offsetMm < 0 ||
    !Number.isFinite(settings.threshold) ||
    settings.threshold < 1 ||
    settings.threshold > 254 ||
    !Number.isFinite(settings.smoothing) ||
    settings.smoothing < 0 ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    mask.length !== width * height
  ) {
    throw new Error('Sticker dimensions, offset, or mask are invalid.')
  }
  const traced = traceMask(mask, width, height, settings.threshold)
  const significant = traced.filter((path) => Math.abs(ClipperLib.Clipper.Area(path)) >= 16)
  const exteriorCount = significant.filter((path) => ClipperLib.Clipper.Area(path) > 0).length
  if (!significant.length) throw new Error('No usable foreground was found. Review the mask.')
  const offsetPx = (settings.offsetMm * width) / settings.widthMm
  const offsetter = new ClipperLib.ClipperOffset(2, 0.25)
  offsetter.AddPaths(significant, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
  const output: Array<Array<{ X: number; Y: number }>> = []
  offsetter.Execute(output, offsetPx)
  const outer = output.filter((path) => ClipperLib.Clipper.Area(path) > 0)
  if (!outer.length) throw new Error('The cut offset did not produce a closed contour.')
  const totalW = width + 2 * offsetPx
  const totalH = height + 2 * offsetPx
  const pathData = outer
    .map((path) => {
      const nodes = simplify(path, settings.smoothing)
      return (
        nodes
          .map(
            (node, index) =>
              `${index ? 'L' : 'M'} ${((node.X + offsetPx) / totalW).toFixed(6)} ${((node.Y + offsetPx) / totalH).toFixed(6)}`
          )
          .join(' ') + ' Z'
      )
    })
    .join(' ')
  return {
    pathData,
    warnings: exteriorCount > 1 ? [`${exteriorCount} separate foreground regions found.`] : []
  }
}

export function geometryOrReviewWarning(
  mask: Uint8Array,
  width: number,
  height: number,
  settings: StickerMakerSettings
): { pathData: string; warnings: string[] } {
  try {
    return makeOffsetPath(mask, width, height, settings)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('No usable foreground')) {
      return {
        pathData: '',
        warnings: ['No usable foreground found. Use the Restore brush in Mask view.']
      }
    }
    throw error
  }
}

function getMaskQualityWarnings(alpha: Uint8Array, threshold: number): string[] {
  const retained = alpha.reduce((count, value) => count + Number(value >= threshold), 0)
  const retainedFraction = retained / alpha.length
  return [
    ...(retainedFraction > 0.9
      ? ['More than 90% of the image remains opaque; review the mask.']
      : []),
    ...(retainedFraction < 0.02 ? ['Less than 2% of the image remains; review the mask.'] : [])
  ]
}

export async function processSticker(
  file: File,
  settings: StickerMakerSettings,
  onStatus: (message: string) => void,
  backgroundMode: StickerBackgroundMode = 'auto'
): Promise<StickerMakerResult> {
  const image = await loadImage(file)
  const widthPx = image.naturalWidth
  const heightPx = image.naturalHeight
  if (!widthPx || !heightPx || widthPx * heightPx > 80_000_000) {
    throw new Error('Image dimensions are invalid or exceed the 80 megapixel processing limit.')
  }
  const sourceCanvas = makeCanvas(widthPx, heightPx)
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas processing is unavailable.')
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, widthPx, heightPx)
  if (shouldRemoveStickerBackground(pixels.data, backgroundMode)) {
    const segmenter = (await getSegmenter(onStatus)) as (input: string) => Promise<unknown[]>
    onStatus(`Removing background from ${file.name}…`)
    const source = URL.createObjectURL(file)
    let prediction: unknown
    try {
      prediction = (await segmenter(source))[0]
    } finally {
      URL.revokeObjectURL(source)
    }
    const maskCanvas = await (
      prediction as { toCanvas: () => Promise<HTMLCanvasElement> }
    ).toCanvas()
    const fullMask = makeCanvas(widthPx, heightPx)
    const maskCtx = fullMask.getContext('2d', { willReadFrequently: true })
    if (!maskCtx) throw new Error('Mask processing is unavailable.')
    maskCtx.drawImage(maskCanvas, 0, 0, widthPx, heightPx)
    const maskPixels = maskCtx.getImageData(0, 0, widthPx, heightPx).data
    for (let i = 0; i < widthPx * heightPx; i += 1) {
      pixels.data[i * 4 + 3] = Math.round((pixels.data[i * 4 + 3] * maskPixels[i * 4 + 3]) / 255)
    }
    ctx.putImageData(pixels, 0, 0)
  } else {
    onStatus(`Using existing artwork for ${file.name}…`)
  }
  const contourScale = Math.min(1, 1024 / Math.max(widthPx, heightPx))
  const contourW = Math.max(1, Math.round(widthPx * contourScale))
  const contourH = Math.max(1, Math.round(heightPx * contourScale))
  const small = makeCanvas(contourW, contourH)
  const smallCtx = small.getContext('2d', { willReadFrequently: true })!
  smallCtx.drawImage(sourceCanvas, 0, 0, contourW, contourH)
  const smallPixels = smallCtx.getImageData(0, 0, contourW, contourH).data
  const alpha = new Uint8Array(contourW * contourH)
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = smallPixels[i * 4 + 3]
  const geometry = geometryOrReviewWarning(alpha, contourW, contourH, settings)
  const qualityWarnings = getMaskQualityWarnings(alpha, settings.threshold)
  const pngBlob = await new Promise<Blob>((resolve, reject) =>
    sourceCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))),
      'image/png'
    )
  )
  return {
    fileName: file.name,
    png: new Uint8Array(await pngBlob.arrayBuffer()),
    widthPx,
    heightPx,
    widthMm: settings.widthMm,
    heightMm: (settings.widthMm * heightPx) / widthPx,
    pathData: geometry.pathData,
    contourMask: alpha,
    contourWidth: contourW,
    contourHeight: contourH,
    warnings: [...geometry.warnings, ...qualityWarnings]
  }
}

export function updateStickerCutline(
  result: StickerMakerResult,
  settings: StickerMakerSettings
): StickerMakerResult {
  const geometry = geometryOrReviewWarning(
    result.contourMask,
    result.contourWidth,
    result.contourHeight,
    settings
  )
  return {
    ...result,
    widthMm: settings.widthMm,
    heightMm: (settings.widthMm * result.heightPx) / result.widthPx,
    pathData: geometry.pathData,
    warnings: [
      ...geometry.warnings,
      ...getMaskQualityWarnings(result.contourMask, settings.threshold)
    ]
  }
}

/** Rebuild full-resolution RGBA artwork from the untouched source and edited mask. */
export async function rebuildStickerFromMask(
  file: File,
  result: StickerMakerResult,
  mask: Uint8Array,
  settings: StickerMakerSettings
): Promise<StickerMakerResult> {
  if (mask.length !== result.contourWidth * result.contourHeight) {
    throw new Error('Edited mask dimensions do not match the sticker.')
  }
  const image = await loadImage(file)
  if (image.naturalWidth !== result.widthPx || image.naturalHeight !== result.heightPx) {
    throw new Error('The original image dimensions changed. Reprocess the sticker.')
  }
  const artwork = makeCanvas(result.widthPx, result.heightPx)
  const artworkContext = artwork.getContext('2d', { willReadFrequently: true })
  if (!artworkContext) throw new Error('Artwork canvas is unavailable.')
  artworkContext.drawImage(image, 0, 0)
  const smallMask = makeCanvas(result.contourWidth, result.contourHeight)
  const smallContext = smallMask.getContext('2d', { willReadFrequently: true })
  if (!smallContext) throw new Error('Mask canvas is unavailable.')
  // Clamp against the untouched source, avoiding repeated resampling of edited masks.
  smallContext.drawImage(artwork, 0, 0, result.contourWidth, result.contourHeight)
  const sourcePixels = smallContext.getImageData(
    0,
    0,
    result.contourWidth,
    result.contourHeight
  ).data
  const effectiveMask = new Uint8Array(mask.length)
  const maskImage = smallContext.createImageData(result.contourWidth, result.contourHeight)
  for (let index = 0; index < mask.length; index += 1) {
    effectiveMask[index] = Math.min(mask[index], sourcePixels[index * 4 + 3])
    maskImage.data[index * 4] = 255
    maskImage.data[index * 4 + 1] = 255
    maskImage.data[index * 4 + 2] = 255
    maskImage.data[index * 4 + 3] = effectiveMask[index]
  }
  smallContext.putImageData(maskImage, 0, 0)
  const fullMask = makeCanvas(result.widthPx, result.heightPx)
  const fullMaskContext = fullMask.getContext('2d', { willReadFrequently: true })
  if (!fullMaskContext) throw new Error('Artwork canvas is unavailable.')
  fullMaskContext.drawImage(smallMask, 0, 0, result.widthPx, result.heightPx)
  const artworkPixels = artworkContext.getImageData(0, 0, result.widthPx, result.heightPx)
  const maskPixels = fullMaskContext.getImageData(0, 0, result.widthPx, result.heightPx).data
  for (let index = 0; index < result.widthPx * result.heightPx; index += 1) {
    artworkPixels.data[index * 4 + 3] = Math.min(
      artworkPixels.data[index * 4 + 3],
      maskPixels[index * 4 + 3]
    )
  }
  artworkContext.putImageData(artworkPixels, 0, 0)
  const png = await new Promise<Blob>((resolve, reject) =>
    artwork.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))),
      'image/png'
    )
  )
  const geometry = geometryOrReviewWarning(
    effectiveMask,
    result.contourWidth,
    result.contourHeight,
    settings
  )
  return {
    ...result,
    png: new Uint8Array(await png.arrayBuffer()),
    contourMask: effectiveMask,
    pathData: geometry.pathData,
    widthMm: settings.widthMm,
    heightMm: (settings.widthMm * result.heightPx) / result.widthPx,
    warnings: [...geometry.warnings, ...getMaskQualityWarnings(effectiveMask, settings.threshold)]
  }
}
