import type { ArtworkTransform } from '../types'

export interface PenPoint {
  xCm: number
  yCm: number
}

export interface NormalizedPenPath {
  transform: ArtworkTransform
  pathData: string
}

const MIN_POINT_DISTANCE_CM = 0.025
const PATH_PADDING_CM = 0.04
const MIN_PATH_SIZE_CM = 0.1

export function appendPenPoint(points: PenPoint[], point: PenPoint): PenPoint[] {
  const previous = points.at(-1)
  if (
    previous &&
    Math.hypot(point.xCm - previous.xCm, point.yCm - previous.yCm) < MIN_POINT_DISTANCE_CM
  ) {
    return points
  }

  return [...points, point]
}

export function normalizePenPath(
  points: PenPoint[],
  artboardWidthCm: number,
  artboardHeightCm: number
): NormalizedPenPath | null {
  if (points.length < 2) return null

  const minX = Math.min(...points.map((point) => point.xCm))
  const minY = Math.min(...points.map((point) => point.yCm))
  const maxX = Math.max(...points.map((point) => point.xCm))
  const maxY = Math.max(...points.map((point) => point.yCm))
  const travelledDistance = points.slice(1).reduce((distance, point, index) => {
    const previous = points[index]
    return distance + Math.hypot(point.xCm - previous.xCm, point.yCm - previous.yCm)
  }, 0)

  if (travelledDistance < MIN_PATH_SIZE_CM) return null

  const left = Math.max(0, minX - PATH_PADDING_CM)
  const top = Math.max(0, minY - PATH_PADDING_CM)
  const right = Math.min(artboardWidthCm, maxX + PATH_PADDING_CM)
  const bottom = Math.min(artboardHeightCm, maxY + PATH_PADDING_CM)
  const widthCm = Math.max(right - left, MIN_PATH_SIZE_CM)
  const heightCm = Math.max(bottom - top, MIN_PATH_SIZE_CM)
  const pathData = points
    .map((point, index) => {
      const x = formatPathNumber((point.xCm - left) / widthCm)
      const y = formatPathNumber((point.yCm - top) / heightCm)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return {
    transform: {
      xCm: left,
      yCm: top,
      widthCm,
      heightCm,
      rotation: 0
    },
    pathData
  }
}

function formatPathNumber(value: number): string {
  return Number(value.toFixed(4)).toString()
}
