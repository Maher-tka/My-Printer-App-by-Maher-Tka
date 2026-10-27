import { detectIdBoundary } from './id-card-boundary.js'

export interface IdPoint {
  x: number
  y: number
}
export type IdCrop = [IdPoint, IdPoint, IdPoint, IdPoint]

export interface IdSide {
  sourceId: string
  turns: number
  crop: IdCrop
  angleDegrees?: number
  orientationVerified?: boolean
  sheetTurns?: number
}

export function rotateIdSide(side: IdSide, turns: 1 | 2 | 3): IdSide {
  const points = side.crop.map((_, i) => side.crop[(i - turns + 4) % 4])
  const crop = points.map((p) =>
    turns === 1
      ? { x: 1 - p.y, y: p.x }
      : turns === 2
        ? { x: 1 - p.x, y: 1 - p.y }
        : { x: p.y, y: 1 - p.x }
  ) as IdCrop
  return {
    ...side,
    turns: (side.turns + turns) % 4,
    crop,
    angleDegrees: undefined,
    orientationVerified: true
  }
}

/** Session-only artwork and edits; never a saved project or printer command. */
export interface IdPrintDraft {
  version: 1
  /** Printer owning the remembered two-sided choice; absent in older reviews. */
  printer?: string
  sources: Array<{ id: string; name: string; png: string }>
  sides: [IdSide | null, IdSide | null]
  active: number
  color: boolean
  duplex: boolean
  idsPerSheet?: number
  sheetSettings?: IdSheetSettings
}

export const MAX_IDS_PER_SHEET = 24

export interface IdSheetSettings {
  heightMm: number
  marginMm: number
  gapMm: number
  spacing: 'compact' | 'even'
  fillSheet: boolean
}
export const DEFAULT_ID_SHEET_SETTINGS: IdSheetSettings = {
  heightMm: 56,
  marginMm: 10,
  gapMm: 10,
  spacing: 'compact',
  fillSheet: false
}
export function validateIdSheetSettings(value: unknown): IdSheetSettings {
  const settings = value as IdSheetSettings
  if (
    !settings ||
    ![55, 56, 60].includes(settings.heightMm) ||
    !Number.isInteger(settings.marginMm) ||
    settings.marginMm < 5 ||
    settings.marginMm > 20 ||
    !Number.isInteger(settings.gapMm) ||
    settings.gapMm < 3 ||
    settings.gapMm > 15 ||
    !['compact', 'even'].includes(settings.spacing) ||
    typeof settings.fillSheet !== 'boolean'
  )
    throw new Error('Invalid ID sheet settings.')
  return {
    heightMm: settings.heightMm,
    marginMm: settings.marginMm,
    gapMm: settings.gapMm,
    spacing: settings.spacing,
    fillSheet: settings.fillSheet
  }
}
export function idPrintedSize(heightMm: number, _turns = 0) {
  return { widthMm: 90, heightMm }
}

export interface IdCopiesLayout {
  paperWidth: number
  paperHeight: number
  landscape: boolean
  cellWidthMm: number
  cellHeightMm: number
  capacity: number
  centers: Array<{ x: number; y: number }>
}
export interface IdLayoutOptions {
  cellWidthMm?: number
  marginMm?: number
  gapMm?: number
  spacing?: 'compact' | 'even'
}
/** Matching physical slots for both sides, with safe margins and symmetric spacing. */
export function idCopiesLayout(
  paper: 'A4' | 'A3',
  landscape: boolean,
  heights: number[],
  count: number,
  options: IdLayoutOptions = {}
): IdCopiesLayout {
  if (!Number.isInteger(count) || count < 1 || count > MAX_IDS_PER_SHEET)
    throw new Error('Choose between 1 and 24 IDs per sheet.')
  if (!heights.length || heights.some((height) => !Number.isFinite(height) || height <= 0))
    throw new Error('Choose a photo for each ID side.')
  const size = paper === 'A3' ? [297, 420] : [210, 297],
    [paperWidth, paperHeight] = landscape ? size.reverse() : size
  const cellHeightMm = Math.max(...heights),
    cellWidthMm = options.cellWidthMm ?? 90,
    gap = options.gapMm ?? 5,
    margin = options.marginMm ?? 5
  if (
    !Number.isFinite(cellWidthMm) ||
    cellWidthMm <= 0 ||
    !Number.isFinite(gap) ||
    gap < 3 ||
    gap > 15 ||
    !Number.isFinite(margin) ||
    margin < 5 ||
    margin > 20 ||
    !['compact', 'even'].includes(options.spacing ?? 'compact')
  )
    throw new Error('Invalid ID sheet settings.')
  const maxColumns = Math.floor((paperWidth - 2 * margin + gap) / (cellWidthMm + gap)),
    maxRows = Math.floor((paperHeight - 2 * margin + gap) / (cellHeightMm + gap)),
    capacity = Math.min(MAX_IDS_PER_SHEET, maxColumns * maxRows)
  if (count > capacity)
    throw new Error('These IDs do not fit at 9 cm. Choose fewer IDs or larger paper.')
  let columns = Math.min(maxColumns, Math.ceil(Math.sqrt(count)))
  while (Math.ceil(count / columns) > maxRows && columns < maxColumns) columns++
  const rows = Math.ceil(count / columns),
    even = options.spacing === 'even'
  const stepY =
    even && rows > 1 ? (paperHeight - 2 * margin - cellHeightMm) / (rows - 1) : cellHeightMm + gap
  const top = (paperHeight - cellHeightMm - (rows - 1) * stepY) / 2
  const centers = []
  for (let row = 0; row < rows; row++) {
    const cells = Math.min(columns, count - row * columns),
      stepX =
        even && cells > 1
          ? (paperWidth - 2 * margin - cellWidthMm) / (cells - 1)
          : cellWidthMm + gap,
      left = (paperWidth - cellWidthMm - (cells - 1) * stepX) / 2
    for (let column = 0; column < cells; column++)
      centers.push({
        x: left + cellWidthMm / 2 + column * stepX,
        y: top + cellHeightMm / 2 + row * stepY
      })
  }
  return { paperWidth, paperHeight, landscape, cellWidthMm, cellHeightMm, capacity, centers }
}

/** Long-edge backs mirror physical positions, including incomplete last rows. */
export function idCopyCenters(layout: IdCopiesLayout, back = false) {
  return layout.centers.map((point) =>
    back
      ? layout.landscape
        ? { x: point.x, y: layout.paperHeight - point.y }
        : { x: layout.paperWidth - point.x, y: point.y }
      : { ...point }
  )
}

export function fullIdCrop(): IdCrop {
  return [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 }
  ]
}

export function isFullIdCrop(crop: IdCrop): boolean {
  return crop.every((point) => [0, 1].includes(point.x) && [0, 1].includes(point.y))
}

export function initialIdSide(
  sourceId: string,
  width: number,
  height: number,
  crop: IdCrop
): IdSide {
  return horizontalIdSide(width, height, { sourceId, turns: 0, crop })
}

/** Keep the long card edge horizontal, including reviews saved with a quarter turn. */
export function horizontalIdSide(width: number, height: number, side: IdSide): IdSide {
  if (side.turns % 2) [width, height] = [height, width]
  let crop = side.crop,
    angle = side.angleDegrees
  const edge = (a: IdPoint, b: IdPoint) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height)
  if (
    edge(crop[1], crop[2]) + edge(crop[3], crop[0]) >
    edge(crop[0], crop[1]) + edge(crop[2], crop[3])
  ) {
    crop = [crop[1], crop[2], crop[3], crop[0]]
    if (angle !== undefined) angle += 90
  }
  const wrappedAngle = () =>
    angle === undefined
      ? {}
      : { angleDegrees: angle >= -180 && angle <= 180 ? angle : ((angle + 540) % 360) - 180 }
  const tilt = Math.abs(idCardAngle(width, height, crop))
  if (tilt <= 60 || tilt >= 120)
    return {
      ...side,
      crop,
      ...wrappedAngle()
    }
  // Match the common phone-photo correction: quarter-turn counterclockwise.
  let rotated = crop.map((point) => ({ x: point.y, y: 1 - point.x })) as IdCrop
  if (angle !== undefined) angle -= 90
  if (rotated[1].x < rotated[0].x) {
    rotated = [rotated[2], rotated[3], rotated[0], rotated[1]]
    if (angle !== undefined) angle += 180
  }
  return {
    ...side,
    turns: (side.turns + 3) % 4,
    crop: rotated,
    ...wrappedAngle()
  }
}

/** Clockwise, convex corners only. Normalized coordinates keep edits independent of preview size. */
export function validIdCrop(crop: IdCrop): boolean {
  if (
    crop.some(
      (p) =>
        !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1
    )
  )
    return false
  return crop.every((a, i) => {
    const b = crop[(i + 1) % 4],
      c = crop[(i + 2) % 4]
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > 0.0001
  })
}

/** Average the two long edges, in source pixels (not normalized image coordinates). */
export function idCardAngle(sourceWidth: number, sourceHeight: number, crop: IdCrop): number {
  const dx = (crop[1].x - crop[0].x + crop[2].x - crop[3].x) * sourceWidth
  const dy = (crop[1].y - crop[0].y + crop[2].y - crop[3].y) * sourceHeight
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

export function idCardPlacement(
  sourceWidth: number,
  sourceHeight: number,
  crop: IdCrop,
  paper: 'A4' | 'A3',
  landscape = false,
  angleDegrees = idCardAngle(sourceWidth, sourceHeight, crop)
) {
  if (
    !validIdCrop(crop) ||
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  )
    throw new Error('Adjust the crop corners to form a card.')
  if (!Number.isFinite(angleDegrees) || Math.abs(angleDegrees) > 180)
    throw new Error('Choose a card angle between -180° and 180°.')
  const extents = (angle: number) => {
    const radians = (angle * Math.PI) / 180,
      cos = Math.cos(radians),
      sin = Math.sin(radians)
    const points = crop.map((p) => ({
      x: p.x * sourceWidth * cos + p.y * sourceHeight * sin,
      y: -p.x * sourceWidth * sin + p.y * sourceHeight * cos
    }))
    return {
      width: Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
      height: Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))
    }
  }
  const bounds = extents(angleDegrees)
  if (bounds.height > bounds.width) angleDegrees = ((angleDegrees + 90 + 540) % 360) - 180
  const radians = (angleDegrees * Math.PI) / 180
  const cos = Math.cos(radians),
    sin = Math.sin(radians)
  // Remove the card's tilt before measuring it. A diagonal card's axis-aligned
  // source box is wider than the card and must never define the 90 mm output.
  const points = crop.map((p) => ({
    x: p.x * sourceWidth * cos + p.y * sourceHeight * sin,
    y: -p.x * sourceWidth * sin + p.y * sourceHeight * cos
  }))
  const left = Math.min(...points.map((p) => p.x))
  const top = Math.min(...points.map((p) => p.y))
  const width = Math.max(...points.map((p) => p.x)) - left
  const height = Math.max(...points.map((p) => p.y)) - top
  const dimensions = paper === 'A3' ? [297, 420] : [210, 297]
  const [paperWidth, paperHeight] = landscape ? dimensions.reverse() : dimensions
  const heightMm = (90 * height) / width
  if (heightMm > paperHeight - 10)
    throw new Error('The crop is too tall for this sheet at 9 cm wide. Rotate or crop the photo.')
  return {
    left,
    top,
    width,
    height,
    angleDegrees,
    cos,
    sin,
    widthMm: 90,
    heightMm,
    paperWidth,
    paperHeight,
    xMm: (paperWidth - 90) / 2,
    yMm: (paperHeight - heightMm) / 2
  }
}

function convexHull(points: IdPoint[]): IdPoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (a: IdPoint, b: IdPoint, c: IdPoint) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const half = (items: IdPoint[]) => {
    const result: IdPoint[] = []
    for (const p of items) {
      while (
        result.length > 1 &&
        cross(result[result.length - 2], result[result.length - 1], p) <= 0
      )
        result.pop()
      result.push(p)
    }
    return result.slice(0, -1)
  }
  return [...half(sorted), ...half(sorted.reverse())]
}

/** Minimum-area enclosing rectangle; its long edge becomes the card's top edge. */
function orientedCardBox(boundary: IdPoint[]) {
  const hull = convexHull(boundary)
  let best: { area: number; width: number; height: number; crop: IdCrop } | null = null
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i],
      b = hull[(i + 1) % hull.length]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length < 1) continue
    let ux = (b.x - a.x) / length,
      uy = (b.y - a.y) / length
    const extent = (x: number, y: number) => {
      const horizontal = hull.map((p) => p.x * x + p.y * y)
      const vertical = hull.map((p) => -p.x * y + p.y * x)
      return {
        left: Math.min(...horizontal),
        right: Math.max(...horizontal),
        top: Math.min(...vertical),
        bottom: Math.max(...vertical)
      }
    }
    let bounds = extent(ux, uy)
    if (bounds.right - bounds.left < bounds.bottom - bounds.top) {
      const swap = ux
      ux = -uy
      uy = swap
    }
    if (ux < 0) {
      ux = -ux
      uy = -uy
    }
    bounds = extent(ux, uy)
    const width = bounds.right - bounds.left,
      height = bounds.bottom - bounds.top
    const area = width * height
    if (area <= 0 || (best && area >= best.area - 0.001)) continue
    const margin = 1.5
    const point = (x: number, y: number) => ({ x: x * ux - y * uy, y: x * uy + y * ux })
    best = {
      area,
      width,
      height,
      crop: [
        point(bounds.left - margin, bounds.top - margin),
        point(bounds.right + margin, bounds.top - margin),
        point(bounds.right + margin, bounds.bottom + margin),
        point(bounds.left - margin, bounds.bottom + margin)
      ]
    }
  }
  return best
}

/** Prefer complete card regions; retain the full photo when no region is reliable. */
export function detectIdCrop(data: Uint8ClampedArray, width: number, height: number): IdCrop {
  if (width < 8 || height < 8 || data.length !== width * height * 4) return fullIdCrop()
  const fallback = () => {
    const region = detectIdRegion(data, width, height)
    if (region) return region
    return fullIdCrop()
  }
  const border: number[][] = [[], [], []]
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (x > 1 && y > 1 && x < width - 2 && y < height - 2) continue
      for (let c = 0; c < 3; c++) border[c].push(data[(y * width + x) * 4 + c])
    }
  const background = border.map(
    (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
  )
  const plainBorder = border.every(
    (values) =>
      values[Math.floor(values.length * 0.95)] - values[Math.floor(values.length * 0.05)] <= 10
  )
  if (!plainBorder) {
    let boundary = detectIdBoundary(data, width, height, detectIdRegion(data, width, height))
    // Opposite scan direction protects faint outer edges from Hough peak ties.
    const reverse = new Uint8ClampedArray(data.length)
    for (let i = 0; i < width * height; i++)
      reverse.set(data.subarray(i * 4, i * 4 + 4), (width * height - 1 - i) * 4)
    const opposite = detectIdBoundary(
      reverse,
      width,
      height,
      detectIdRegion(reverse, width, height)
    )
    if (opposite) {
      let crop = opposite.crop.map((p) => ({ x: 1 - p.x, y: 1 - p.y })) as IdCrop
      if (crop[1].x < crop[0].x) crop = [crop[2], crop[3], crop[0], crop[1]]
      const area = (points: IdCrop) =>
        Math.abs(
          points.reduce((sum, a, i) => {
            const b = points[(i + 1) % 4]
            return sum + a.x * b.y - b.x * a.y
          }, 0)
        )
      const encloses = (outer: IdCrop, inner: IdCrop) => {
        let hits = 0,
          total = 0
        for (let row = 0; row <= 8; row++)
          for (let col = 0; col <= 8; col++) {
            const u = col / 8,
              v = row / 8
            const p = {
              x:
                (1 - v) * (inner[0].x * (1 - u) + inner[1].x * u) +
                v * (inner[3].x * (1 - u) + inner[2].x * u),
              y:
                (1 - v) * (inner[0].y * (1 - u) + inner[1].y * u) +
                v * (inner[3].y * (1 - u) + inner[2].y * u)
            }
            total++
            if (
              outer.every((a, i) => {
                const b = outer[(i + 1) % 4]
                return (
                  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >=
                  -0.015 * Math.hypot(b.x - a.x, b.y - a.y)
                )
              })
            )
              hits++
          }
        return hits / total > 0.9
      }
      if (
        !boundary ||
        (opposite.confidence >= boundary.confidence - 0.22 &&
          area(crop) > area(boundary.crop) * 1.025 &&
          encloses(crop, boundary.crop))
      )
        boundary = { ...opposite, crop }
    }
    if (boundary && validIdCrop(boundary.crop)) return boundary.crop
  }
  const foreground = new Uint8Array(width * height)
  let borderPixels = 0,
    backgroundBorderPixels = 0,
    foregroundPixels = 0
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const contrast =
        Math.hypot(
          data[i * 4] - background[0],
          data[i * 4 + 1] - background[1],
          data[i * 4 + 2] - background[2]
        ) > 65
      foreground[i] = Number(contrast)
      foregroundPixels += Number(contrast)
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) {
        borderPixels++
        if (!contrast) backgroundBorderPixels++
      }
    }
  // A card may touch one edge of the photo; the remaining border can still identify the table.
  if (backgroundBorderPixels < borderPixels * 0.6) return fallback()
  const seen = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let bestCrop = fullIdCrop(),
    bestCount = 0
  for (let start = 0; start < seen.length; start++) {
    if (seen[start]) continue
    seen[start] = 1
    if (!foreground[start]) continue
    let head = 0,
      tail = 1
    queue[0] = start
    const boundary: IdPoint[] = []
    while (head < tail) {
      const i = queue[head++],
        x = i % width,
        y = Math.floor(i / width)
      const neighbors = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1
      ]
      if (neighbors.some((n) => n < 0 || !foreground[n])) boundary.push({ x: x + 0.5, y: y + 0.5 })
      for (const n of neighbors) {
        if (n < 0 || seen[n]) continue
        seen[n] = 1
        if (foreground[n]) queue[tail++] = n
      }
    }
    if (
      tail <= bestCount ||
      tail < width * height * 0.02 ||
      tail < foregroundPixels * 0.85 ||
      boundary.length < 4
    )
      continue
    const box = orientedCardBox(boundary)
    if (
      !box ||
      box.height < 8 ||
      box.area < width * height * 0.025 ||
      box.area > width * height * 0.95 ||
      tail / box.area < 0.65 ||
      box.width / box.height < 1.3 ||
      box.width / box.height > 2.6
    )
      continue
    const crop = box.crop.map((p) => ({
      x: Math.max(0, Math.min(1, p.x / width)),
      y: Math.max(0, Math.min(1, p.y / height))
    })) as IdCrop
    if (validIdCrop(crop)) {
      bestCrop = crop
      bestCount = tail
    }
  }
  return bestCount ? bestCrop : fallback()
}

/** Remove narrow table patterns before searching for the complete card body. */
function detectIdRegion(data: Uint8ClampedArray, width: number, height: number): IdCrop | null {
  const length = width * height,
    channels: number[][] = [[], [], []]
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2)
        for (let c = 0; c < 3; c++) channels[c].push(data[(y * width + x) * 4 + c])
  const background = channels.map(
    (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
  )
  const contrast = Float32Array.from({ length }, (_, i) =>
    Math.hypot(
      data[i * 4] - background[0],
      data[i * 4 + 1] - background[1],
      data[i * 4 + 2] - background[2]
    )
  )
  const morphology = (mask: Uint8Array, erode: boolean) => {
    const stride = width + 1,
      integral = new Int32Array(stride * (height + 1)),
      result = new Uint8Array(length)
    for (let y = 0; y < height; y++) {
      let row = 0
      for (let x = 0; x < width; x++) {
        row += mask[y * width + x]
        integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row
      }
    }
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const left = Math.max(0, x - 2),
          right = Math.min(width, x + 3),
          top = Math.max(0, y - 2),
          bottom = Math.min(height, y + 3)
        const count =
          integral[bottom * stride + right] -
          integral[top * stride + right] -
          integral[bottom * stride + left] +
          integral[top * stride + left]
        result[y * width + x] = Number(
          erode ? count === (right - left) * (bottom - top) : count > 0
        )
      }
    return result
  }
  let best: IdCrop | null = null,
    bestScore = 0
  for (const threshold of [12, 22, 38, 65]) {
    const mask = morphology(
      morphology(
        Uint8Array.from(contrast, (value) => Number(value > threshold)),
        true
      ),
      false
    )
    const seen = new Uint8Array(length),
      queue = new Int32Array(length)
    for (let start = 0; start < length; start++) {
      if (seen[start] || !mask[start]) continue
      let head = 0,
        tail = 1
      queue[0] = start
      seen[start] = 1
      const boundary: IdPoint[] = []
      while (head < tail) {
        const index = queue[head++],
          x = index % width,
          y = Math.floor(index / width),
          neighbors = [
            x ? index - 1 : -1,
            x < width - 1 ? index + 1 : -1,
            y ? index - width : -1,
            y < height - 1 ? index + width : -1
          ]
        if (neighbors.some((next) => next < 0 || !mask[next]))
          boundary.push({ x: x + 0.5, y: y + 0.5 })
        for (const next of neighbors)
          if (next >= 0 && !seen[next] && mask[next]) {
            seen[next] = 1
            queue[tail++] = next
          }
      }
      if (tail < length * 0.025 || tail > length * 0.9 || boundary.length < 4) continue
      const box = orientedCardBox(boundary)
      if (
        !box ||
        box.area < length * 0.035 ||
        box.area > length * 0.94 ||
        box.height < 12 ||
        tail / box.area < 0.65
      )
        continue
      const ratio = box.width / box.height
      if (ratio < 1.35 || ratio > 2.25) continue
      const score =
        Math.exp(-(((ratio - 1.67) / 0.36) ** 2)) * 0.45 +
        (tail / box.area) * 0.3 +
        Math.sqrt(box.area / length) * 0.25
      if (score <= bestScore) continue
      const crop = box.crop.map((point) => ({
        x: Math.max(0, Math.min(1, point.x / width)),
        y: Math.max(0, Math.min(1, point.y / height))
      })) as IdCrop
      if (validIdCrop(crop)) {
        bestScore = score
        best = crop
      }
    }
  }
  return best
}
