import type { CutterSheetSettings, PiecePreset, PlacedPiece } from '../types'
import { getPlacedSheetIndex, getProductionSheetCount } from './productionSheets'

export function sortPiecesForNesting(
  pieces: PiecePreset[],
  settings: CutterSheetSettings
): PiecePreset[] {
  const strategy = settings.sortStrategy ?? 'largest-first'
  const sorted = [...pieces]
  const groupTie = (a: PiecePreset, b: PiecePreset): number =>
    settings.preferSameDesignGrouping ? a.sourceFileName.localeCompare(b.sourceFileName) : 0
  if (strategy === 'smallest-first')
    return sorted.sort((a, b) => area(a) - area(b) || groupTie(a, b))
  if (strategy === 'piece-name')
    return sorted.sort((a, b) => a.displayName.localeCompare(b.displayName))
  if (strategy === 'quantity')
    return sorted.sort((a, b) => b.quantity - a.quantity || groupTie(a, b) || area(b) - area(a))
  return sorted.sort((a, b) => area(b) - area(a) || groupTie(a, b))
}

export function calculateUsedArea(
  placedPieces: PlacedPiece[],
  sheet: CutterSheetSettings
): { usedAreaPercent: number; wasteAreaPercent: number } {
  if (!isFinitePositive(sheet.widthCm) || !isFinitePositive(sheet.heightCm)) {
    return { usedAreaPercent: 100, wasteAreaPercent: 0 }
  }
  if (placedPieces.some((piece) => !hasFinitePlacementGeometry(piece))) {
    return { usedAreaPercent: 100, wasteAreaPercent: 0 }
  }
  const sheetArea = Math.max(
    sheet.widthCm * sheet.heightCm * getProductionSheetCount(placedPieces),
    0.0001
  )
  const usedArea = placedPieces.reduce((sum, piece) => {
    const bounds = getProductionBounds(piece)
    if (!bounds) return Number.POSITIVE_INFINITY
    return sum + bounds.widthCm * bounds.heightCm
  }, 0)
  const usedAreaPercent = Math.min(100, (usedArea / sheetArea) * 100)
  return { usedAreaPercent, wasteAreaPercent: Math.max(0, 100 - usedAreaPercent) }
}

export function detectOutOfBounds(
  placedPieces: PlacedPiece[],
  sheet: CutterSheetSettings
): string[] {
  const validSheet = isFinitePositive(sheet.widthCm) && isFinitePositive(sheet.heightCm)
  return placedPieces
    .filter((piece) => {
      const bounds = getProductionBounds(piece)
      if (!validSheet || !bounds) return true
      return (
        bounds.xCm < 0 ||
        bounds.yCm < 0 ||
        bounds.xCm + bounds.widthCm > sheet.widthCm ||
        bounds.yCm + bounds.heightCm > sheet.heightCm
      )
    })
    .map((piece) => piece.id)
}

export function detectOverlaps(placedPieces: PlacedPiece[]): Array<[string, string]> {
  const overlaps: Array<[string, string]> = []
  for (let leftIndex = 0; leftIndex < placedPieces.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < placedPieces.length; rightIndex += 1) {
      const left = placedPieces[leftIndex]
      const right = placedPieces[rightIndex]
      if (!couldShareSheet(left, right)) continue
      if (rectanglesOverlap(left, right)) overlaps.push([left.id, right.id])
    }
  }
  return overlaps
}

function rectanglesOverlap(left: PlacedPiece, right: PlacedPiece): boolean {
  const leftBounds = getProductionBounds(left)
  const rightBounds = getProductionBounds(right)
  if (!leftBounds || !rightBounds) return true
  return (
    leftBounds.xCm < rightBounds.xCm + rightBounds.widthCm &&
    leftBounds.xCm + leftBounds.widthCm > rightBounds.xCm &&
    leftBounds.yCm < rightBounds.yCm + rightBounds.heightCm &&
    leftBounds.yCm + leftBounds.heightCm > rightBounds.yCm
  )
}

/**
 * Invalid geometry is unsafe by contract: out-of-bounds checks report it,
 * same-sheet overlap checks treat it as a collision, and area usage saturates.
 */
function getProductionBounds(piece: PlacedPiece): PlacedPiece['productionBoundsCm'] | null {
  if (!hasFinitePlacementGeometry(piece)) return null
  const bounds = piece.productionBoundsCm ?? piece
  return isFiniteBounds(bounds) ? bounds : null
}

function hasFinitePlacementGeometry(piece: PlacedPiece): boolean {
  return (
    isFiniteNumber(piece.xCm) &&
    isFiniteNumber(piece.yCm) &&
    isFinitePositive(piece.widthCm) &&
    isFinitePositive(piece.heightCm) &&
    isFiniteNumber(piece.rotation) &&
    (piece.sheetIndex === undefined || isFiniteNumber(piece.sheetIndex)) &&
    isFiniteTransform(piece.artworkTransform) &&
    isFiniteTransform(piece.maskTransform) &&
    isFiniteTransform(piece.cutlineTransform) &&
    isFiniteNumber(piece.cutlineTransform.offsetMm)
  )
}

function isFiniteTransform(transform: {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotation: number
}): boolean {
  return (
    isFiniteNumber(transform.xCm) &&
    isFiniteNumber(transform.yCm) &&
    isFinitePositive(transform.widthCm) &&
    isFinitePositive(transform.heightCm) &&
    isFiniteNumber(transform.rotation)
  )
}

function isFiniteBounds(bounds: {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
}): boolean {
  return (
    isFiniteNumber(bounds.xCm) &&
    isFiniteNumber(bounds.yCm) &&
    isFinitePositive(bounds.widthCm) &&
    isFinitePositive(bounds.heightCm)
  )
}

function couldShareSheet(left: PlacedPiece, right: PlacedPiece): boolean {
  if (!isFiniteNumber(left.sheetIndex ?? 0) || !isFiniteNumber(right.sheetIndex ?? 0)) return true
  return getPlacedSheetIndex(left) === getPlacedSheetIndex(right)
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function area(piece: PiecePreset): number {
  const value = piece.widthCm * piece.heightCm
  return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY
}
