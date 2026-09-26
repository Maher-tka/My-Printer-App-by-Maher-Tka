import type { ArtworkTransform } from '../types'

export function getShapeDrawTransform(
  draw: { startX: number; startY: number },
  point: { xCm: number; yCm: number },
  square: boolean,
  fromCenter = false
): ArtworkTransform {
  if (fromCenter) {
    let halfWidth = Math.abs(point.xCm - draw.startX)
    let halfHeight = Math.abs(point.yCm - draw.startY)
    if (square) halfWidth = halfHeight = Math.max(halfWidth, halfHeight)
    return {
      xCm: draw.startX - halfWidth,
      yCm: draw.startY - halfHeight,
      widthCm: halfWidth * 2,
      heightCm: halfHeight * 2,
      rotation: 0
    }
  }

  let width = Math.abs(point.xCm - draw.startX)
  let height = Math.abs(point.yCm - draw.startY)
  if (square) width = height = Math.max(width, height)
  return {
    xCm: point.xCm < draw.startX ? draw.startX - width : draw.startX,
    yCm: point.yCm < draw.startY ? draw.startY - height : draw.startY,
    widthCm: width,
    heightCm: height,
    rotation: 0
  }
}

export function translateDraftShape(
  transform: ArtworkTransform,
  dxCm: number,
  dyCm: number
): ArtworkTransform {
  return {
    ...transform,
    xCm: transform.xCm + dxCm,
    yCm: transform.yCm + dyCm
  }
}
