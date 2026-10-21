import type { IdPoint } from './fast-print-id.js'

export interface IdHeaderMarker {
  center: IdPoint
  hull: IdPoint[]
  area: number
}
/** A solid red rectangle with a pale central emblem, independent of camera rotation. */
export function idHeaderMarkers(
  data: Uint8ClampedArray,
  width: number,
  height: number
): IdHeaderMarker[] {
  if (width < 40 || height < 30 || data.length !== width * height * 4) return []
  const red = new Uint8Array(width * height),
    seen = new Uint8Array(width * height),
    queue = new Int32Array(width * height)
  for (let i = 0; i < red.length; i++)
    red[i] = Number(
      data[i * 4] > 90 && data[i * 4] - data[i * 4 + 1] > 30 && data[i * 4] - data[i * 4 + 2] > 25
    )
  const markers: IdHeaderMarker[] = []
  for (let start = 0; start < red.length; start++) {
    if (!red[start] || seen[start]) continue
    let head = 0,
      tail = 1,
      left = width,
      right = 0,
      top = height,
      bottom = 0
    seen[start] = 1
    queue[0] = start
    while (head < tail) {
      const i = queue[head++],
        x = i % width,
        y = Math.floor(i / width)
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      for (const next of [
        x ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y ? i - width : -1,
        y < height - 1 ? i + width : -1
      ])
        if (next >= 0 && red[next] && !seen[next]) {
          seen[next] = 1
          queue[tail++] = next
        }
    }
    const w = right - left + 1,
      h = bottom - top + 1,
      ratio = Math.max(w, h) / Math.min(w, h)
    if (
      tail < width * height * 0.0025 ||
      w > width * 0.32 ||
      h > height * 0.38 ||
      ratio > 2.6 ||
      tail / (w * h) < 0.6
    )
      continue
    let white = 0,
      pixels = 0
    for (let y = Math.floor(top + h * 0.2); y < top + h * 0.8; y++)
      for (let x = Math.floor(left + w * 0.2); x < left + w * 0.8; x++) {
        const i = (y * width + x) * 4
        pixels++
        if (
          Math.min(data[i], data[i + 1], data[i + 2]) > 145 &&
          Math.max(data[i], data[i + 1], data[i + 2]) -
            Math.min(data[i], data[i + 1], data[i + 2]) <
            65
        )
          white++
      }
    if (white / pixels < 0.06 || white / pixels > 0.8) continue
    const points = Array.from(queue.slice(0, tail), (i) => ({
      x: i % width,
      y: Math.floor(i / width)
    })).sort((a, b) => a.x - b.x || a.y - b.y)
    const cross = (a: IdPoint, b: IdPoint, c: IdPoint) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    const half = (ps: IdPoint[]) => {
      const result: IdPoint[] = []
      for (const point of ps) {
        while (result.length > 1 && cross(result.at(-2)!, result.at(-1)!, point) <= 0) result.pop()
        result.push(point)
      }
      result.pop()
      return result
    }
    markers.push({
      center: { x: (left + right) / 2, y: (top + bottom) / 2 },
      hull: half(points).concat(half([...points].reverse())),
      area: tail
    })
  }
  return markers
}
/** Strong header-emblem evidence; otherwise defer to text. */
export function idHeaderOrientation(
  data: Uint8ClampedArray,
  width: number,
  height: number
): 0 | 2 | null {
  const votes = [0, 0]
  for (const marker of idHeaderMarkers(data, width, height)) {
    const x = marker.center.x / width,
      y = marker.center.y / height
    if (x < 0.29 && y < 0.31) votes[0] += marker.area
    else if (x > 0.71 && y > 0.69) votes[1] += marker.area
  }
  if (votes[0] > width * height * 0.002 && votes[0] > votes[1] * 3) return 0
  if (votes[1] > width * height * 0.002 && votes[1] > votes[0] * 3) return 2
  return null
}

export interface IdTextEvidence {
  score: number
  letters: number
}
export function scoreIdText(words: Array<{ text: string; confidence: number }>): IdTextEvidence {
  let score = 0,
    letters = 0
  for (const word of words) {
    if (!Number.isFinite(word.confidence) || word.confidence < 25) continue
    const count = word.text.replace(/[^\p{L}]/gu, '').length
    if (!count) continue
    letters += count
    score += ((word.confidence - 20) / 80) ** 2 * Math.min(count, 12)
  }
  return { score, letters }
}
export function chooseIdTextOrientation(
  normal: IdTextEvidence,
  inverted: IdTextEvidence
): 0 | 2 | null {
  const best = normal.score >= inverted.score ? normal : inverted,
    other = best === normal ? inverted : normal
  if (
    best.letters < 10 ||
    best.score < 2.5 ||
    best.score < other.score * 1.6 ||
    best.score - other.score < 2
  )
    return null
  return best === normal ? 0 : 2
}
