import type { CutterLayoutResult, CutterSheetSettings, PiecePreset, PlacedPiece } from '../types'
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
  let cursorX = safeArea.xCm
  let cursorY = safeArea.yCm
  let rowHeight = 0
  let sheetIndex = 0

  if (settings.preserveManualPositions && placedPieces.length > 0) {
    sheetIndex = Math.max(...placedPieces.map(getPlacedSheetIndex))
    const currentSheetPieces = placedPieces.filter(
      (piece) => getPlacedSheetIndex(piece) === sheetIndex
    )
    const lowestBottom = Math.max(
      ...currentSheetPieces.map((piece) => {
        const bounds = getCachedProductionBounds(piece)
        return bounds.yCm + bounds.heightCm
      }),
      safeArea.yCm
    )
    cursorY = roundUpToStep(lowestBottom + spacingCm, gridStep)
  }

  let placedCount = placedPieces.length
  const requestedCount = pieces.reduce((total, piece) => total + piece.quantity, 0)

  for (const piece of sortPiecesForNesting(pieces, settings)) {
    const copiesToPlace = Math.max(0, piece.quantity - (retainedCountByPreset.get(piece.id) ?? 0))
    for (let copy = 0; copy < copiesToPlace; copy += 1) {
      let placement = findAvailablePlacement(
        piece,
        settings,
        cursorX,
        cursorY,
        safeArea,
        placedPieces,
        sheetIndex
      )

      if (!placement) {
        cursorX = safeArea.xCm
        cursorY = roundUpToStep(cursorY + rowHeight + spacingCm, gridStep)
        rowHeight = 0
        placement = findAvailablePlacement(
          piece,
          settings,
          cursorX,
          cursorY,
          safeArea,
          placedPieces,
          sheetIndex
        )
      }

      if (!placement) {
        sheetIndex += 1
        cursorX = safeArea.xCm
        cursorY = safeArea.yCm
        rowHeight = 0
        placement = findAvailablePlacement(
          piece,
          settings,
          cursorX,
          cursorY,
          safeArea,
          placedPieces,
          sheetIndex
        )
      }

      if (!placement) {
        const remainingCount = requestedCount - placedCount
        return {
          placedPieces,
          placedCount,
          requestedCount,
          usedHeightCm: cursorY,
          sheetCount: getProductionSheetCount(placedPieces),
          ...calculateUsedArea(placedPieces, settings),
          warning: `${remainingCount} piece(s) are larger than the ${PRODUCTION_SHEET_WIDTH_CM} cm production width. First unplaced: ${piece.displayName}.`
        }
      }

      if (cursorY + placement.heightCm > safeArea.yCm + safeArea.heightCm + GEOMETRY_EPSILON_CM) {
        sheetIndex += 1
        cursorX = safeArea.xCm
        cursorY = safeArea.yCm
        rowHeight = 0
        placement = findAvailablePlacement(
          piece,
          settings,
          cursorX,
          cursorY,
          safeArea,
          placedPieces,
          sheetIndex
        )
      }

      if (
        !placement ||
        cursorY + placement.heightCm > safeArea.yCm + safeArea.heightCm + GEOMETRY_EPSILON_CM
      ) {
        const remainingCount = requestedCount - placedCount
        return {
          placedPieces,
          placedCount,
          requestedCount,
          usedHeightCm: cursorY,
          sheetCount: getProductionSheetCount(placedPieces),
          ...calculateUsedArea(placedPieces, settings),
          warning: `${remainingCount} piece(s) exceed the ${PRODUCTION_SHEET_WIDTH_CM} x ${settings.heightCm} cm production limit. First unplaced: ${piece.displayName}.`
        }
      }

      // The production footprint is already snapped at the cursor. Its piece origin can be
      // off-grid when a physical CutContour offset is present and must remain exact.
      const nextPlaced = createPlacedPieceFromPreset(
        piece,
        placement.xCm,
        placement.yCm,
        placement.rotation
      )
      placedPieces.push({
        ...nextPlaced,
        sheetIndex,
        productionBoundsCm: getPlacedPresetProductionBounds(nextPlaced, piece)
      })

      placedCount += 1
      cursorX = roundUpToStep(
        placement.xCm + placement.originOffsetXcm + placement.widthCm + spacingCm,
        gridStep
      )
      rowHeight = Math.max(rowHeight, placement.heightCm)
    }
  }

  return {
    placedPieces,
    placedCount,
    requestedCount,
    usedHeightCm: cursorY + rowHeight,
    sheetCount: getProductionSheetCount(placedPieces),
    ...calculateUsedArea(placedPieces, settings)
  }
}

/** Calculate how many copies of one prepared piece fit in one material length. */
export function getPieceCapacityForTargetLength(
  piece: PiecePreset,
  settings: CutterSheetSettings,
  targetLengthCm: number
): number {
  const targetSettings = { ...settings, heightCm: targetLengthCm }
  const safeArea = getSafeArea(targetSettings)
  const spacingCm = mmToCm(targetSettings.spacingMm)
  const gridStep = targetSettings.snapToGrid ? targetSettings.gridStepCm : 0.1
  const safeBottom = safeArea.yCm + safeArea.heightCm
  let cursorX = safeArea.xCm
  let cursorY = safeArea.yCm
  let rowHeight = 0
  let capacity = 0

  for (let safety = 0; safety < 100_000; safety += 1) {
    let placement = choosePlacement(piece, targetSettings, cursorX, safeArea)

    if (!placement) {
      if (rowHeight <= 0) break
      cursorX = safeArea.xCm
      cursorY = roundUpToStep(cursorY + rowHeight + spacingCm, gridStep)
      rowHeight = 0
      placement = choosePlacement(piece, targetSettings, cursorX, safeArea)
    }

    if (!placement || cursorY + placement.heightCm > safeBottom + GEOMETRY_EPSILON_CM) {
      break
    }

    capacity += 1
    cursorX = roundUpToStep(cursorX + placement.widthCm + spacingCm, gridStep)
    rowHeight = Math.max(rowHeight, placement.heightCm)
  }

  return capacity
}

export function createCutterId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function choosePlacement(
  piece: PiecePreset,
  settings: CutterSheetSettings,
  cursorX: number,
  safeArea: ReturnType<typeof getSafeArea>
): {
  widthCm: number
  heightCm: number
  rotation: 0 | 90
  originOffsetXcm: number
  originOffsetYcm: number
} | null {
  const normal = getPlacementFootprint(piece, 0)
  const fitsNormal =
    cursorX + normal.widthCm <= safeArea.xCm + safeArea.widthCm + GEOMETRY_EPSILON_CM

  if (fitsNormal) {
    return {
      widthCm: normal.widthCm,
      heightCm: normal.heightCm,
      rotation: 0,
      originOffsetXcm: normal.xCm,
      originOffsetYcm: normal.yCm
    }
  }

  const rotated = getPlacementFootprint(piece, 90)
  if (
    settings.allowRotation &&
    piece.rotationAllowed &&
    cursorX + rotated.widthCm <= safeArea.xCm + safeArea.widthCm + GEOMETRY_EPSILON_CM &&
    rotated.heightCm <= safeArea.heightCm + GEOMETRY_EPSILON_CM
  ) {
    return {
      widthCm: rotated.widthCm,
      heightCm: rotated.heightCm,
      rotation: 90,
      originOffsetXcm: rotated.xCm,
      originOffsetYcm: rotated.yCm
    }
  }

  return null
}

function getPlacementFootprint(
  piece: PiecePreset,
  rotation: 0 | 90
): { xCm: number; yCm: number; widthCm: number; heightCm: number } {
  const placed = createPlacedPieceFromPreset(piece, 0, 0, rotation)
  return getPlacedPresetProductionBounds(placed, piece)
}

type AvailablePlacement = ReturnType<typeof choosePlacement> & {
  xCm: number
  yCm: number
}

function findAvailablePlacement(
  piece: PiecePreset,
  settings: CutterSheetSettings,
  cursorX: number,
  cursorY: number,
  safeArea: ReturnType<typeof getSafeArea>,
  placedPieces: PlacedPiece[],
  sheetIndex: number
): AvailablePlacement | null {
  const spacingCm = mmToCm(settings.spacingMm)
  const gridStep = settings.snapToGrid ? settings.gridStepCm : 0.1
  let candidateCursorX = cursorX

  for (let attempt = 0; attempt < placedPieces.length + 2; attempt += 1) {
    const placement = choosePlacement(piece, settings, candidateCursorX, safeArea)
    if (!placement) return null

    const candidate = {
      ...placement,
      xCm: candidateCursorX - placement.originOffsetXcm,
      yCm: cursorY - placement.originOffsetYcm
    }
    const collision = placedPieces.find((placed) => {
      if (getPlacedSheetIndex(placed) !== sheetIndex) return false
      return rectanglesOverlap(
        {
          xCm: candidate.xCm + candidate.originOffsetXcm,
          yCm: candidate.yCm + candidate.originOffsetYcm,
          widthCm: candidate.widthCm,
          heightCm: candidate.heightCm
        },
        getCachedProductionBounds(placed),
        spacingCm
      )
    })

    if (!collision) return candidate
    const bounds = getCachedProductionBounds(collision)
    candidateCursorX = roundUpToStep(bounds.xCm + bounds.widthCm + spacingCm, gridStep)
  }

  return null
}

function rectanglesOverlap(
  first: { xCm: number; yCm: number; widthCm: number; heightCm: number },
  second: { xCm: number; yCm: number; widthCm: number; heightCm: number },
  paddingCm: number
): boolean {
  return !(
    first.xCm + first.widthCm + paddingCm <= second.xCm + GEOMETRY_EPSILON_CM ||
    second.xCm + second.widthCm + paddingCm <= first.xCm + GEOMETRY_EPSILON_CM ||
    first.yCm + first.heightCm + paddingCm <= second.yCm + GEOMETRY_EPSILON_CM ||
    second.yCm + second.heightCm + paddingCm <= first.yCm + GEOMETRY_EPSILON_CM
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
