import { fastPrintCell, type FastPrintPreset, type fastPrintLayout } from './fast-print.js'

export const FAST_PRINT_SEPARATOR_PX = 0.25
export const FAST_PRINT_SIZE_ERROR =
  'Actual-size items do not fit. Choose fewer pages per sheet, a larger paper, or another orientation.'

export interface MontageRect {
  x: number
  y: number
  width: number
  height: number
}

/** Sizes are already rotated and expressed in sheet pixels, independent of preview DPI. */
export function fastPrintMontageCells(
  layout: ReturnType<typeof fastPrintLayout>,
  sizes: Array<{ width: number; height: number }>,
  preset: Pick<FastPrintPreset, 'compact' | 'preserveActualSize' | 'fitToFrame'>
): MontageRect[] {
  if (!sizes.length) return []
  if (
    sizes.length > layout.columns * layout.rows ||
    sizes.some(
      (size) =>
        !Number.isFinite(size.width) ||
        !Number.isFinite(size.height) ||
        size.width <= 0 ||
        size.height <= 0
    )
  )
    throw new Error('Invalid montage dimensions.')
  const cells = sizes.map((size, slot) => {
    const cell = fastPrintCell(layout, slot, sizes.length)
    if (!preset.compact && !preset.preserveActualSize) return cell
    const scale = preset.preserveActualSize
      ? 1
      : (preset.fitToFrame ? Math.max : Math.min)(
          cell.width / size.width,
          cell.height / size.height
        )
    const width = preset.fitToFrame && !preset.preserveActualSize ? cell.width : size.width * scale
    const height =
      preset.fitToFrame && !preset.preserveActualSize ? cell.height : size.height * scale
    if (!preset.compact && (width > cell.width + 0.001 || height > cell.height + 0.001))
      throw new Error(FAST_PRINT_SIZE_ERROR)
    return {
      x: cell.x + (cell.width - width) / 2,
      y: cell.y + (cell.height - height) / 2,
      width,
      height
    }
  })
  if (!preset.compact) return cells
  const rows: MontageRect[][] = []
  for (let index = 0; index < cells.length; index += layout.columns)
    rows.push(cells.slice(index, index + layout.columns))
  const rowWidths = rows.map(
    (row) => row.reduce((sum, cell) => sum + cell.width, 0) + (row.length - 1) * layout.gap
  )
  const rowHeights = rows.map((row) => Math.max(...row.map((cell) => cell.height)))
  const height = rowHeights.reduce((sum, value) => sum + value, 0) + (rows.length - 1) * layout.gap
  if (
    Math.max(...rowWidths) > layout.width - 2 * layout.margin + 0.001 ||
    height > layout.height - 2 * layout.margin + 0.001
  )
    throw new Error(FAST_PRINT_SIZE_ERROR)
  let y = (layout.height - height) / 2
  rows.forEach((row, index) => {
    let x = (layout.width - rowWidths[index]) / 2
    for (const cell of row) {
      cell.x = x
      cell.y = y + (rowHeights[index] - cell.height) / 2
      x += cell.width + layout.gap
    }
    y += rowHeights[index] + layout.gap
  })
  return cells
}

/** Merge touching/overlapping edges so shared cuts are stroked only once. */
export function fastPrintSeparatorSegments(cells: MontageRect[]) {
  const groups = new Map<string, { vertical: boolean; position: number; spans: number[][] }>()
  for (const { x, y, width, height } of cells) {
    for (const [vertical, position, start, end] of [
      [0, y, x, x + width],
      [0, y + height, x, x + width],
      [1, x, y, y + height],
      [1, x + width, y, y + height]
    ]) {
      const key = `${vertical}:${position.toFixed(4)}`
      if (!groups.has(key)) groups.set(key, { vertical: !!vertical, position, spans: [] })
      groups.get(key)!.spans.push([start, end])
    }
  }
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  for (const { vertical, position, spans } of groups.values()) {
    spans.sort((a, b) => a[0] - b[0])
    const merged: number[][] = []
    for (const span of spans) {
      const last = merged.at(-1)
      if (last && span[0] <= last[1] + 0.0001) last[1] = Math.max(last[1], span[1])
      else merged.push([...span])
    }
    for (const [start, end] of merged)
      segments.push(
        vertical
          ? { x1: position, y1: start, x2: position, y2: end }
          : { x1: start, y1: position, x2: end, y2: position }
      )
  }
  return segments
}
