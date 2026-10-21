import type { IdCrop, IdPoint } from './fast-print-id.js'
import { idHeaderMarkers } from './id-orientation.js'

interface Line {
  rho: number
  angle: number
  x: number
  y: number
  votes: number
}
interface Candidate {
  points: IdPoint[]
  area: number
  ratio: number
  cheap: number
  score?: number
  strengths?: number[]
  solid?: boolean
}
const angularDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 180 - Math.abs(a - b))
const length = (a: IdPoint, b: IdPoint) => Math.hypot(a.x - b.x, a.y - b.y)
const area = (p: IdPoint[]) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length]
    return s + a.x * b.y - b.x * a.y
  }, 0) / 2
const cross = (a: Line, b: Line): IdPoint | null => {
  const d = a.x * b.y - a.y * b.x
  return Math.abs(d) < 0.7
    ? null
    : { x: (a.rho * b.y - a.y * b.rho) / d, y: (a.x * b.rho - a.rho * b.x) / d }
}
const inside = (point: IdPoint, polygon: IdPoint[]) =>
  polygon.every((a, i) => {
    const b = polygon[(i + 1) % polygon.length]
    return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= -2 * length(a, b)
  })

/** Bounded color-edge proposals. Text strokes alone cannot define a card boundary. */
export function detectIdBoundary(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  region?: IdCrop | null
): { crop: IdCrop; confidence: number } | null {
  if (width < 32 || height < 32 || width * height > 200000) return null
  const size = width * height,
    blur = new Float32Array(size * 3),
    gx = new Float32Array(size),
    gy = new Float32Array(size),
    magnitude = new Float32Array(size)
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++)
      for (let c = 0; c < 3; c++) {
        const i = y * width + x
        blur[i * 3 + c] =
          (data[(i - width - 1) * 4 + c] +
            2 * data[(i - width) * 4 + c] +
            data[(i - width + 1) * 4 + c] +
            2 * data[(i - 1) * 4 + c] +
            4 * data[i * 4 + c] +
            2 * data[(i + 1) * 4 + c] +
            data[(i + width - 1) * 4 + c] +
            2 * data[(i + width) * 4 + c] +
            data[(i + width + 1) * 4 + c]) /
          16
      }
  for (let y = 2; y < height - 2; y++)
    for (let x = 2; x < width - 2; x++) {
      const i = y * width + x
      for (let c = 0; c < 3; c++) {
        const dx =
          -blur[(i - width - 1) * 3 + c] +
          blur[(i - width + 1) * 3 + c] -
          2 * blur[(i - 1) * 3 + c] +
          2 * blur[(i + 1) * 3 + c] -
          blur[(i + width - 1) * 3 + c] +
          blur[(i + width + 1) * 3 + c]
        const dy =
          -blur[(i - width - 1) * 3 + c] -
          2 * blur[(i - width) * 3 + c] -
          blur[(i - width + 1) * 3 + c] +
          blur[(i + width - 1) * 3 + c] +
          2 * blur[(i + width) * 3 + c] +
          blur[(i + width + 1) * 3 + c]
        const value = Math.hypot(dx, dy)
        if (value > magnitude[i]) {
          magnitude[i] = value
          gx[i] = dx
          gy[i] = dy
        }
      }
    }
  const edges = new Uint8Array(size),
    weak = new Uint8Array(size),
    queue = new Int32Array(size)
  let tail = 0
  for (let y = 3; y < height - 3; y++)
    for (let x = 3; x < width - 3; x++) {
      const i = y * width + x,
        value = magnitude[i]
      if (value < 12) continue
      const dx = gx[i],
        dy = gy[i],
        slope = Math.abs(dy) / (Math.abs(dx) + 0.0001)
      const step = slope < 0.414 ? 1 : slope > 2.414 ? width : dx * dy > 0 ? width + 1 : width - 1
      if (value < magnitude[i - step] || value < magnitude[i + step]) continue
      weak[i] = 1
      if (value >= 36) {
        edges[i] = 1
        queue[tail++] = i
      }
    }
  for (let head = 0; head < tail; head++) {
    const i = queue[head]
    for (const step of [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1]) {
      const next = i + step
      if (next >= 0 && next < size && weak[next] && !edges[next]) {
        edges[next] = 1
        queue[tail++] = next
      }
    }
  }
  const diagonal = Math.ceil(Math.hypot(width, height)),
    bins = diagonal * 2 + 1,
    accumulator = new Uint16Array(180 * bins)
  const cos = Array.from({ length: 180 }, (_, i) => Math.cos((i * Math.PI) / 180)),
    sin = Array.from({ length: 180 }, (_, i) => Math.sin((i * Math.PI) / 180))
  for (let i = 0; i < size; i++)
    if (edges[i]) {
      const x = i % width,
        y = Math.floor(i / width)
      for (let t = 0; t < 180; t++)
        accumulator[t * bins + Math.round(x * cos[t] + y * sin[t]) + diagonal]++
    }
  const peaks: Array<{ index: number; votes: number }> = [],
    minimum = Math.max(18, Math.min(width, height) * 0.1)
  for (let i = 0; i < accumulator.length; i++)
    if (accumulator[i] >= minimum) peaks.push({ index: i, votes: accumulator[i] })
  peaks.sort((a, b) => b.votes - a.votes)
  const lines: Line[] = []
  for (const peak of peaks) {
    const angle = Math.floor(peak.index / bins),
      rho = (peak.index % bins) - diagonal
    if (
      lines.some(
        (line) =>
          angularDistance(angle, line.angle) < 4 &&
          Math.abs(rho - (Math.abs(angle - line.angle) > 90 ? -line.rho : line.rho)) < 5
      )
    )
      continue
    lines.push({ rho, angle, x: cos[angle], y: sin[angle], votes: peak.votes })
    if (lines.length >= 120) break
  }
  for (const [rho, angle] of [
    [0, 0],
    [width - 1, 0],
    [0, 90],
    [height - 1, 90]
  ])
    lines.push({ rho, angle, x: cos[angle], y: sin[angle], votes: 0 })
  const pairs: Array<[Line, Line]> = []
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i],
        b = lines[j]
      if (angularDistance(a.angle, b.angle) > 12) continue
      if (
        Math.abs(a.rho - (Math.abs(a.angle - b.angle) > 90 ? -b.rho : b.rho)) <
        Math.min(width, height) * 0.15
      )
        continue
      pairs.push([a, b])
    }
  const candidates: Candidate[] = []
  const dedupe = new Set<string>()
  for (let i = 0; i < pairs.length; i++)
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i],
        b = pairs[j]
      if (angularDistance(a[0].angle, b[0].angle) < 78) continue
      const corners = [cross(a[0], b[0]), cross(a[0], b[1]), cross(a[1], b[1]), cross(a[1], b[0])]
      if (corners.some((p) => !p || p.x < -3 || p.y < -3 || p.x > width + 3 || p.y > height + 3))
        continue
      let points = corners as IdPoint[],
        signed = area(points)
      if (signed < 0) {
        points = points.slice().reverse()
        signed = -signed
      }
      if (signed < size * 0.1 || signed > size * 0.965) continue
      const lengths = points.map((p, k) => length(p, points[(k + 1) % 4]))
      const ratio =
        Math.max(lengths[0] + lengths[2], lengths[1] + lengths[3]) /
        Math.min(lengths[0] + lengths[2], lengths[1] + lengths[3])
      if (ratio < 1.35 || ratio > 2.2) continue
      let skew = 0,
        convex = true
      for (let k = 0; k < 4; k++) {
        const p = points[k],
          q = points[(k + 1) % 4],
          r = points[(k + 3) % 4]
        skew = Math.max(
          skew,
          Math.abs(
            ((q.x - p.x) * (r.x - p.x) + (q.y - p.y) * (r.y - p.y)) /
              (lengths[k] * lengths[(k + 3) % 4])
          )
        )
        if ((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x) <= 0) convex = false
      }
      if (!convex || skew > 0.25) continue
      const key = points
        .map((p) => Math.round(p.x / 3) + ',' + Math.round(p.y / 3))
        .sort()
        .join('|')
      if (dedupe.has(key)) continue
      dedupe.add(key)
      candidates.push({
        points,
        area: signed,
        ratio,
        cheap:
          (signed / size) * 0.5 + Math.exp(-(((ratio - 1.67) / 0.4) ** 2)) * 0.3 + (1 - skew) * 0.2
      })
    }
  candidates.sort((a, b) => b.cheap - a.cheap)
  candidates.length = Math.min(candidates.length, 2000)
  if (region) {
    const points = region.map((p) => ({ x: p.x * width, y: p.y * height })),
      a = length(points[0], points[1]) + length(points[2], points[3]),
      b = length(points[1], points[2]) + length(points[3], points[0])
    candidates.push({
      points,
      area: Math.abs(area(points)),
      ratio: Math.max(a, b) / Math.min(a, b),
      cheap: 2,
      solid: true
    })
  }
  const pixel = (x: number, y: number) =>
    Math.min(height - 1, Math.max(0, Math.round(y))) * width +
    Math.min(width - 1, Math.max(0, Math.round(x)))
  const markers = idHeaderMarkers(data, width, height)
  const ranked: Candidate[] = []
  for (const candidate of candidates) {
    if (markers.length) {
      let points = candidate.points
      if (length(points[0], points[1]) < length(points[1], points[2]))
        points = [points[1], points[2], points[3], points[0]]
      const a = points[0],
        u = { x: points[1].x - a.x, y: points[1].y - a.y },
        v = { x: points[3].x - a.x, y: points[3].y - a.y },
        d = u.x * v.y - u.y * v.x
      const anchored = markers.some((marker) => {
        const x = marker.center.x - a.x,
          y = marker.center.y - a.y,
          s = (x * v.y - y * v.x) / d,
          t = (u.x * y - u.y * x) / d
        return (
          ((s < 0.3 && t < 0.32) || (s > 0.7 && t > 0.68)) &&
          marker.hull.every((p) => inside(p, points))
        )
      })
      if (!anchored) continue
    }
    const strengths: number[] = [],
      colors: number[][] = [[], [], []]
    for (let edge = 0; edge < 4; edge++) {
      const a = candidate.points[edge],
        b = candidate.points[(edge + 1) % 4],
        len = length(a, b),
        nx = -(b.y - a.y) / len,
        ny = (b.x - a.x) / len
      const difference = [0, 0, 0]
      let count = 0
      for (let step = 0; step < 30; step++) {
        const t = 0.06 + (step * 0.88) / 29,
          x = a.x + (b.x - a.x) * t,
          y = a.y + (b.y - a.y) * t
        const ix = x + nx * 6,
          iy = y + ny * 6,
          ox = x - nx * 6,
          oy = y - ny * 6
        if (
          ix < 0 ||
          iy < 0 ||
          ox < 0 ||
          oy < 0 ||
          ix >= width ||
          ox >= width ||
          iy >= height ||
          oy >= height
        )
          continue
        const inside = pixel(ix, iy) * 3,
          outside = pixel(ox, oy) * 3
        for (let c = 0; c < 3; c++) {
          difference[c] += blur[inside + c] - blur[outside + c]
          colors[c].push(blur[inside + c])
        }
        count++
      }
      strengths.push(count < 15 ? 0 : Math.hypot(...difference.map((value) => value / count)))
    }
    const sorted = [...strengths].sort((a, b) => b - a),
      floor = sorted[2]
    if (floor < 8 || colors[0].length < 50) continue
    let deviation = 0,
      brightness = 0
    for (const channel of colors) {
      const ordered = [...channel].sort((a, b) => a - b),
        median = ordered[Math.floor(ordered.length / 2)]
      brightness += median
      deviation += channel.reduce((s, v) => s + Math.abs(v - median), 0) / channel.length
    }
    if (brightness / 3 < 90) continue
    deviation /= 3
    candidate.strengths = strengths
    candidate.score =
      (sorted.slice(0, 3).reduce((sum, value) => sum + Math.min(1, value / 40), 0) / 3) * 0.45 +
      Math.min(1, floor / 40) * 0.15 +
      Math.max(0, 1 - deviation / 45) * 0.1 +
      Math.sqrt(candidate.area / size) * 0.15 +
      Math.exp(-(((candidate.ratio - 1.67) / 0.4) ** 2)) * 0.05 +
      Math.min(1, sorted[3] / 30) * 0.1 +
      (candidate.solid ? 0.03 : 0)
    ranked.push(candidate)
  }
  ranked.sort((a, b) => b.score! - a.score!)
  if (!ranked.length || ranked[0].score! < 0.66) return null
  const first = ranked[0]
  let best = first
  // Prefer the complete enclosing card to a smaller printed face/text region.
  for (const candidate of ranked.slice(1)) {
    if (candidate.score! < first.score! - 0.1 || candidate.area < first.area * 1.025) continue
    const strong = [...candidate.strengths!].sort((a, b) => b - a)
    if (candidate.area > first.area * 1.2 && (!candidate.solid || strong[2] < 90)) continue
    if (candidate.area <= first.area * 1.2 && strong[3] < 5) continue
    if (first.points.filter((point) => inside(point, candidate.points)).length < 4) continue
    if (candidate.area > best.area) best = candidate
  }
  let points = best.points
  if (
    length(points[0], points[1]) + length(points[2], points[3]) <
    length(points[1], points[2]) + length(points[3], points[0])
  )
    points = [points[1], points[2], points[3], points[0]]
  if (points[1].x < points[0].x) points = [points[2], points[3], points[0], points[1]]
  const crop = points.map((p, i) => {
    const before = points[(i + 3) % 4],
      after = points[(i + 1) % 4],
      l = length(before, p),
      r = length(p, after)
    const a = { x: (p.y - before.y) / l, y: -(p.x - before.x) / l },
      b = { x: (after.y - p.y) / r, y: -(after.x - p.x) / r }
    const pad = 1.25 / Math.max(0.3, 1 + a.x * b.x + a.y * b.y)
    return {
      x: Math.min(1, Math.max(0, (p.x + (a.x + b.x) * pad) / width)),
      y: Math.min(1, Math.max(0, (p.y + (a.y + b.y) * pad) / height))
    }
  }) as IdCrop
  return { crop, confidence: best.score! }
}
