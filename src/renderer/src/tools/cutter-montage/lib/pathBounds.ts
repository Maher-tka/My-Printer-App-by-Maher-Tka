import { svgPathToOperators } from 'pdf-lib/cjs/api/svgPath'

export interface PathBounds {
  x: number
  y: number
  width: number
  height: number
}

const cache = new Map<string, PathBounds | null>()

/** Measure drawn geometry, including curve extrema, rather than its SVG viewBox. */
export function getPathBounds(path: string): PathBounds | null {
  if (cache.has(path)) return cache.get(path) ?? null
  let result: PathBounds | null = null
  try {
    let x = 0,
      y = 0,
      startX = 0,
      startY = 0
    let subpathDrawn = false
    let left = Infinity,
      top = Infinity,
      right = -Infinity,
      bottom = -Infinity
    const include = (px: number, py: number): void => {
      if (!Number.isFinite(px) || !Number.isFinite(py)) throw new Error('Invalid path point')
      left = Math.min(left, px)
      top = Math.min(top, py)
      right = Math.max(right, px)
      bottom = Math.max(bottom, py)
    }
    for (const operator of svgPathToOperators(path)) {
      const tokens = operator.toString().trim().split(/\s+/)
      const name = tokens.pop()
      const args = tokens.map(Number)
      if (name === 'm') {
        x = args[0]
        y = args[1]
        startX = x
        startY = y
        subpathDrawn = false
      } else if (name === 'l' || name === 'h') {
        if (name === 'h' && !subpathDrawn) continue
        include(x, y)
        const [nextX, nextY] = name === 'h' ? [startX, startY] : args
        include(nextX, nextY)
        x = nextX
        y = nextY
        subpathDrawn = true
      } else if (name === 'c' || name === 'v') {
        const xs = name === 'c' ? [x, args[0], args[2], args[4]] : [x, args[0], args[2]]
        const ys = name === 'c' ? [y, args[1], args[3], args[5]] : [y, args[1], args[3]]
        for (const t of [0, 1, ...extrema(xs), ...extrema(ys)])
          include(evaluate(xs, t), evaluate(ys, t))
        x = xs[xs.length - 1]
        y = ys[ys.length - 1]
        subpathDrawn = true
      }
    }
    if (right > left && bottom > top)
      result = { x: left, y: top, width: right - left, height: bottom - top }
  } catch {
    /* Invalid paths retain their existing frame-based measurement. */
  }
  if (cache.size >= 200) cache.delete(cache.keys().next().value!)
  cache.set(path, result)
  return result
}

function evaluate(points: number[], t: number): number {
  const values = [...points]
  for (let length = values.length - 1; length > 0; length--) {
    for (let i = 0; i < length; i++) values[i] = values[i] * (1 - t) + values[i + 1] * t
  }
  return values[0]
}

function extrema(p: number[]): number[] {
  if (p.length === 3) {
    const denominator = p[0] - 2 * p[1] + p[2]
    const t = (p[0] - p[1]) / denominator
    return t > 0 && t < 1 ? [t] : []
  }
  const a = -p[0] + 3 * p[1] - 3 * p[2] + p[3]
  const b = 2 * (p[0] - 2 * p[1] + p[2])
  const c = p[1] - p[0]
  if (Math.abs(a) < 1e-12) {
    const t = -c / b
    return t > 0 && t < 1 ? [t] : []
  }
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return []
  return [
    (-b + Math.sqrt(discriminant)) / (2 * a),
    (-b - Math.sqrt(discriminant)) / (2 * a)
  ].filter((t) => t > 0 && t < 1)
}
