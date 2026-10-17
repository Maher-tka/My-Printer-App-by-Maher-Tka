import type { CutterSheetSettings, PiecePreset, PlacedPiece } from '../types'
import { getSafeArea } from './cutterLayout'
import { getPlacedProductionBounds } from './cutlineGenerator'
import { relocatePlacedPiecesNearest } from './nesting'
import { getPlacedSheetIndex } from './productionSheets'

const EPSILON = 1e-7

export function moveLayoutSelection(
  placements: PlacedPiece[],
  presets: PiecePreset[],
  settings: CutterSheetSettings,
  anchorId: string,
  xCm: number,
  yCm: number,
  selectedIds: string[] = []
): {
  placedPieces: PlacedPiece[]
  movedCount: number
  rearrangedCount: number
  error: string | null
} {
  const reject = (error: string | null) => ({
    placedPieces: placements,
    movedCount: 0,
    rearrangedCount: 0,
    error
  })
  const anchor = placements.find((placed) => placed.id === anchorId)
  if (!anchor || anchor.locked || !Number.isFinite(xCm) || !Number.isFinite(yCm))
    return reject(null)
  const sheetIndex = getPlacedSheetIndex(anchor)
  const selected = new Set(selectedIds.includes(anchorId) ? selectedIds : [anchorId])
  const moving = placements.filter(
    (placed) =>
      selected.has(placed.id) && !placed.locked && getPlacedSheetIndex(placed) === sheetIndex
  )
  const presetMap = new Map(presets.map((preset) => [preset.id, preset]))
  const fresh = (placed: PlacedPiece): PlacedPiece => {
    const preset = presetMap.get(placed.presetId)
    return preset
      ? { ...placed, productionBoundsCm: getPlacedProductionBounds(placed, preset) }
      : placed
  }
  if (moving.some((placed) => !presetMap.has(placed.presetId)))
    return reject('This sticker is missing its artwork. Reimport it before moving it.')
  const bounds = (placed: PlacedPiece) => placed.productionBoundsCm ?? placed
  const movingWithBounds = moving.map(fresh)
  const safe = getSafeArea(settings)
  const minDx = Math.max(...movingWithBounds.map((placed) => safe.xCm - bounds(placed).xCm))
  const minDy = Math.max(...movingWithBounds.map((placed) => safe.yCm - bounds(placed).yCm))
  const maxDx = Math.min(
    ...movingWithBounds.map(
      (placed) => safe.xCm + safe.widthCm - bounds(placed).xCm - bounds(placed).widthCm
    )
  )
  const maxDy = Math.min(
    ...movingWithBounds.map(
      (placed) => safe.yCm + safe.heightCm - bounds(placed).yCm - bounds(placed).heightCm
    )
  )
  if (minDx > maxDx + EPSILON || minDy > maxDy + EPSILON)
    return reject('The selected stickers cannot fit inside the sheet safe area.')
  const dx = Math.min(Math.max(xCm - anchor.xCm, minDx), maxDx)
  const dy = Math.min(Math.max(yCm - anchor.yCm, minDy), maxDy)
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return reject(null)
  const moved = movingWithBounds.map((placed) =>
    fresh({ ...placed, xCm: placed.xCm + dx, yCm: placed.yCm + dy })
  )
  const movingIds = new Set(moved.map((placed) => placed.id))
  const spacing = settings.spacingMm / 10
  const collides = (a: PlacedPiece, b: PlacedPiece): boolean => {
    const first = bounds(a),
      second = bounds(b)
    return (
      first.xCm < second.xCm + second.widthCm + spacing - EPSILON &&
      first.xCm + first.widthCm + spacing > second.xCm + EPSILON &&
      first.yCm < second.yCm + second.heightCm + spacing - EPSILON &&
      first.yCm + first.heightCm + spacing > second.yCm + EPSILON
    )
  }
  const fixed: PlacedPiece[] = [...moved]
  const displaced: PlacedPiece[] = []
  for (const placed of placements) {
    if (movingIds.has(placed.id) || getPlacedSheetIndex(placed) !== sheetIndex) continue
    const current = fresh(placed)
    if (!moved.some((candidate) => collides(candidate, current))) fixed.push(current)
    else if (placed.locked)
      return reject('A locked sticker blocks this move. Choose another position or unlock it.')
    else displaced.push(current)
  }
  const relocated = relocatePlacedPiecesNearest(displaced, fixed, settings)
  if (!relocated)
    return reject(
      'There is not enough free space to rearrange these stickers. Try another position.'
    )
  const updates = new Map([...moved, ...relocated].map((placed) => [placed.id, placed]))
  return {
    placedPieces: placements.map((placed) => updates.get(placed.id) ?? placed),
    movedCount: moved.length,
    rearrangedCount: relocated.length,
    error: null
  }
}
