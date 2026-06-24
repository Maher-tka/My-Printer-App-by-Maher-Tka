import type { CutterSheetSettings, PiecePreset, PlacedPiece } from '../types'

export function sortPiecesForNesting(
  pieces: PiecePreset[],
  settings: CutterSheetSettings
): PiecePreset[] {
  const strategy = settings.sortStrategy ?? 'largest-first'
  const sorted = [...pieces]
  if (strategy === 'smallest-first') return sorted.sort((a, b) => area(a) - area(b))
  if (strategy === 'piece-name')
    return sorted.sort((a, b) => a.displayName.localeCompare(b.displayName))
  if (strategy === 'quantity')
    return sorted.sort((a, b) => b.quantity - a.quantity || area(b) - area(a))
  return sorted.sort((a, b) => area(b) - area(a))
}

export function calculateUsedArea(
  placedPieces: PlacedPiece[],
  sheet: CutterSheetSettings
): { usedAreaPercent: number; wasteAreaPercent: number } {
  const sheetArea = Math.max(sheet.widthCm * sheet.heightCm, 0.0001)
  const usedArea = placedPieces.reduce((sum, piece) => sum + piece.widthCm * piece.heightCm, 0)
  const usedAreaPercent = Math.min(100, (usedArea / sheetArea) * 100)
  return { usedAreaPercent, wasteAreaPercent: Math.max(0, 100 - usedAreaPercent) }
}

export function detectOutOfBounds(
  placedPieces: PlacedPiece[],
  sheet: CutterSheetSettings
): string[] {
  return placedPieces
    .filter(
      (piece) =>
        piece.xCm < 0 ||
        piece.yCm < 0 ||
        piece.xCm + piece.widthCm > sheet.widthCm ||
        piece.yCm + piece.heightCm > sheet.heightCm
    )
    .map((piece) => piece.id)
}

export function detectOverlaps(placedPieces: PlacedPiece[]): Array<[string, string]> {
  const overlaps: Array<[string, string]> = []
  for (let leftIndex = 0; leftIndex < placedPieces.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < placedPieces.length; rightIndex += 1) {
      const left = placedPieces[leftIndex]
      const right = placedPieces[rightIndex]
      if (rectanglesOverlap(left, right)) overlaps.push([left.id, right.id])
    }
  }
  return overlaps
}

function rectanglesOverlap(left: PlacedPiece, right: PlacedPiece): boolean {
  return (
    left.xCm < right.xCm + right.widthCm &&
    left.xCm + left.widthCm > right.xCm &&
    left.yCm < right.yCm + right.heightCm &&
    left.yCm + left.heightCm > right.yCm
  )
}

function area(piece: PiecePreset): number {
  return piece.widthCm * piece.heightCm
}
