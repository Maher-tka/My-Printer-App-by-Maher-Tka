import type { NumberPosition } from '../types'

export function moveNumberPosition(
  position: NumberPosition,
  dx: number,
  dy: number,
  width: number,
  height: number,
  constrain: boolean,
  snap: boolean
): NumberPosition {
  if (constrain) {
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0
    else dx = 0
  }
  const coordinate = (value: number, max: number) =>
    Math.max(0, Math.min(max, snap ? Math.round(value) : Math.round(value * 1000) / 1000))
  return {
    ...position,
    xMm: coordinate(position.xMm + dx, width),
    yMm: coordinate(position.yMm + dy, height)
  }
}
