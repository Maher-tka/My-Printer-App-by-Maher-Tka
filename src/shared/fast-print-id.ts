export interface IdPoint {
  x: number
  y: number
}
export type IdCrop = [IdPoint, IdPoint, IdPoint, IdPoint]

export function fullIdCrop(): IdCrop {
  return [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 }
  ]
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

/** Conservative rough crop for a card on a reasonably uniform table. Otherwise keep the whole photo. */
export function detectIdCrop(data: Uint8ClampedArray, width: number, height: number): IdCrop {
  if (width < 8 || height < 8 || data.length !== width * height * 4) return fullIdCrop()
  const border: number[][] = [[], [], []]
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (x > 1 && y > 1 && x < width - 2 && y < height - 2) continue
      for (let c = 0; c < 3; c++) border[c].push(data[(y * width + x) * 4 + c])
    }
  const background = border.map(
    (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
  )
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
  if (backgroundBorderPixels < borderPixels * 0.6) return fullIdCrop()
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
  return bestCrop
}
