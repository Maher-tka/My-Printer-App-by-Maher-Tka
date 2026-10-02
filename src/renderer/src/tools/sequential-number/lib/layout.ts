import type { NumberSlot, SequentialLayout, SequentialProject, SequentialSettings } from '../types'

export function createDefaultSequentialProject(): SequentialProject {
  return {
    name: 'Sequential numbers',
    front: null,
    back: null,
    positions: [
      { id: 'number-1', xMm: 10, yMm: 10, fontSizePt: 14, color: '#111827', align: 'left' }
    ],
    settings: {
      sheetPreset: 'a4',
      sheetWidthMm: 210,
      sheetHeightMm: 297,
      ticketWidthMm: 90,
      ticketHeightMm: 50,
      marginMm: 10,
      gapMm: 4,
      startNumber: 1,
      quantity: 100,
      increment: 1,
      digits: 4,
      prefix: '',
      suffix: '',
      order: 'stack',
      backMode: 'none',
      duplexFlip: 'long-edge',
      numberBack: false,
      cropMarks: true,
      gutterCutLines: false,
      cuttingLineColor: '#000000'
    }
  }
}

export function getSequentialLayout(s: SequentialSettings): SequentialLayout {
  const errors: string[] = []
  const warnings: string[] = []
  const bound = (value: number, min: number, max: number, label: string) => {
    if (!Number.isFinite(value) || value < min || value > max)
      errors.push(`${label} must be between ${min} and ${max}.`)
  }
  bound(s.sheetWidthMm, 10, 2000, 'Sheet width (mm)')
  bound(s.sheetHeightMm, 10, 2000, 'Sheet height (mm)')
  bound(s.ticketWidthMm, 1, 2000, 'Ticket width (mm)')
  bound(s.ticketHeightMm, 1, 2000, 'Ticket height (mm)')
  bound(s.marginMm, 0, 1000, 'Margin (mm)')
  bound(s.gapMm, 0, 1000, 'Gap (mm)')
  if (s.gutterCutLines && s.gapMm < 0.1)
    errors.push(
      'Gutter cutting lines need a gap of at least 0.1 mm so the 0.25 pt stroke stays outside the tickets.'
    )
  if (s.cuttingLineColor !== undefined && !/^#[0-9a-f]{6}$/i.test(s.cuttingLineColor))
    errors.push('Choose a valid cutting-line color.')
  for (const [value, min, max, label] of [
    [s.quantity, 1, 100000, 'Quantity'],
    [s.startNumber, 0, Number.MAX_SAFE_INTEGER, 'Start number'],
    [s.increment, 1, Number.MAX_SAFE_INTEGER, 'Increment'],
    [s.digits, 1, 12, 'Minimum digits']
  ] as const) {
    if (!Number.isSafeInteger(value) || value < min || value > max)
      errors.push(`${label} must be a whole number between ${min} and ${max}.`)
  }
  if (!Number.isSafeInteger(s.startNumber + (s.quantity - 1) * s.increment))
    errors.push('The final number exceeds the supported number range.')
  for (const [value, label] of [
    [s.prefix, 'Prefix'],
    [s.suffix, 'Suffix']
  ] as const) {
    if (typeof value !== 'string' || value.length > 32 || /[^\x20-\x7e\xa0-\xff]/.test(value))
      errors.push(`${label} must contain at most 32 printable Latin characters.`)
  }
  if (!['sheet', 'stack'].includes(s.order)) errors.push('Choose a numbering order.')
  if (!['none', 'blank', 'artwork'].includes(s.backMode)) errors.push('Choose a back-side option.')
  if (!['long-edge', 'short-edge'].includes(s.duplexFlip)) errors.push('Choose a duplex flip edge.')
  let columns = 0,
    rows = 0
  if (!errors.length) {
    columns = Math.max(
      0,
      Math.floor((s.sheetWidthMm - 2 * s.marginMm + s.gapMm + 1e-8) / (s.ticketWidthMm + s.gapMm))
    )
    rows = Math.max(
      0,
      Math.floor((s.sheetHeightMm - 2 * s.marginMm + s.gapMm + 1e-8) / (s.ticketHeightMm + s.gapMm))
    )
    if (!columns || !rows)
      errors.push(
        'The ticket does not fit on the sheet. Reduce its size or margins, or use a larger sheet.'
      )
  }
  const capacity = columns * rows
  const sheetCount = capacity ? Math.ceil(s.quantity / capacity) : 0
  const pdfPageCount = sheetCount * (s.backMode === 'none' ? 1 : 2)
  if (capacity > 10000)
    errors.push('Too many tickets per sheet. Increase the ticket size (maximum 10,000 per sheet).')
  if (pdfPageCount > 5000)
    errors.push('This job exceeds 5,000 PDF pages. Export a smaller quantity in separate batches.')
  if (s.cropMarks && s.gapMm < 2)
    warnings.push('Some crop marks may be omitted where there is not enough space.')
  if (s.backMode !== 'none')
    warnings.push(
      `Print at actual size, two-sided, flip on the ${s.duplexFlip}. Test one sheet before the full run.`
    )
  return { columns, rows, capacity, sheetCount, pdfPageCount, errors, warnings }
}

export function formatSequenceNumber(s: SequentialSettings, index: number): string {
  return `${s.prefix}${String(s.startNumber + index * s.increment).padStart(s.digits, '0')}${s.suffix}`
}

export function getNumberSlots(
  s: SequentialSettings,
  sheetIndex: number,
  side: 'front' | 'back' = 'front'
): NumberSlot[] {
  const layout = getSequentialLayout(s)
  if (
    layout.errors.length ||
    !Number.isInteger(sheetIndex) ||
    sheetIndex < 0 ||
    sheetIndex >= layout.sheetCount
  )
    return []
  const originX =
    (s.sheetWidthMm - layout.columns * s.ticketWidthMm - (layout.columns - 1) * s.gapMm) / 2
  const originY =
    (s.sheetHeightMm - layout.rows * s.ticketHeightMm - (layout.rows - 1) * s.gapMm) / 2
  const horizontalMirror = s.sheetHeightMm >= s.sheetWidthMm === (s.duplexFlip === 'long-edge')
  return Array.from({ length: layout.capacity }, (_, slotIndex) => {
    const frontColumn = slotIndex % layout.columns
    const frontRow = Math.floor(slotIndex / layout.columns)
    const column =
      side === 'back' && horizontalMirror ? layout.columns - 1 - frontColumn : frontColumn
    const row = side === 'back' && !horizontalMirror ? layout.rows - 1 - frontRow : frontRow
    const index =
      s.order === 'stack'
        ? slotIndex * layout.sheetCount + sheetIndex
        : sheetIndex * layout.capacity + slotIndex
    const occupied = index < s.quantity
    return {
      slotIndex,
      row,
      column,
      xMm: originX + column * (s.ticketWidthMm + s.gapMm),
      yMm: originY + row * (s.ticketHeightMm + s.gapMm),
      sequenceIndex: occupied ? index : null,
      number: occupied ? s.startNumber + index * s.increment : null,
      label: occupied ? formatSequenceNumber(s, index) : null
    }
  })
}

export function positionLabel(position: import('../types').NumberPosition, number: string): string {
  return position.kind === 'text' ? (position.text ?? '') : number
}

export const GUTTER_LINE_WIDTH_PT = 0.25
export const GUTTER_LINE_WIDTH_MM = (GUTTER_LINE_WIDTH_PT * 25.4) / 72
export interface GutterCutLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** All coordinates and stroke extents stay in the whitespace between tickets. */
export function getGutterCutLines(s: SequentialSettings, slots: NumberSlot[]): GutterCutLine[] {
  if (!s.gutterCutLines || s.gapMm < 0.1) return []
  const occupied = slots.filter((slot) => slot.sequenceIndex !== null)
  if (occupied.length < 2) return []
  const xs = [...new Set(occupied.map((slot) => slot.xMm))].sort((a, b) => a - b)
  const ys = [...new Set(occupied.map((slot) => slot.yMm))].sort((a, b) => a - b)
  const left = xs[0],
    right = xs[xs.length - 1] + s.ticketWidthMm
  const top = ys[0],
    bottom = ys[ys.length - 1] + s.ticketHeightMm
  return [
    ...xs.slice(0, -1).map((x) => ({
      x1: x + s.ticketWidthMm + s.gapMm / 2,
      y1: top,
      x2: x + s.ticketWidthMm + s.gapMm / 2,
      y2: bottom
    })),
    ...ys.slice(0, -1).map((y) => ({
      x1: left,
      y1: y + s.ticketHeightMm + s.gapMm / 2,
      x2: right,
      y2: y + s.ticketHeightMm + s.gapMm / 2
    }))
  ]
}
