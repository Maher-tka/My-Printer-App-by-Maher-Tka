import type { CutterProject, CutterSheetSettings, PlacedPiece } from '../types'

export const PRODUCTION_SHEET_WIDTH_CM = 96
export const MIN_PRODUCTION_SHEET_HEIGHT_CM = 50
export const PREFERRED_PRODUCTION_SHEET_HEIGHT_CM = 100
export const MAX_PRODUCTION_SHEET_HEIGHT_CM = 140
export const MAX_VINYL_ROLL_WIDTH_CM = 103
export const PRODUCTION_SHEET_LENGTH_PRESETS_CM = [50, 100, 130, 140] as const

export function getPlacedSheetIndex(piece: PlacedPiece): number {
  return Math.max(0, Math.floor(piece.sheetIndex ?? 0))
}

export function getProductionSheetCount(placedPieces: PlacedPiece[]): number {
  if (placedPieces.length === 0) return 1
  return Math.max(...placedPieces.map(getPlacedSheetIndex)) + 1
}

export function getProductionSheetHeight(
  placedPieces: PlacedPiece[],
  settings: CutterSheetSettings,
  sheetIndex: number
): number {
  const requestedHeightCm = Number.isFinite(settings.heightCm)
    ? settings.heightCm
    : PREFERRED_PRODUCTION_SHEET_HEIGHT_CM
  const configuredHeightCm = Math.min(
    Math.max(requestedHeightCm, MIN_PRODUCTION_SHEET_HEIGHT_CM),
    MAX_PRODUCTION_SHEET_HEIGHT_CM
  )
  const pieces = placedPieces.filter((piece) => getPlacedSheetIndex(piece) === sheetIndex)
  const finalSheetIndex = getProductionSheetCount(placedPieces) - 1

  if (settings.lengthMode === 'fixed' || sheetIndex < finalSheetIndex) {
    return configuredHeightCm
  }

  if (pieces.length === 0) return Math.min(configuredHeightCm, settings.safeMarginCm * 2 + 1)
  const usedBottom = Math.max(
    ...pieces.map((piece) => {
      const bounds = piece.productionBoundsCm ?? piece
      return bounds.yCm + bounds.heightCm
    })
  )
  return Math.min(
    settings.autoExpandHeight ? MAX_PRODUCTION_SHEET_HEIGHT_CM : configuredHeightCm,
    Math.max(1, Math.ceil((usedBottom + settings.safeMarginCm) * 2) / 2)
  )
}

export function getProductionArtworkWidth(
  placedPieces: PlacedPiece[],
  settings: CutterSheetSettings,
  sheetIndex: number
): number {
  const pieces = placedPieces.filter((piece) => getPlacedSheetIndex(piece) === sheetIndex)
  if (pieces.length === 0) return Math.min(PRODUCTION_SHEET_WIDTH_CM, settings.safeMarginCm * 2 + 1)
  const usedRight = Math.max(
    ...pieces.map((piece) => {
      const bounds = piece.productionBoundsCm ?? piece
      return bounds.xCm + bounds.widthCm
    })
  )
  return Math.min(
    PRODUCTION_SHEET_WIDTH_CM,
    Math.max(1, Math.ceil((usedRight + settings.safeMarginCm) * 2) / 2)
  )
}

export function getProductionSheetWidth(
  placedPieces: PlacedPiece[],
  settings: CutterSheetSettings,
  sheetIndex: number
): number {
  return getProductionArtworkWidth(placedPieces, settings, sheetIndex)
}

export const getMarkedSheetWidth = getProductionSheetWidth

/** A standalone sheet starts at page zero, including later sheets in a job. */
export function getSingleProductionSheetProject(
  project: CutterProject,
  sheetIndex: number
): CutterProject {
  const sheet = getProductionSheetProject(project, sheetIndex)
  const ids = new Set(sheet.placedPieces.map((placed) => placed.presetId))
  return {
    ...sheet,
    pieces: sheet.pieces.filter((piece) => ids.has(piece.id)),
    placedPieces: sheet.placedPieces.map((placed) => ({ ...placed, sheetIndex: 0 }))
  }
}

export function getProductionSheetProject(
  project: CutterProject,
  sheetIndex: number
): CutterProject {
  const placements = project.placedPieces.filter(
    (piece) => getPlacedSheetIndex(piece) === sheetIndex
  )

  return {
    ...project,
    sheet: {
      ...project.sheet,
      widthCm: getProductionSheetWidth(project.placedPieces, project.sheet, sheetIndex),
      heightCm: getProductionSheetHeight(project.placedPieces, project.sheet, sheetIndex)
    },
    placedPieces: placements
  }
}
