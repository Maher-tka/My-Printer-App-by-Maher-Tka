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
  let lastSheetIndex = 0
  for (const piece of placedPieces)
    lastSheetIndex = Math.max(lastSheetIndex, getPlacedSheetIndex(piece))
  return lastSheetIndex + 1
}

export function getProductionSheetHeight(
  placedPieces: PlacedPiece[],
  settings: CutterSheetSettings,
  sheetIndex: number
): number {
  return getSheetHeight(
    placedPieces.filter((piece) => getPlacedSheetIndex(piece) === sheetIndex),
    settings,
    sheetIndex,
    getProductionSheetCount(placedPieces) - 1
  )
}

function getSheetHeight(
  pieces: PlacedPiece[],
  settings: CutterSheetSettings,
  sheetIndex: number,
  finalSheetIndex: number
): number {
  const requestedHeightCm = Number.isFinite(settings.heightCm)
    ? settings.heightCm
    : PREFERRED_PRODUCTION_SHEET_HEIGHT_CM
  const configuredHeightCm = Math.min(
    Math.max(requestedHeightCm, MIN_PRODUCTION_SHEET_HEIGHT_CM),
    MAX_PRODUCTION_SHEET_HEIGHT_CM
  )

  if (settings.lengthMode === 'fixed' || sheetIndex < finalSheetIndex) {
    return configuredHeightCm
  }

  if (pieces.length === 0) return Math.min(configuredHeightCm, settings.safeMarginCm * 2 + 1)
  let usedBottom = -Infinity
  for (const piece of pieces) {
    const bounds = piece.productionBoundsCm ?? piece
    usedBottom = Math.max(usedBottom, bounds.yCm + bounds.heightCm)
  }
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
  return getArtworkWidth(
    placedPieces.filter((piece) => getPlacedSheetIndex(piece) === sheetIndex),
    settings
  )
}

function getArtworkWidth(pieces: PlacedPiece[], settings: CutterSheetSettings): number {
  if (pieces.length === 0) return Math.min(PRODUCTION_SHEET_WIDTH_CM, settings.safeMarginCm * 2 + 1)
  let usedRight = -Infinity
  for (const piece of pieces) {
    const bounds = piece.productionBoundsCm ?? piece
    usedRight = Math.max(usedRight, bounds.xCm + bounds.widthCm)
  }
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

/** Partition once when all sheets are needed, rather than scanning the job for each sheet. */
export function getProductionSheetProjects<T extends Pick<CutterProject, 'sheet' | 'placedPieces'>>(
  project: T
): T[] {
  const placementsBySheet = new Map<number, PlacedPiece[]>()
  const sheetCount = getProductionSheetCount(project.placedPieces)
  for (const piece of project.placedPieces) {
    const index = getPlacedSheetIndex(piece)
    const placements = placementsBySheet.get(index)
    if (placements) placements.push(piece)
    else placementsBySheet.set(index, [piece])
  }
  return Array.from({ length: sheetCount }, (_, sheetIndex) => {
    const placements = placementsBySheet.get(sheetIndex) ?? []
    return {
      ...project,
      sheet: {
        ...project.sheet,
        widthCm: getArtworkWidth(placements, project.sheet),
        heightCm: getSheetHeight(placements, project.sheet, sheetIndex, sheetCount - 1)
      },
      placedPieces: placements
    }
  })
}

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
