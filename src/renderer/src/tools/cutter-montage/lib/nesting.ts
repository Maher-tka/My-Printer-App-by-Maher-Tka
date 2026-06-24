import type { CutterLayoutResult, CutterSheetSettings, PiecePreset, PlacedPiece } from '../types'
import { getSafeArea } from './cutterLayout'
import { createPlacedPieceFromPreset } from './piecePresets'
import { mmToCm, roundToStep } from './units'

export function autoArrangePieces(
  pieces: PiecePreset[],
  settings: CutterSheetSettings,
  existingPieces: PlacedPiece[] = []
): CutterLayoutResult {
  const safeArea = getSafeArea(settings)
  const spacingCm = mmToCm(settings.spacingMm)
  const gridStep = settings.snapToGrid ? settings.gridStepCm : 0.1
  const placedPieces = settings.preserveManualPositions ? [...existingPieces] : []
  let cursorX = safeArea.xCm
  let cursorY = safeArea.yCm
  let rowHeight = 0

  if (settings.preserveManualPositions && placedPieces.length > 0) {
    const lowestBottom = Math.max(
      ...placedPieces.map((piece) => piece.yCm + piece.heightCm),
      safeArea.yCm
    )
    cursorY = roundToStep(lowestBottom + spacingCm, gridStep)
  }

  let placedCount = 0
  const requestedCount = pieces.reduce((total, piece) => total + piece.quantity, 0)

  for (const piece of pieces) {
    for (let copy = 0; copy < piece.quantity; copy += 1) {
      const placement = choosePlacement(piece, settings, cursorX, safeArea)

      if (!placement) {
        cursorX = safeArea.xCm
        cursorY = roundToStep(cursorY + rowHeight + spacingCm, gridStep)
        rowHeight = 0
      }

      const nextPlacement = placement ?? choosePlacement(piece, settings, cursorX, safeArea)

      if (!nextPlacement || cursorY + nextPlacement.heightCm > safeArea.yCm + safeArea.heightCm) {
        return {
          placedPieces,
          placedCount,
          requestedCount,
          usedHeightCm: cursorY,
          warning: `${requestedCount - placedCount} piece(s) did not fit on the sheet.`
        }
      }

      placedPieces.push(
        createPlacedPieceFromPreset(
          piece,
          roundToStep(cursorX, gridStep),
          roundToStep(cursorY, gridStep),
          nextPlacement.rotation
        )
      )

      placedCount += 1
      cursorX = roundToStep(cursorX + nextPlacement.widthCm + spacingCm, gridStep)
      rowHeight = Math.max(rowHeight, nextPlacement.heightCm)
    }
  }

  return {
    placedPieces,
    placedCount,
    requestedCount,
    usedHeightCm: cursorY + rowHeight
  }
}

export function createCutterId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function choosePlacement(
  piece: PiecePreset,
  settings: CutterSheetSettings,
  cursorX: number,
  safeArea: ReturnType<typeof getSafeArea>
): { widthCm: number; heightCm: number; rotation: 0 | 90 } | null {
  const fitsNormal = cursorX + piece.widthCm <= safeArea.xCm + safeArea.widthCm

  if (fitsNormal) {
    return {
      widthCm: piece.widthCm,
      heightCm: piece.heightCm,
      rotation: 0
    }
  }

  if (
    settings.allowRotation &&
    piece.rotationAllowed &&
    cursorX + piece.heightCm <= safeArea.xCm + safeArea.widthCm &&
    piece.widthCm <= settings.heightCm
  ) {
    return {
      widthCm: piece.heightCm,
      heightCm: piece.widthCm,
      rotation: 90
    }
  }

  return null
}
