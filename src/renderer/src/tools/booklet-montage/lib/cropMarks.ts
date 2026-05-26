import type { PDFPage } from 'pdf-lib'
import { rgb } from 'pdf-lib'
import type { Rect, SizeMm } from '../types'
import { mmToPixels, mmToPoints } from './units'

export function drawPdfCropMarks(page: PDFPage, slotRectMm: Rect): void {
  const rect = rectMmToPoints(slotRectMm)
  const markLength = mmToPoints(4)
  const color = rgb(0, 0, 0)
  const lineWidth = 0.35
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height]
  ]

  for (const [x, y] of corners) {
    const xDirection = x === rect.x ? -1 : 1
    const yDirection = y === rect.y ? -1 : 1

    page.drawLine({
      start: { x, y },
      end: { x: x + markLength * xDirection, y },
      thickness: lineWidth,
      color
    })
    page.drawLine({
      start: { x, y },
      end: { x, y: y + markLength * yDirection },
      thickness: lineWidth,
      color
    })
  }
}

export function drawPdfRegistrationMarks(page: PDFPage, paperSizeMm: SizeMm): void {
  const marks = getRegistrationMarkCenters(paperSizeMm)
  const markLength = mmToPoints(3)
  const color = rgb(0, 0, 0)

  for (const mark of marks) {
    const x = mmToPoints(mark.x)
    const y = mmToPoints(mark.y)

    page.drawLine({
      start: { x: x - markLength, y },
      end: { x: x + markLength, y },
      thickness: 0.35,
      color
    })
    page.drawLine({
      start: { x, y: y - markLength },
      end: { x, y: y + markLength },
      thickness: 0.35,
      color
    })
  }
}

export function drawCanvasCropMarks(
  context: CanvasRenderingContext2D,
  slotRectMm: Rect,
  paperSizeMm: SizeMm,
  dpi: number
): void {
  const rect = rectMmToCanvasPixels(slotRectMm, paperSizeMm, dpi)
  const markLength = mmToPixels(4, dpi)
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height]
  ]

  context.save()
  context.strokeStyle = '#000000'
  context.lineWidth = Math.max(1, Math.round(dpi / 300))

  for (const [x, y] of corners) {
    const xDirection = x === rect.x ? -1 : 1
    const yDirection = y === rect.y ? -1 : 1

    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + markLength * xDirection, y)
    context.moveTo(x, y)
    context.lineTo(x, y + markLength * yDirection)
    context.stroke()
  }

  context.restore()
}

export function drawCanvasRegistrationMarks(
  context: CanvasRenderingContext2D,
  paperSizeMm: SizeMm,
  dpi: number
): void {
  const marks = getRegistrationMarkCenters(paperSizeMm)
  const markLength = mmToPixels(3, dpi)

  context.save()
  context.strokeStyle = '#000000'
  context.lineWidth = Math.max(1, Math.round(dpi / 300))

  for (const mark of marks) {
    const x = mmToPixels(mark.x, dpi)
    const y = mmToPixels(paperSizeMm.heightMm - mark.y, dpi)

    context.beginPath()
    context.moveTo(x - markLength, y)
    context.lineTo(x + markLength, y)
    context.moveTo(x, y - markLength)
    context.lineTo(x, y + markLength)
    context.stroke()
  }

  context.restore()
}

export function rectMmToPoints(rect: Rect): Rect {
  return {
    x: mmToPoints(rect.x),
    y: mmToPoints(rect.y),
    width: mmToPoints(rect.width),
    height: mmToPoints(rect.height)
  }
}

export function rectMmToCanvasPixels(rect: Rect, paperSizeMm: SizeMm, dpi: number): Rect {
  return {
    x: mmToPixels(rect.x, dpi),
    y: mmToPixels(paperSizeMm.heightMm - rect.y - rect.height, dpi),
    width: mmToPixels(rect.width, dpi),
    height: mmToPixels(rect.height, dpi)
  }
}

function getRegistrationMarkCenters(paperSizeMm: SizeMm): Array<{ x: number; y: number }> {
  const inset = 5

  return [
    { x: paperSizeMm.widthMm / 2, y: inset },
    { x: paperSizeMm.widthMm / 2, y: paperSizeMm.heightMm - inset },
    { x: inset, y: paperSizeMm.heightMm / 2 },
    { x: paperSizeMm.widthMm - inset, y: paperSizeMm.heightMm / 2 }
  ]
}
