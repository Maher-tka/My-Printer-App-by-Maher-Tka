import { hasPdfSignature, bytesToArrayBuffer } from './sourcePreview'
import type { StickerMakerResult } from './stickerMaker'

export interface StickerBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface StickerSheetSettings {
  mode: 'auto' | 'grid'
  rows: number
  columns: number
  joinPercent: number
  paddingPercent: number
  removeBackground: boolean
}

export const DEFAULT_STICKER_SHEET_SETTINGS: StickerSheetSettings = {
  mode: 'auto',
  rows: 2,
  columns: 2,
  joinPercent: 1.5,
  paddingPercent: 0.2,
  removeBackground: true
}

function sheetBackground(rgba: Uint8ClampedArray, width: number, height: number): number[] | null {
  let transparent = 0
  const colors = new Map<string, { count: number; color: number[] }>()
  const sample = (x: number, y: number) => {
    const offset = (y * width + x) * 4
    if (rgba[offset + 3] < 32) {
      transparent++
      return
    }
    const color = Array.from(rgba.subarray(offset, offset + 3))
    const key = color.map((value) => Math.round(value / 16)).join(',')
    const entry = colors.get(key) ?? { count: 0, color }
    entry.count++
    colors.set(key, entry)
  }
  for (let x = 0; x < width; x++) {
    sample(x, 0)
    sample(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    sample(0, y)
    sample(width - 1, y)
  }
  if (transparent > (width + height) / 2) return null
  // Screenshots can have a thin outer frame in a different color from the paper.
  colors.clear()
  const step = Math.max(1, Math.floor(Math.sqrt(width * height) / 160))
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) sample(x, y)
  return [...colors.values()].sort((a, b) => b.count - a.count)[0]?.color ?? null
}

function isSheetBackground(
  rgba: Uint8ClampedArray,
  index: number,
  background: number[] | null
): boolean {
  if (rgba[index * 4 + 3] < 24) return true
  return (
    background !== null &&
    background.every((value, channel) => Math.abs(rgba[index * 4 + channel] - value) <= 24)
  )
}

/** Detect artwork against transparency or the dominant plain edge color. */
export function stickerSheetForeground(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  if (rgba.length !== width * height * 4) throw new Error('Invalid sheet pixels.')
  const background = sheetBackground(rgba, width, height)
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) {
    mask[i] = Number(!isSheetBackground(rgba, i, background))
  }
  return mask
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (!radius) return mask.slice()
  const horizontal = new Uint8Array(mask.length)
  const result = new Uint8Array(mask.length)
  for (let y = 0; y < height; y++) {
    let sum = 0
    for (let x = -radius; x < width; x++) {
      if (x + radius < width) sum += mask[y * width + x + radius]
      if (x - radius - 1 >= 0) sum -= mask[y * width + x - radius - 1]
      if (x >= 0) horizontal[y * width + x] = Number(sum > 0)
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = -radius; y < height; y++) {
      if (y + radius < height) sum += horizontal[(y + radius) * width + x]
      if (y - radius - 1 >= 0) sum -= horizontal[(y - radius - 1) * width + x]
      if (y >= 0) result[y * width + x] = Number(sum > 0)
    }
  }
  return result
}

/** Bounded thumbnail connected components; nearby letters can be joined without changing artwork. */
export function findStickerSheetBounds(
  mask: Uint8Array,
  width: number,
  height: number,
  settings: StickerSheetSettings
): StickerBounds[] {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 4_000_000 ||
    mask.length !== width * height
  )
    throw new Error('Invalid sheet dimensions.')
  if (
    !Number.isFinite(settings.paddingPercent) ||
    settings.paddingPercent < 0 ||
    settings.paddingPercent > 5 ||
    !Number.isFinite(settings.joinPercent) ||
    settings.joinPercent < 0 ||
    settings.joinPercent > 5
  )
    throw new Error('Invalid sheet separation settings.')
  const longest = Math.max(width, height)
  const padding = Math.round((longest * settings.paddingPercent) / 100)
  if (settings.mode === 'grid') {
    if (
      !Number.isSafeInteger(settings.rows) ||
      !Number.isSafeInteger(settings.columns) ||
      settings.rows < 1 ||
      settings.columns < 1 ||
      settings.rows * settings.columns > 500
    )
      throw new Error('Choose a grid with 1 to 500 cells.')
    const bounds: StickerBounds[] = []
    for (let row = 0; row < settings.rows; row++)
      for (let col = 0; col < settings.columns; col++) {
        const x = Math.floor((col * width) / settings.columns),
          y = Math.floor((row * height) / settings.rows)
        const right = Math.floor(((col + 1) * width) / settings.columns),
          bottom = Math.floor(((row + 1) * height) / settings.rows)
        let occupied = false
        for (let py = y; py < bottom && !occupied; py++)
          for (let px = x; px < right; px++)
            if (mask[py * width + px]) {
              occupied = true
              break
            }
        if (occupied) bounds.push({ x, y, width: right - x, height: bottom - y })
      }
    return bounds
  }
  const grown = dilate(mask, width, height, Math.round((longest * settings.joinPercent) / 200))
  const queue = new Int32Array(mask.length)
  const bounds: StickerBounds[] = []
  const frames = new Set<StickerBounds>()
  for (let start = 0; start < grown.length; start++) {
    if (!grown[start]) continue
    let head = 0,
      tail = 1,
      left = width,
      top = height,
      right = -1,
      bottom = -1,
      pixels = 0
    queue[0] = start
    grown[start] = 0
    while (head < tail) {
      const index = queue[head++],
        x = index % width,
        y = Math.floor(index / width)
      if (mask[index]) {
        pixels++
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
      const visit = (next: number) => {
        if (grown[next]) {
          grown[next] = 0
          queue[tail++] = next
        }
      }
      if (x > 0) visit(index - 1)
      if (x + 1 < width) visit(index + 1)
      if (y > 0) visit(index - width)
      if (y + 1 < height) visit(index + width)
    }
    if (pixels < Math.max(4, Math.round(mask.length * 0.000005))) continue
    const x = Math.max(0, left - padding),
      y = Math.max(0, top - padding)
    const bound = {
      x,
      y,
      width: Math.min(width, right + padding + 1) - x,
      height: Math.min(height, bottom + padding + 1) - y
    }
    bounds.push(bound)
    if (bound.width >= width * 0.95 && bound.height >= height * 0.95 && pixels < mask.length * 0.1)
      frames.add(bound)
    if (bounds.length > 500)
      throw new Error('Too many separate parts. Increase Join nearby parts or use Grid.')
  }
  // Reading order remains left-to-right for production, independent of interface language.
  return bounds
    .filter((bound) => bounds.length === 1 || !frames.has(bound))
    .sort((a, b) =>
      Math.abs(a.y - b.y) < Math.min(a.height, b.height) / 2 ? a.x - b.x : a.y - b.y
    )
}

async function canvasFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))),
      'image/png'
    )
  )
  return new File([blob], name, { type: 'image/png' })
}

export interface StickerSheetPage {
  file: File
  widthMm?: number
  vectorArtwork?: StickerMakerResult['vectorArtwork']
  pdfSheet?: { bytes: Uint8Array; pageNumber: number }
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function rasterizeVectorFile(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  const canvas = document.createElement('canvas')
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(4, 4096 / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.ceil(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.ceil(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas processing is unavailable.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvasFile(canvas, file.name.replace(/\.[^.]+$/, '.png'))
  } finally {
    URL.revokeObjectURL(url)
    canvas.width = canvas.height = 0
  }
}

/** Render one page at a time at up to 300 DPI; keep page dimensions for proportional crops. */
export async function importStickerSheetPages(
  file: File,
  onPage: (page: StickerSheetPage) => void,
  shouldStop: () => boolean
): Promise<void> {
  if (!file.size || file.size > 65 * 1024 * 1024)
    throw new Error('Choose artwork smaller than 65 MB.')
  if (/\.ai$/i.test(file.name)) {
    const importer = window.printerApp?.runtime?.importStickerVectors
    if (!importer)
      throw new Error(
        'Native AI sticker import requires the desktop app and Adobe Illustrator. Use a PDF to import printable pages instead.'
      )
    const result = await importer({
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer())
    })
    if (!result.ok) throw new Error(result.error)
    for (const sticker of result.stickers) {
      if (shouldStop()) break
      const svg = fromBase64(sticker.svgBase64),
        pdf = fromBase64(sticker.pdfBase64)
      const rendered = await rasterizeVectorFile(
        new File([bytesToArrayBuffer(svg)], `${sticker.name}.svg`, { type: 'image/svg+xml' })
      )
      onPage({ file: rendered, widthMm: sticker.widthMm, vectorArtwork: { svg, pdf } })
    }
    return
  }
  const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  if (!hasPdfSignature(header)) {
    if (/\.(ai|pdf)$/i.test(file.name))
      throw new Error(
        'Choose a PDF-compatible AI file. Save it with Create PDF Compatible File enabled, or export it as PDF.'
      )
    if (!/\.(png|jpe?g|webp)$/i.test(file.name))
      throw new Error('Choose AI, PDF, PNG, JPG, or WebP artwork.')
    onPage({ file })
    return
  }
  const { loadPdfDocument, destroyPdfDocument } =
    await import('../../booklet-montage/lib/pdfWorker')
  const sourceBytes = new Uint8Array(await file.arrayBuffer())
  const pdf = await loadPdfDocument(sourceBytes)
  try {
    for (let number = 1; number <= pdf.numPages && !shouldStop(); number++) {
      const page = await pdf.getPage(number)
      const canvas = document.createElement('canvas')
      try {
        const actual = page.getViewport({ scale: 1 })
        const scale = Math.min(
          300 / 72,
          5000 / Math.max(actual.width, actual.height),
          Math.sqrt(12_000_000 / (actual.width * actual.height))
        )
        const viewport = page.getViewport({ scale })
        canvas.width = Math.max(1, Math.ceil(viewport.width))
        canvas.height = Math.max(1, Math.ceil(viewport.height))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas processing is unavailable.')
        await page.render({ canvas, canvasContext: context, viewport, background: 'rgba(0,0,0,0)' })
          .promise
        onPage({
          file: await canvasFile(
            canvas,
            `${file.name.replace(/\.[^.]+$/, '')} - page ${number}.png`
          ),
          widthMm: (actual.width * 25.4) / 72,
          pdfSheet: { bytes: sourceBytes, pageNumber: number }
        })
      } finally {
        canvas.width = canvas.height = 0
        page.cleanup()
      }
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  } finally {
    await destroyPdfDocument(pdf)
  }
}

/** The thumbnail only locates crops. Each crop uses the original decoded pixels. */
export async function separateStickerSheet(
  file: File,
  settings: StickerSheetSettings
): Promise<Array<{ file: File; widthFraction: number; bounds: StickerBounds }>> {
  const bitmap = await createImageBitmap(file)
  const preview = document.createElement('canvas'),
    crop = document.createElement('canvas')
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 80_000_000)
      throw new Error('Choose a sheet smaller than 80 megapixels.')
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    preview.width = Math.max(1, Math.round(bitmap.width * scale))
    preview.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = preview.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas processing is unavailable.')
    context.drawImage(bitmap, 0, 0, preview.width, preview.height)
    const previewPixels = context.getImageData(0, 0, preview.width, preview.height).data
    const background = sheetBackground(previewPixels, preview.width, preview.height)
    const foreground = stickerSheetForeground(previewPixels, preview.width, preview.height)
    const bounds = findStickerSheetBounds(foreground, preview.width, preview.height, settings)
    if (!bounds.length)
      throw new Error('No stickers found. Use Grid for white artwork or a busy background.')
    const result: Array<{ file: File; widthFraction: number; bounds: StickerBounds }> = []
    for (const [index, bound] of bounds.entries()) {
      const x = Math.floor((bound.x * bitmap.width) / preview.width),
        y = Math.floor((bound.y * bitmap.height) / preview.height)
      const right = Math.min(
          bitmap.width,
          Math.ceil(((bound.x + bound.width) * bitmap.width) / preview.width)
        ),
        bottom = Math.min(
          bitmap.height,
          Math.ceil(((bound.y + bound.height) * bitmap.height) / preview.height)
        )
      crop.width = right - x
      crop.height = bottom - y
      const cropContext = crop.getContext('2d')
      if (!cropContext) throw new Error('Canvas processing is unavailable.')
      cropContext.drawImage(bitmap, x, y, crop.width, crop.height, 0, 0, crop.width, crop.height)
      if (settings.removeBackground && background) {
        const pixels = cropContext.getImageData(0, 0, crop.width, crop.height)
        const visited = new Uint8Array(crop.width * crop.height)
        const queue = new Int32Array(visited.length)
        let head = 0,
          tail = 0
        const visit = (index: number) => {
          if (visited[index]) return
          visited[index] = 1
          if (!isSheetBackground(pixels.data, index, background)) return
          pixels.data[index * 4 + 3] = 0
          queue[tail++] = index
        }
        for (let x = 0; x < crop.width; x++) {
          visit(x)
          visit((crop.height - 1) * crop.width + x)
        }
        for (let y = 0; y < crop.height; y++) {
          visit(y * crop.width)
          visit(y * crop.width + crop.width - 1)
        }
        while (head < tail) {
          const index = queue[head++],
            x = index % crop.width,
            y = Math.floor(index / crop.width)
          if (x > 0) visit(index - 1)
          if (x + 1 < crop.width) visit(index + 1)
          if (y > 0) visit(index - crop.width)
          if (y + 1 < crop.height) visit(index + crop.width)
        }
        cropContext.putImageData(pixels, 0, 0)
      }
      result.push({
        file: await canvasFile(
          crop,
          `${file.name.replace(/\.[^.]+$/, '')} - sticker ${String(index + 1).padStart(3, '0')}.png`
        ),
        widthFraction: crop.width / bitmap.width,
        bounds: {
          x: x / bitmap.width,
          y: y / bitmap.height,
          width: crop.width / bitmap.width,
          height: crop.height / bitmap.height
        }
      })
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    return result
  } finally {
    bitmap.close()
    preview.width = preview.height = crop.width = crop.height = 0
  }
}

export function stickerExportName(
  fileName: string,
  index: number,
  extension: 'png' | 'pdf' | 'svg'
): string {
  const base =
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/[. ]+$/g, '')
      .slice(0, 110) || 'sticker'
  return `${String(index + 1).padStart(3, '0')}-${base}.${extension}`
}

/** Resize the original vector page without converting its artwork to pixels. */
export async function resizeStickerVectorPdf(
  bytes: Uint8Array,
  widthMm: number
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')
  const source = await PDFDocument.load(bytes)
  const result = await PDFDocument.create()
  const [embedded] = await result.embedPages([source.getPage(0)])
  const width = (widthMm * 72) / 25.4,
    height = (width * embedded.height) / embedded.width
  result.addPage([width, height]).drawPage(embedded, { x: 0, y: 0, width, height })
  return result.save()
}

/** Crop PDF content in displayed page coordinates, retaining vector paths and fonts. */
export async function cropStickerVectorPdf(
  bytes: Uint8Array,
  pageNumber: number,
  bounds: StickerBounds
): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import('pdf-lib')
  const source = await PDFDocument.load(bytes),
    result = await PDFDocument.create()
  const page = source.getPage(pageNumber - 1),
    crop = page.getCropBox()
  const rotation = ((page.getRotation().angle % 360) + 360) % 360
  const point = (u: number, v: number) =>
    rotation === 90
      ? [crop.x + v * crop.width, crop.y + u * crop.height]
      : rotation === 180
        ? [crop.x + (1 - u) * crop.width, crop.y + v * crop.height]
        : rotation === 270
          ? [crop.x + (1 - v) * crop.width, crop.y + (1 - u) * crop.height]
          : [crop.x + u * crop.width, crop.y + (1 - v) * crop.height]
  const points = [
    point(bounds.x, bounds.y),
    point(bounds.x + bounds.width, bounds.y),
    point(bounds.x, bounds.y + bounds.height),
    point(bounds.x + bounds.width, bounds.y + bounds.height)
  ]
  const left = Math.min(...points.map((p) => p[0])),
    right = Math.max(...points.map((p) => p[0])),
    bottom = Math.min(...points.map((p) => p[1])),
    top = Math.max(...points.map((p) => p[1]))
  const embedded = await result.embedPage(page, { left, right, bottom, top })
  const w = right - left,
    h = top - bottom
  const output = result.addPage(rotation % 180 ? [h, w] : [w, h])
  output.drawPage(embedded, {
    x: rotation === 180 ? w : rotation === 270 ? h : 0,
    y: rotation === 90 ? w : rotation === 180 ? h : 0,
    rotate: degrees(-rotation)
  })
  return result.save()
}

export async function stickerPngPdf(
  png: Uint8Array,
  widthMm: number,
  heightMm: number
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const image = await pdf.embedPng(bytesToArrayBuffer(png))
  const width = (widthMm * 72) / 25.4,
    height = (heightMm * 72) / 25.4
  pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height })
  return pdf.save()
}
