import type { NumberPosition, SequentialProject } from '../types'

export function createRepeatedNumberPosition(
  project: SequentialProject,
  selectedId: string,
  id: string
): NumberPosition {
  const source =
    project.positions.find((p) => p.id === selectedId && p.kind !== 'text') ??
    project.positions.find((p) => p.kind !== 'text')
  const position: NumberPosition = source
    ? { ...source, id, kind: 'number' }
    : {
        id,
        kind: 'number',
        xMm: Math.min(10, project.settings.ticketWidthMm / 2),
        yMm: Math.min(10, project.settings.ticketHeightMm / 2),
        fontSizePt: 12,
        color: '#000000',
        align: 'left'
      }
  if (!source) return position
  const textHeightMm = (position.fontSizePt * 25.4) / 72
  const offset = Math.max(5, textHeightMm * 1.5)
  return moveNumberPosition(
    position,
    0,
    position.yMm + offset + textHeightMm <= project.settings.ticketHeightMm ? offset : -offset,
    project.settings.ticketWidthMm,
    project.settings.ticketHeightMm,
    false,
    false
  )
}

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
