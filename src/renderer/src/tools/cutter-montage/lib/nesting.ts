import type { CutterLayoutResult, CutterSheetSettings, PiecePreset, PlacedPiece } from '../types'
import {
  getCutterOrderLimitMessage,
  MAX_CUTTER_JOB_COPIES,
  CUTTER_QUANTITY_LIMIT_MESSAGE
} from './layoutLimits'
import { getSafeArea } from './cutterLayout'
import { getPlacedProductionBounds as getPlacedPresetProductionBounds } from './cutlineGenerator'
import { createPlacedPieceFromPreset, refreshPlacedPieceFromPreset } from './piecePresets'
import { mmToCm, roundUpToStep } from './units'
import { calculateUsedArea, sortPiecesForNesting } from './nestingStrategies'
import {
  getPlacedSheetIndex,
  getProductionSheetCount,
  PRODUCTION_SHEET_WIDTH_CM
} from './productionSheets'

const GEOMETRY_EPSILON_CM = 1e-9

export function autoArrangePieces(
  pieces: PiecePreset[],
  settings: CutterSheetSettings,
  existingPieces: PlacedPiece[] = []
): CutterLayoutResult {
  const limitMessage = getCutterOrderLimitMessage(pieces)
  if (limitMessage || existingPieces.length > MAX_CUTTER_JOB_COPIES) {
    const kept = existingPieces.length <= MAX_CUTTER_JOB_COPIES ? existingPieces : []
    return {
      placedPieces: kept,
      placedCount: kept.length,
      requestedCount: kept.length,
      usedHeightCm: 0,
      sheetCount: getProductionSheetCount(kept),
      warning: limitMessage ?? CUTTER_QUANTITY_LIMIT_MESSAGE
    }
  }
  const safeArea = getSafeArea(settings)
  const spacingCm = mmToCm(settings.spacingMm)
  const gridStep = settings.snapToGrid ? settings.gridStepCm : 0.1
  const piecesById = new Map(pieces.map((piece) => [piece.id, piece]))
  const refreshedExistingPieces = existingPieces.map((placed) => {
    const piece = piecesById.get(placed.presetId)
    return piece ? refreshPlacedPieceFromPreset(placed, piece) : placed
  })
  const placedPieces = settings.preserveManualPositions
    ? refreshedExistingPieces
    : refreshedExistingPieces.filter((piece) => piece.locked)
  const retainedCountByPreset = new Map<string, number>()
  for (const placed of placedPieces) {
    retainedCountByPreset.set(
      placed.presetId,
      (retainedCountByPreset.get(placed.presetId) ?? 0) + 1
    )
  }
  // Keep independent free regions so a tall side copy cannot raise a whole row.
  const freeSheets: Bounds[][] = []
  const lastRetainedSheet = placedPieces.reduce(
    (last, placed) => Math.max(last, getPlacedSheetIndex(placed)),
    0
  )
  for (let index = 0; index <= lastRetainedSheet; index += 1) {
    let free = [{ ...safeArea }]
    for (const placed of placedPieces) {
      if (getPlacedSheetIndex(placed) === index) {
        free = subtractFootprint(free, getCachedProductionBounds(placed), spacingCm)
      }
    }
    freeSheets.push(free)
  }

  const requestedCount = pieces.reduce((total, piece) => total + piece.quantity, 0)
  const result = (warning?: string): CutterLayoutResult => {
    const lastSheet = getProductionSheetCount(placedPieces) - 1
    return {
      placedPieces,
      placedCount: placedPieces.length,
      requestedCount,
      usedHeightCm: placedPieces.reduce((bottom, placed) => {
        if (getPlacedSheetIndex(placed) !== lastSheet) return bottom
        const bounds = getCachedProductionBounds(placed)
        return Math.max(bottom, bounds.yCm + bounds.heightCm)
      }, 0),
      sheetCount: getProductionSheetCount(placedPieces),
      ...calculateUsedArea(placedPieces, settings),
      ...(warning ? { warning } : {})
    }
  }

  for (const piece of sortPiecesForNesting(pieces, settings)) {
    const footprints = getPlacementOptions(piece, settings)
    const copiesToPlace = Math.max(0, piece.quantity - (retainedCountByPreset.get(piece.id) ?? 0))
    for (let copy = 0; copy < copiesToPlace; copy += 1) {
      let sheetIndex = 0
      let placement: AvailablePlacement | null = null
      // Fill holes on earlier sheets before using more material.
      for (; sheetIndex < freeSheets.length; sheetIndex += 1) {
        placement = findAvailablePlacement(footprints, freeSheets[sheetIndex], safeArea, gridStep)
        if (placement) break
      }
      if (!placement) {
        placement = findAvailablePlacement(footprints, [safeArea], safeArea, gridStep)
        if (!placement) {
          const remainingCount = requestedCount - placedPieces.length
          return result(
            `${remainingCount} piece(s) exceed the ${PRODUCTION_SHEET_WIDTH_CM} x ${settings.heightCm} cm production limit. First unplaced: ${piece.displayName}.`
          )
        }
        freeSheets.push([{ ...safeArea }])
      }

      // Snap the physical footprint; preserve exact artwork/CutContour offsets.
      const nextPlaced = createPlacedPieceFromPreset(
        piece,
        placement.xCm - placement.footprint.xCm,
        placement.yCm - placement.footprint.yCm,
        placement.rotation
      )
      const bounds = getPlacedPresetProductionBounds(nextPlaced, piece)
      placedPieces.push({ ...nextPlaced, sheetIndex, productionBoundsCm: bounds })
      freeSheets[sheetIndex] = subtractFootprint(freeSheets[sheetIndex], bounds, spacingCm)
    }
  }

  return result()
}

/** Calculate capacity with the same hole-filling and rotation rules as arrangement. */
export function getPieceCapacityForTargetLength(
  piece: PiecePreset,
  settings: CutterSheetSettings,
  targetLengthCm: number
): number {
  const safeArea = getSafeArea({ ...settings, heightCm: targetLengthCm })
  const spacingCm = mmToCm(settings.spacingMm)
  const gridStep = settings.snapToGrid ? settings.gridStepCm : 0.1
  const footprints = getPlacementOptions(piece, settings)
  let free = [{ ...safeArea }]
  let capacity = 0

  while (capacity <= MAX_CUTTER_JOB_COPIES) {
    const placement = findAvailablePlacement(footprints, free, safeArea, gridStep)
    if (!placement) break
    capacity += 1
    free = subtractFootprint(
      free,
      { ...placement.footprint, xCm: placement.xCm, yCm: placement.yCm },
      spacingCm
    )
  }
  return capacity
}

export function createCutterId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

type Bounds = { xCm: number; yCm: number; widthCm: number; heightCm: number }
type PlacementOption = { footprint: Bounds; rotation: 0 | 90 }
type AvailablePlacement = PlacementOption & { xCm: number; yCm: number }

function getPlacementOptions(piece: PiecePreset, settings: CutterSheetSettings): PlacementOption[] {
  const rotations: Array<0 | 90> = settings.allowRotation && piece.rotationAllowed ? [0, 90] : [0]
  return rotations.map((rotation) => ({
    rotation,
    footprint: getPlacedPresetProductionBounds(
      createPlacedPieceFromPreset(piece, 0, 0, rotation),
      piece
    )
  }))
}

function findAvailablePlacement(
  options: PlacementOption[],
  free: Bounds[],
  safeArea: Bounds,
  gridStep: number
): AvailablePlacement | null {
  let best: AvailablePlacement | null = null
  for (const region of free) {
    // Keep the safe-area edge exact, even when the margin itself is off-grid.
    const xCm =
      region.xCm <= safeArea.xCm + GEOMETRY_EPSILON_CM
        ? safeArea.xCm
        : roundUpToStep(region.xCm, gridStep)
    const yCm =
      region.yCm <= safeArea.yCm + GEOMETRY_EPSILON_CM
        ? safeArea.yCm
        : roundUpToStep(region.yCm, gridStep)
    for (const option of options) {
      if (
        xCm + option.footprint.widthCm > region.xCm + region.widthCm + GEOMETRY_EPSILON_CM ||
        yCm + option.footprint.heightCm > region.yCm + region.heightCm + GEOMETRY_EPSILON_CM
      )
        continue
      if (
        !best ||
        yCm < best.yCm - GEOMETRY_EPSILON_CM ||
        (Math.abs(yCm - best.yCm) <= GEOMETRY_EPSILON_CM &&
          (xCm < best.xCm - GEOMETRY_EPSILON_CM ||
            (Math.abs(xCm - best.xCm) <= GEOMETRY_EPSILON_CM && option.rotation < best.rotation)))
      ) {
        best = { ...option, xCm, yCm }
      }
    }
  }
  return best
}

/** Split into maximal free rectangles, retaining holes above/beside each copy. */
function subtractFootprint(free: Bounds[], bounds: Bounds, spacingCm: number): Bounds[] {
  const left = bounds.xCm - spacingCm
  const top = bounds.yCm - spacingCm
  const right = bounds.xCm + bounds.widthCm + spacingCm
  const bottom = bounds.yCm + bounds.heightCm + spacingCm
  const next: Bounds[] = []
  for (const region of free) {
    const regionRight = region.xCm + region.widthCm
    const regionBottom = region.yCm + region.heightCm
    if (
      right <= region.xCm + GEOMETRY_EPSILON_CM ||
      left >= regionRight - GEOMETRY_EPSILON_CM ||
      bottom <= region.yCm + GEOMETRY_EPSILON_CM ||
      top >= regionBottom - GEOMETRY_EPSILON_CM
    ) {
      next.push(region)
      continue
    }
    if (left > region.xCm + GEOMETRY_EPSILON_CM) {
      next.push({ ...region, widthCm: left - region.xCm })
    }
    if (right < regionRight - GEOMETRY_EPSILON_CM) {
      next.push({ ...region, xCm: right, widthCm: regionRight - right })
    }
    if (top > region.yCm + GEOMETRY_EPSILON_CM) {
      next.push({ ...region, heightCm: top - region.yCm })
    }
    if (bottom < regionBottom - GEOMETRY_EPSILON_CM) {
      next.push({ ...region, yCm: bottom, heightCm: regionBottom - bottom })
    }
  }
  // The split rectangles intentionally overlap. Remove redundant contained ones.
  return next.filter(
    (region, index) =>
      !next.some(
        (other, otherIndex) =>
          index !== otherIndex &&
          contains(other, region) &&
          (otherIndex < index || !contains(region, other))
      )
  )
}

function contains(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.xCm >= outer.xCm - GEOMETRY_EPSILON_CM &&
    inner.yCm >= outer.yCm - GEOMETRY_EPSILON_CM &&
    inner.xCm + inner.widthCm <= outer.xCm + outer.widthCm + GEOMETRY_EPSILON_CM &&
    inner.yCm + inner.heightCm <= outer.yCm + outer.heightCm + GEOMETRY_EPSILON_CM
  )
}

function getCachedProductionBounds(placed: PlacedPiece): {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
} {
  return (
    placed.productionBoundsCm ?? {
      xCm: placed.xCm,
      yCm: placed.yCm,
      widthCm: placed.widthCm,
      heightCm: placed.heightCm
    }
  )
}
