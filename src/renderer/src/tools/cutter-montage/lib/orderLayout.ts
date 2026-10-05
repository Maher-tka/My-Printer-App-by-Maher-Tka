import type { CutterSheetSettings, PiecePreset, PlacedPiece } from '../types'
import { autoArrangePieces, getPieceCapacityForTargetLength } from './nesting'
import { MAX_PRODUCTION_SHEET_HEIGHT_CM, MIN_PRODUCTION_SHEET_HEIGHT_CM } from './productionSheets'

/** Only production inputs invalidate a layout; selection and view settings do not. */
export function getOrderLayoutSignature(pieces: PiecePreset[], sheet: CutterSheetSettings): string {
  return JSON.stringify({
    sheet: [
      sheet.heightCm,
      sheet.safeMarginCm,
      sheet.spacingMm,
      sheet.snapToGrid,
      sheet.gridStepCm,
      sheet.allowRotation,
      sheet.preserveManualPositions,
      sheet.lengthMode,
      sheet.autoExpandHeight,
      sheet.preferSameDesignGrouping,
      sheet.fillDirection,
      sheet.sortStrategy
    ],
    pieces: pieces.map((piece) => ({
      id: piece.id,
      quantity: piece.quantity,
      orderMode: piece.orderMode,
      targetLengthCm: piece.targetLengthCm,
      widthCm: piece.widthCm,
      heightCm: piece.heightCm,
      rotationAllowed: piece.rotationAllowed,
      locked: piece.locked,
      clippingMaskEnabled: piece.clippingMaskEnabled,
      maskObjectId: piece.maskObjectId,
      geometry: piece.objects
        .filter((object) => object.role !== 'helper')
        .map((object) => ({
          id: object.id,
          role: object.role,
          shapeType: object.shapeType,
          transform: object.transform,
          offsetMm: object.offsetMm,
          exportEnabled: object.exportEnabled
        }))
    }))
  })
}

/** Recalculate metre orders, then pack every design using current requested quantities. */
export function rebuildOrderLayout(
  pieces: PiecePreset[],
  sheet: CutterSheetSettings,
  placedPieces: PlacedPiece[]
) {
  const nextPieces = pieces.map((piece) =>
    piece.orderMode === 'target-length'
      ? {
          ...piece,
          quantity: Math.max(
            1,
            getPieceCapacityForTargetLength(piece, sheet, piece.targetLengthCm ?? sheet.heightCm)
          )
        }
      : piece
  )
  const quantities = new Map(nextPieces.map((piece) => [piece.id, piece.quantity]))
  const retainedCounts = new Map<string, number>()
  const retained = placedPieces.filter((placed) => {
    if (!sheet.preserveManualPositions && !placed.locked) return false
    const count = retainedCounts.get(placed.presetId) ?? 0
    if (count >= (quantities.get(placed.presetId) ?? 0)) return false
    retainedCounts.set(placed.presetId, count + 1)
    return true
  })
  const packingSheet = sheet.autoExpandHeight
    ? { ...sheet, heightCm: MAX_PRODUCTION_SHEET_HEIGHT_CM }
    : sheet
  const arranged = autoArrangePieces(nextPieces, packingSheet, retained)
  const usedBottom = arranged.placedPieces.reduce((bottom, placed) => {
    const bounds = placed.productionBoundsCm ?? placed
    return Math.max(bottom, bounds.yCm + bounds.heightCm)
  }, 0)
  const finalSheet = sheet.autoExpandHeight
    ? {
        ...sheet,
        lengthMode: 'auto-trim-last' as const,
        heightCm: Math.min(
          MAX_PRODUCTION_SHEET_HEIGHT_CM,
          Math.max(
            MIN_PRODUCTION_SHEET_HEIGHT_CM,
            Math.ceil((usedBottom + sheet.safeMarginCm) * 2) / 2
          )
        )
      }
    : sheet
  return { pieces: nextPieces, sheet: finalSheet, ...arranged }
}

export function getSheetDesignCounts(pieces: PiecePreset[], placements: PlacedPiece[]) {
  const counts = new Map<string, number>()
  for (const placement of placements) {
    counts.set(placement.presetId, (counts.get(placement.presetId) ?? 0) + 1)
  }
  return pieces
    .filter((piece) => counts.has(piece.id))
    .map((piece) => ({
      id: piece.id,
      displayName: piece.displayName,
      count: counts.get(piece.id)!
    }))
}
