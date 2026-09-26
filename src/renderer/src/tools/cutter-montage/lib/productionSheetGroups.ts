import type { CutterProject, PlacedPiece } from '../types'
import { getProductionSheetCount, getProductionSheetProject } from './productionSheets'

export interface ProductionSheetLayoutGroup {
  signature: string
  templateSheetIndex: number
  sheetIndices: number[]
  repeatCount: number
  widthCm: number
  heightCm: number
  copiesPerSheet: number
  totalCopies: number
}

/**
 * Collapse only physically identical production sheets. Runtime placement ids
 * and sheet indexes are deliberately ignored; every output-affecting geometry
 * value and the prepared piece model id remain part of the signature.
 */
export function getProductionSheetLayoutGroups(
  project: CutterProject
): ProductionSheetLayoutGroup[] {
  const groups: ProductionSheetLayoutGroup[] = []
  const groupBySignature = new Map<string, ProductionSheetLayoutGroup>()
  const sheetCount = getProductionSheetCount(project.placedPieces)

  for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
    const sheetProject = getProductionSheetProject(project, sheetIndex)
    const signature = getProductionSheetLayoutSignature(sheetProject)
    const existing = groupBySignature.get(signature)

    if (existing) {
      existing.sheetIndices.push(sheetIndex)
      existing.repeatCount += 1
      existing.totalCopies += sheetProject.placedPieces.length
      continue
    }

    const group: ProductionSheetLayoutGroup = {
      signature,
      templateSheetIndex: sheetIndex,
      sheetIndices: [sheetIndex],
      repeatCount: 1,
      widthCm: sheetProject.sheet.widthCm,
      heightCm: sheetProject.sheet.heightCm,
      copiesPerSheet: sheetProject.placedPieces.length,
      totalCopies: sheetProject.placedPieces.length
    }
    groups.push(group)
    groupBySignature.set(signature, group)
  }

  return groups
}

export function getProductionSheetLayoutSignature(project: CutterProject): string {
  const placements = [...project.placedPieces]
    .map(toPlacementSignature)
    .sort((left, right) => left.localeCompare(right))

  return JSON.stringify({
    widthCm: roundGeometry(project.sheet.widthCm),
    heightCm: roundGeometry(project.sheet.heightCm),
    placements
  })
}

function toPlacementSignature(piece: PlacedPiece): string {
  return [
    piece.presetId,
    roundGeometry(piece.xCm),
    roundGeometry(piece.yCm),
    roundGeometry(piece.widthCm),
    roundGeometry(piece.heightCm),
    piece.rotation,
    getBoundsSignature(piece.productionBoundsCm)
  ].join('|')
}

function getBoundsSignature(bounds: PlacedPiece['productionBoundsCm']): string {
  if (!bounds) return 'no-production-bounds'

  return [
    roundGeometry(bounds.xCm),
    roundGeometry(bounds.yCm),
    roundGeometry(bounds.widthCm),
    roundGeometry(bounds.heightCm)
  ].join(',')
}

function roundGeometry(value: number): number {
  return Number(value.toFixed(4))
}
