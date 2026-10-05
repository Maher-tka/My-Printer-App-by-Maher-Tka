import type { CardMontageSettings } from '../types'
import { getCardOutlineColor } from './cropMarks'

export function getCardLayout(settings: CardMontageSettings, side: 'front' | 'back' = 'front') {
  const sheetWidthMm = settings.orientation === 'portrait' ? 210 : 297
  const sheetHeightMm = settings.orientation === 'portrait' ? 297 : 210
  const widthMm = settings.mode === 'auto' ? 88 : settings.widthMm
  const heightMm = settings.mode === 'auto' ? 56 : settings.heightMm
  const artworkFit = settings.mode === 'auto' ? 'stretch' : settings.artworkFit
  const horizontalGapMm =
    settings.mode === 'auto'
      ? (settings.autoHorizontalGapMm ?? 10)
      : settings.mode === 'spaced'
        ? settings.horizontalGapMm
        : 0
  const verticalGapMm =
    settings.mode === 'auto' ? 1 : settings.mode === 'spaced' ? settings.verticalGapMm : 0
  const marksEnabled =
    settings.mode !== 'auto' && settings.cutMarks && !(settings.mode === 'zero' && side === 'back')
  const outlinesEnabled = settings.mode === 'auto' && Boolean(settings.cardOutline)
  const lineColor =
    settings.mode === 'auto'
      ? getCardOutlineColor(settings.cardOutlineColor)
      : (settings.cropMarkColor ?? '#000000')
  const errors: string[] = []
  if ((marksEnabled || outlinesEnabled) && !/^#[0-9a-f]{6}$/i.test(lineColor))
    errors.push('Choose a valid marking color.')
  if (!['auto', 'zero', 'spaced'].includes(settings.mode)) errors.push('Choose a montage mode.')
  if (!['portrait', 'landscape'].includes(settings.orientation))
    errors.push('Choose an A4 orientation.')
  if (!['stretch', 'contain'].includes(settings.artworkFit)) errors.push('Choose artwork sizing.')
  if (![widthMm, heightMm].every((value) => Number.isFinite(value) && value >= 5))
    errors.push('Card width and height must be at least 0.5 cm.')
  if (
    ![horizontalGapMm, verticalGapMm].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 100
    )
  )
    errors.push('Spacing must be between 0 and 100 mm.')
  if (!Number.isFinite(settings.marginMm) || settings.marginMm < 0 || settings.marginMm > 100)
    errors.push('Sheet margin must be between 0 and 100 mm.')
  const columns = errors.length
    ? 0
    : Math.max(
        0,
        Math.floor(
          (sheetWidthMm - 2 * settings.marginMm + horizontalGapMm + 1e-7) /
            (widthMm + horizontalGapMm)
        )
      )
  const rows = errors.length
    ? 0
    : Math.max(
        0,
        Math.floor(
          (sheetHeightMm - 2 * settings.marginMm + verticalGapMm + 1e-7) /
            (heightMm + verticalGapMm)
        )
      )
  if (!errors.length && (!columns || !rows))
    errors.push(
      'The card does not fit on A4 with these margins. Reduce its size or margin, or change orientation.'
    )
  const capacity = columns * rows
  const usedWidthMm = columns * widthMm + Math.max(0, columns - 1) * horizontalGapMm
  const usedHeightMm = rows * heightMm + Math.max(0, rows - 1) * verticalGapMm
  const leftMm = (sheetWidthMm - usedWidthMm) / 2
  const topMm = (sheetHeightMm - usedHeightMm) / 2
  const slots = errors.length
    ? []
    : Array.from({ length: capacity }, (_, index) => ({
        xMm: leftMm + (index % columns) * (widthMm + horizontalGapMm),
        yMm: topMm + Math.floor(index / columns) * (heightMm + verticalGapMm)
      }))
  const marks: { x1: number; y1: number; x2: number; y2: number }[] = []
  if (marksEnabled && !errors.length) {
    if (settings.mode === 'zero') {
      // One continuous guillotine guide per boundary, including the outer trims.
      for (let column = 0; column <= columns; column++) {
        const x = leftMm + column * widthMm
        marks.push({ x1: x, y1: 0, x2: x, y2: sheetHeightMm })
      }
      for (let row = 0; row <= rows; row++) {
        const y = topMm + row * heightMm
        marks.push({ x1: 0, y1: y, x2: sheetWidthMm, y2: y })
      }
    } else {
      // Spaced cards retain crosses centered on their exact corners.
      const corners = new Map<string, { x: number; y: number }>()
      for (const slot of slots)
        for (const x of [slot.xMm, slot.xMm + widthMm])
          for (const y of [slot.yMm, slot.yMm + heightMm])
            corners.set(`${x.toFixed(6)},${y.toFixed(6)}`, { x, y })
      for (const { x, y } of corners.values()) {
        marks.push({ x1: Math.max(0, x - 1.5), y1: y, x2: Math.min(sheetWidthMm, x + 1.5), y2: y })
        marks.push({ x1: x, y1: Math.max(0, y - 1.5), x2: x, y2: Math.min(sheetHeightMm, y + 1.5) })
      }
    }
  }
  const outlines =
    outlinesEnabled && !errors.length ? slots.map((slot) => ({ ...slot, widthMm, heightMm })) : []
  return {
    sheetWidthMm,
    sheetHeightMm,
    widthMm,
    heightMm,
    artworkFit,
    horizontalGapMm,
    verticalGapMm,
    columns,
    rows,
    capacity,
    slots,
    marks,
    outlines,
    lineColor,
    errors
  }
}
