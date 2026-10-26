import { hasPdfSignature, bytesToArrayBuffer } from './sourcePreview'
import type { StickerMakerResult } from './stickerMaker'

export interface StickerBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ReviewedStickerBounds extends StickerBounds {
  removeBackground?: boolean
  isolateArtwork?: boolean
  seeds?: Array<{ x: number; y: number }>
}

export interface StickerSheetCrop {
  file: File
  originalFile: File
  widthFraction: number
  bounds: StickerBounds
}

export function splitStickerBounds(bounds: StickerBounds, axis: 'x' | 'y'): StickerBounds[] {
  const b = clampStickerBounds(bounds)
  return axis === 'x'
    ? [
        { ...b, width: b.width / 2 },
        { ...b, x: b.x + b.width / 2, width: b.width / 2 }
      ]
    : [
        { ...b, height: b.height / 2 },
        { ...b, y: b.y + b.height / 2, height: b.height / 2 }
      ]
}

export function clampStickerBounds(bounds: StickerBounds): StickerBounds {
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite))
    throw new Error('Invalid sticker selection.')
  const x = Math.max(0, Math.min(0.999999, bounds.x)),
    y = Math.max(0, Math.min(0.999999, bounds.y))
  return {
    x,
    y,
    width: Math.max(0.000001, Math.min(1 - x, bounds.width)),
    height: Math.max(0.000001, Math.min(1 - y, bounds.height))
  }
}

export function mergeStickerBounds(bounds: StickerBounds[]): StickerBounds {
  if (!bounds.length) throw new Error('Select sticker parts to merge.')
  const left = Math.min(...bounds.map((b) => b.x)),
    top = Math.min(...bounds.map((b) => b.y))
  return clampStickerBounds({
    x: left,
    y: top,
    width: Math.max(...bounds.map((b) => b.x + b.width)) - left,
    height: Math.max(...bounds.map((b) => b.y + b.height)) - top
  })
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
  joinPercent: 0,
  paddingPercent: 0.2,
  removeBackground: true
}

function sheetBackground(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): number[][] | null {
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
  const edges = new Map<string, number>()
  let samples = 0,
    edgeSamples = 0
  const step = Math.max(1, Math.floor(Math.sqrt(width * height) / 160))
  for (let y = 0; y < height; y += step)
    for (let x = 0; x < width; x += step) {
      sample(x, y)
      samples++
      if (x < width * 0.04 || x > width * 0.96 || y < height * 0.04 || y > height * 0.96) {
        const offset = (y * width + x) * 4
        if (rgba[offset + 3] >= 32) {
          const key = [rgba[offset], rgba[offset + 1], rgba[offset + 2]]
            .map((value) => Math.round(value / 16))
            .join(',')
          edges.set(key, (edges.get(key) ?? 0) + 1)
          edgeSamples++
        }
      }
    }
  const ranked = [...colors.values()].sort((a, b) => b.count - a.count)
  const neutralDark = ranked.filter(
    (entry) =>
      Math.max(...entry.color) - Math.min(...entry.color) <= 12 &&
      Math.max(...entry.color) <= 112 &&
      entry.count >= samples * 0.025
  )
  const edgeDark = neutralDark.filter(
    (entry) =>
      (edges.get(entry.color.map((value) => Math.round(value / 16)).join(',')) ?? 0) >=
      edgeSamples * 0.08
  )
  const distinct: number[][] = []
  for (const entry of edgeDark)
    if (
      distinct.every((color) => Math.max(...color.map((v, i) => Math.abs(v - entry.color[i]))) > 24)
    )
      distinct.push(entry.color)
  const darkEdgeCount = edgeDark.reduce(
    (sum, entry) =>
      sum + (edges.get(entry.color.map((value) => Math.round(value / 16)).join(',')) ?? 0),
    0
  )
  if (distinct.length >= 2 && darkEdgeCount >= edgeSamples * 0.33) {
    // Repeated dark shades reaching the paper edges identify a flattened checkerboard.
    // White sticker outlines are foreground; enclosed dark design pixels stay intact.
    for (const entry of neutralDark)
      if (
        distinct.every(
          (color) => Math.max(...color.map((v, i) => Math.abs(v - entry.color[i]))) > 24
        )
      )
        distinct.push(entry.color)
    return distinct.slice(0, 4)
  }
  return ranked[0] ? [ranked[0].color] : null
}

function isSheetBackground(
  rgba: Uint8ClampedArray,
  index: number,
  background: number[][] | null
): boolean {
  if (rgba[index * 4 + 3] < 24) return true
  return (
    background !== null &&
    background.some((color) =>
      color.every((value, channel) => Math.abs(rgba[index * 4 + channel] - value) <= 24)
    )
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

interface SheetComponent extends StickerBounds {
  id: number
  pixels: number
  seed: number
}

function labelSheet(mask: Uint8Array, width: number, height: number) {
  const labels = new Int32Array(mask.length),
    queue = new Int32Array(mask.length)
  const components: SheetComponent[] = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue
    const id = components.length + 1
    let head = 0,
      tail = 1,
      left = width,
      top = height,
      right = 0,
      bottom = 0
    labels[start] = id
    queue[0] = start
    while (head < tail) {
      const index = queue[head++],
        x = index % width,
        y = Math.floor(index / width)
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      const visit = (next: number) => {
        if (mask[next] && !labels[next]) {
          labels[next] = id
          queue[tail++] = next
        }
      }
      if (x) visit(index - 1)
      if (x + 1 < width) visit(index + 1)
      if (y) visit(index - width)
      if (y + 1 < height) visit(index + width)
    }
    components.push({
      id,
      x: left,
      y: top,
      width: right - left + 1,
      height: bottom - top + 1,
      pixels: tail,
      seed: start
    })
  }
  return { labels, components }
}

/** Enclosed dark artwork belongs to its outline, rather than becoming another sticker. */
export function fillStickerInteriors(mask: Uint8Array, width: number, height: number): Uint8Array {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 4_000_000 ||
    mask.length !== width * height
  )
    throw new Error('Invalid sheet dimensions.')
  const outside = new Uint8Array(mask.length),
    queue = new Int32Array(mask.length)
  let head = 0,
    tail = 0
  const visit = (index: number) => {
    if (!mask[index] && !outside[index]) {
      outside[index] = 1
      queue[tail++] = index
    }
  }
  for (let x = 0; x < width; x++) {
    visit(x)
    visit((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    visit(y * width)
    visit(y * width + width - 1)
  }
  while (head < tail) {
    const index = queue[head++],
      x = index % width,
      y = Math.floor(index / width)
    if (x) visit(index - 1)
    if (x + 1 < width) visit(index + 1)
    if (y) visit(index - width)
    if (y + 1 < height) visit(index + width)
  }
  return Uint8Array.from(outside, (value) => Number(!value))
}

function stickerComponents(mask: Uint8Array, width: number, height: number, joinPercent: number) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 4_000_000 ||
    mask.length !== width * height ||
    !Number.isFinite(joinPercent) ||
    joinPercent < 0 ||
    joinPercent > 5
  )
    throw new Error('Invalid sheet dimensions.')
  const first = labelSheet(mask, width, height)
  const frames = new Set(
    first.components
      .filter(
        (b) => b.width >= width * 0.95 && b.height >= height * 0.95 && b.pixels < mask.length * 0.1
      )
      .map((b) => b.id)
  )
  const clean = frames.size
    ? mask.map((value, index) => (frames.has(first.labels[index]) ? 0 : value))
    : mask
  const filled = fillStickerInteriors(clean, width, height)
  const grown = dilate(
    filled,
    width,
    height,
    Math.round((Math.max(width, height) * joinPercent) / 200)
  )
  const result = labelSheet(grown, width, height)
  return { ...result, filled }
}

/** The source points identify complete components, including all merged disconnected parts. */
export function selectStickerArtwork(
  mask: Uint8Array,
  width: number,
  height: number,
  seeds: Array<{ x: number; y: number }>,
  joinPercent = 0
): Uint8Array {
  if (
    !seeds.length ||
    seeds.length > 500 ||
    seeds.some(
      (p) =>
        !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x >= 1 || p.y >= 1
    )
  )
    throw new Error('Invalid sticker artwork selection.')
  const { labels, filled } = stickerComponents(mask, width, height, joinPercent)
  const ids = seeds.map((p) => labels[Math.floor(p.y * height) * width + Math.floor(p.x * width)])
  const selected = new Set(ids)
  if (ids.some((id) => !id))
    throw new Error(
      'The selected artwork is no longer available. Adjust the crop or disable isolation.'
    )
  return filled.map((value, index) => (value && selected.has(labels[index]) ? 1 : 0))
}

/** Bounded thumbnail connected components; nearby letters can be joined without changing artwork. */
export function findStickerSheetSelections(
  mask: Uint8Array,
  width: number,
  height: number,
  settings: StickerSheetSettings
): ReviewedStickerBounds[] {
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
  const { labels, components, filled } = stickerComponents(
    mask,
    width,
    height,
    settings.joinPercent
  )
  const located = components.map(() => ({
    left: width,
    top: height,
    right: -1,
    bottom: -1,
    pixels: 0,
    seed: -1
  }))
  for (let index = 0; index < filled.length; index++) {
    if (!filled[index]) continue
    const b = located[labels[index] - 1]
    if (!b) continue
    const x = index % width,
      y = Math.floor(index / width)
    b.left = Math.min(b.left, x)
    b.right = Math.max(b.right, x)
    b.top = Math.min(b.top, y)
    b.bottom = Math.max(b.bottom, y)
    b.pixels++
    if (b.seed < 0) b.seed = index
  }
  const candidates = located.filter(
    (b) => b.pixels >= Math.max(4, Math.round(mask.length * 0.000005))
  )
  const absorbed = new Set<(typeof candidates)[number]>()
  const seedsFor = new Map(candidates.map((b) => [b, [b.seed]]))
  // Tiny antialiased details inside a much larger selection are parts of that
  // artwork. Attach their source points instead of hiding or discarding them.
  for (const part of [...candidates].sort((a, b) => a.pixels - b.pixels)) {
    if (part.pixels > Math.max(16, Math.round(mask.length * 0.00005))) continue
    const parent = candidates
      .filter(
        (b) =>
          b !== part &&
          b.pixels > part.pixels * 20 &&
          b.left <= part.left &&
          b.top <= part.top &&
          b.right >= part.right &&
          b.bottom >= part.bottom
      )
      .sort(
        (a, b) => (a.right - a.left) * (a.bottom - a.top) - (b.right - b.left) * (b.bottom - b.top)
      )[0]
    if (parent) {
      seedsFor.get(parent)!.push(...seedsFor.get(part)!)
      absorbed.add(part)
    }
  }
  const bounds: ReviewedStickerBounds[] = candidates
    .filter((b) => !absorbed.has(b))
    .map((b) => {
      const x = Math.max(0, b.left - padding),
        y = Math.max(0, b.top - padding)
      return {
        x,
        y,
        width: Math.min(width, b.right + padding + 1) - x,
        height: Math.min(height, b.bottom + padding + 1) - y,
        seeds: seedsFor.get(b)!.map((seed) => ({
          x: ((seed % width) + 0.5) / width,
          y: (Math.floor(seed / width) + 0.5) / height
        }))
      }
    })
  if (bounds.length > 500)
    throw new Error('Too many separate parts. Increase Join nearby parts or use Grid.')
  return bounds.sort((a, b) =>
    Math.abs(a.y - b.y) < Math.min(a.height, b.height) / 2 ? a.x - b.x : a.y - b.y
  )
}

export function findStickerSheetBounds(
  mask: Uint8Array,
  width: number,
  height: number,
  settings: StickerSheetSettings
): StickerBounds[] {
  return findStickerSheetSelections(mask, width, height, settings).map(
    ({ x, y, width, height }) => ({ x, y, width, height })
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

export function validateStickerSheetSize(size: number, pdf: boolean): void {
  const limit = pdf ? 256 : 65
  if (!Number.isSafeInteger(size) || size < 1 || size > limit * 1024 * 1024)
    throw new Error(`Choose ${pdf ? 'a PDF' : 'artwork'} smaller than ${limit} MB.`)
}

/** Keep PDF masters whenever vector painting, paths, or text could be present. */
export function isRasterStickerPage(
  operators: readonly number[],
  ops: Record<string, number>
): boolean {
  const images = new Set(
    Object.entries(ops)
      .filter(([name]) => /^(paint(Image|InlineImage|SolidColorImage)|beginInlineImage)/.test(name))
      .map(([, value]) => value)
  )
  const paints = new Set(
    Object.entries(ops)
      .filter(([name]) =>
        /^(constructPath|stroke|closeStroke|fill|eoFill|fillStroke|eoFillStroke|closeFillStroke|closeEOFillStroke|showText|showSpacedText|nextLineShowText|nextLineSetSpacingShowText|shadingFill|paintXObject)$/.test(
          name
        )
      )
      .map(([, value]) => value)
  )
  return operators.some((op) => images.has(op)) && !operators.some((op) => paints.has(op))
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
  onPage: (page: StickerSheetPage) => void | Promise<void>,
  shouldStop: () => boolean
): Promise<void> {
  if (/\.ai$/i.test(file.name)) {
    validateStickerSheetSize(file.size, false)
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
      await onPage({ file: rendered, widthMm: sticker.widthMm, vectorArtwork: { svg, pdf } })
    }
    return
  }
  const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  const isPdf = hasPdfSignature(header)
  validateStickerSheetSize(file.size, isPdf)
  if (!isPdf) {
    if (/\.(ai|pdf)$/i.test(file.name))
      throw new Error(
        'Choose a PDF-compatible AI file. Save it with Create PDF Compatible File enabled, or export it as PDF.'
      )
    if (!/\.(png|jpe?g|webp)$/i.test(file.name))
      throw new Error('Choose AI, PDF, PNG, JPG, or WebP artwork.')
    await onPage({ file })
    return
  }
  const { loadPdfDocument, destroyPdfDocument } =
    await import('../../booklet-montage/lib/pdfWorker')
  const sourceBytes = new Uint8Array(await file.arrayBuffer())
  const { OPS } = await import('pdfjs-dist')
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
        const operators = await page.getOperatorList()
        const rasterOnly = isRasterStickerPage(operators.fnArray, OPS)
        await page.render({ canvas, canvasContext: context, viewport, background: 'rgba(0,0,0,0)' })
          .promise
        await onPage({
          file: await canvasFile(
            canvas,
            `${file.name.replace(/\.[^.]+$/, '')} - page ${number}.png`
          ),
          widthMm: (actual.width * 25.4) / 72,
          pdfSheet: rasterOnly ? undefined : { bytes: sourceBytes, pageNumber: number }
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
export async function detectStickerSheetRegions(
  file: File,
  settings: StickerSheetSettings
): Promise<{ width: number; height: number; bounds: ReviewedStickerBounds[] }> {
  const bitmap = await createImageBitmap(file),
    canvas = document.createElement('canvas')
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 80_000_000)
      throw new Error('Choose a sheet smaller than 80 megapixels.')
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas processing is unavailable.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const mask = stickerSheetForeground(
      context.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height
    )
    return {
      width: bitmap.width,
      height: bitmap.height,
      bounds: findStickerSheetSelections(mask, canvas.width, canvas.height, settings).map((b) => ({
        x: b.x / canvas.width,
        y: b.y / canvas.height,
        width: b.width / canvas.width,
        height: b.height / canvas.height,
        seeds: b.seeds
      }))
    }
  } finally {
    bitmap.close()
    canvas.width = canvas.height = 0
  }
}

export async function separateStickerSheet(
  file: File,
  settings: StickerSheetSettings,
  reviewed?: ReviewedStickerBounds[]
): Promise<StickerSheetCrop[]> {
  if (reviewed && (!reviewed.length || reviewed.length > 500))
    throw new Error('Choose between 1 and 500 sticker selections.')
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
    const isolation = reviewed?.some((region) => region.isolateArtwork)
      ? stickerComponents(foreground, preview.width, preview.height, settings.joinPercent)
      : undefined
    const bounds = reviewed
      ? reviewed.map((region) => {
          const b = clampStickerBounds(region)
          return {
            x: b.x * preview.width,
            y: b.y * preview.height,
            width: b.width * preview.width,
            height: b.height * preview.height
          }
        })
      : findStickerSheetBounds(foreground, preview.width, preview.height, settings)
    if (!bounds.length)
      throw new Error('No stickers found. Use Grid for white artwork or a busy background.')
    const result: StickerSheetCrop[] = []
    let outputBytes = 0
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
      const name = `${file.name.replace(/\.[^.]+$/, '')} - sticker ${String(index + 1).padStart(3, '0')}.png`
      const originalFile = await canvasFile(crop, name)
      const removeBackground = reviewed?.[index].removeBackground ?? settings.removeBackground
      const isolateArtwork = reviewed?.[index].isolateArtwork ?? false
      if (isolateArtwork && isolation) {
        const seeds = reviewed?.[index].seeds ?? []
        if (
          !seeds.length ||
          seeds.length > 500 ||
          seeds.some(
            (p) =>
              !Number.isFinite(p.x) ||
              !Number.isFinite(p.y) ||
              p.x < 0 ||
              p.y < 0 ||
              p.x >= 1 ||
              p.y >= 1
          )
        )
          throw new Error(
            'The selected artwork is no longer available. Adjust the crop or disable isolation.'
          )
        const ids = seeds.map(
          (p) =>
            isolation.labels[
              Math.floor(p.y * preview.height) * preview.width + Math.floor(p.x * preview.width)
            ]
        )
        const selected = new Set(ids)
        if (ids.some((id) => !id))
          throw new Error(
            'The selected artwork is no longer available. Adjust the crop or disable isolation.'
          )
        const pixels = cropContext.getImageData(0, 0, crop.width, crop.height)
        const keep = (i: number) => isolation.filled[i] && selected.has(isolation.labels[i])
        for (let py = 0; py < crop.height; py++)
          for (let px = 0; px < crop.width; px++) {
            const sx = ((x + px + 0.5) * preview.width) / bitmap.width - 0.5,
              sy = ((y + py + 0.5) * preview.height) / bitmap.height - 0.5
            const left = Math.max(0, Math.floor(sx)),
              top = Math.max(0, Math.floor(sy))
            const right = Math.min(preview.width - 1, left + 1),
              bottom = Math.min(preview.height - 1, top + 1)
            // Conservatively keep boundary samples; antialiased white outlines must not shrink.
            if (
              !keep(top * preview.width + left) &&
              !keep(top * preview.width + right) &&
              !keep(bottom * preview.width + left) &&
              !keep(bottom * preview.width + right)
            )
              pixels.data[(py * crop.width + px) * 4 + 3] = 0
          }
        cropContext.putImageData(pixels, 0, 0)
      }
      if (removeBackground && background) {
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
      const preparedFile =
        (removeBackground && background) || isolateArtwork
          ? await canvasFile(crop, name)
          : originalFile
      outputBytes += originalFile.size + (preparedFile === originalFile ? 0 : preparedFile.size)
      if (outputBytes > 200 * 1024 * 1024)
        throw new Error('The separated artwork exceeds 200 MB. Use fewer or smaller selections.')
      result.push({
        file: preparedFile,
        originalFile,
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
