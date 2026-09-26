import type { CutterProject } from '../types'
import { calculateUsedArea } from './nestingStrategies'
import { getProductionSheetCount, getProductionSheetHeight } from './productionSheets'

export interface SheetUsageStats {
  usedAreaPercent: number
  wasteAreaPercent: number
  usedHeightCm: number
  remainingHeightCm: number
  placedCount: number
  requestedCount: number
  unplacedCount: number
  duplicateCountByDesign: Array<{ displayName: string; count: number }>
  estimatedMaterialUsedCm: number
  estimatedMaterialUsedMeters: number
  sheetCount: number
}

export function getSheetUsageStats(project: CutterProject): SheetUsageStats {
  const usage = calculateUsedArea(project.placedPieces, project.sheet)
  const sheetCount =
    project.placedPieces.length === 0 ? 0 : getProductionSheetCount(project.placedPieces)
  const sheetHeights = Array.from({ length: sheetCount }, (_, sheetIndex) =>
    getProductionSheetHeight(project.placedPieces, project.sheet, sheetIndex)
  )
  const usedHeightCm = sheetHeights.reduce((total, height) => total + height, 0)
  const requestedCount = project.pieces.reduce((total, piece) => total + piece.quantity, 0)
  const countByPreset = new Map<string, number>()

  for (const placed of project.placedPieces) {
    countByPreset.set(placed.presetId, (countByPreset.get(placed.presetId) ?? 0) + 1)
  }

  return {
    ...usage,
    usedHeightCm,
    remainingHeightCm: Math.max(sheetCount * project.sheet.heightCm - usedHeightCm, 0),
    placedCount: project.placedPieces.length,
    requestedCount,
    unplacedCount: Math.max(requestedCount - project.placedPieces.length, 0),
    duplicateCountByDesign: project.pieces
      .map((piece) => ({
        displayName: piece.displayName,
        count: countByPreset.get(piece.id) ?? 0
      }))
      .filter((item) => item.count > 1),
    estimatedMaterialUsedCm: usedHeightCm,
    estimatedMaterialUsedMeters: usedHeightCm / 100,
    sheetCount
  }
}
