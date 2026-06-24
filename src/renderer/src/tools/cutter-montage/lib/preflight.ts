import type { CutterProject } from '../types'
import { calculateUsedArea, detectOutOfBounds, detectOverlaps } from './nestingStrategies'

export interface CutterPreflightIssue {
  id: string
  severity: 'error' | 'warning'
  message: string
  placedPieceIds: string[]
}

export interface CutterPreflightReport {
  issues: CutterPreflightIssue[]
  outOfBoundsIds: string[]
  overlapIds: string[]
  cutlineCount: number
  usedAreaPercent: number
  wasteAreaPercent: number
  canExport: boolean
}

export function runCutterPreflight(project: CutterProject): CutterPreflightReport {
  const issues: CutterPreflightIssue[] = []
  const outOfBoundsIds = detectOutOfBounds(project.placedPieces, project.sheet)
  const overlaps = detectOverlaps(project.placedPieces)
  const overlapIds = Array.from(new Set(overlaps.flat()))
  const pieceMap = new Map(project.pieces.map((piece) => [piece.id, piece]))
  const missingCutlineIds = project.placedPieces
    .filter((placed) => !pieceMap.get(placed.presetId)?.cutlineObjectId)
    .map((placed) => placed.id)
  const hiddenCutlineIds = project.placedPieces
    .filter((placed) => {
      const piece = pieceMap.get(placed.presetId)
      return Boolean(
        piece?.cutlineObjectId && (!project.layers.cutlines || !piece.objectVisibility.cutline)
      )
    })
    .map((placed) => placed.id)
  const missingSourceIds = project.placedPieces
    .filter((placed) => {
      const piece = pieceMap.get(placed.presetId)
      return (
        !piece ||
        !project.sources.some(
          (source) => source.id === piece.sourceId && source.bytes.byteLength > 0
        )
      )
    })
    .map((placed) => placed.id)

  if (outOfBoundsIds.length)
    issues.push(
      issue(
        'out-of-bounds',
        'error',
        `${outOfBoundsIds.length} piece(s) are outside the sheet.`,
        outOfBoundsIds
      )
    )
  if (overlapIds.length)
    issues.push(issue('overlap', 'error', `${overlaps.length} overlap(s) detected.`, overlapIds))
  if (missingCutlineIds.length)
    issues.push(
      issue(
        'missing-cutline',
        'error',
        `${missingCutlineIds.length} placed piece(s) have no vector CutContour.`,
        missingCutlineIds
      )
    )
  if (hiddenCutlineIds.length)
    issues.push(
      issue(
        'hidden-cutline',
        'warning',
        'CutContour is hidden for one or more placed pieces.',
        hiddenCutlineIds
      )
    )
  if (missingSourceIds.length)
    issues.push(
      issue(
        'missing-source',
        'error',
        'One or more source artwork files are missing.',
        missingSourceIds
      )
    )
  if (project.sheet.widthCm <= 0 || project.sheet.heightCm <= 0)
    issues.push(
      issue('invalid-sheet', 'error', 'Sheet width and height must be greater than zero.', [])
    )
  if (project.exportSettings.includeCutlines && !project.layers.cutlines)
    issues.push(
      issue(
        'cutline-layer-hidden',
        'warning',
        'CutContour export is enabled while the preview layer is hidden.',
        []
      )
    )
  const cutlineCount = project.placedPieces.filter((placed) =>
    Boolean(pieceMap.get(placed.presetId)?.cutlineObjectId)
  ).length
  const utilization = calculateUsedArea(project.placedPieces, project.sheet)
  return {
    issues,
    outOfBoundsIds,
    overlapIds,
    cutlineCount,
    ...utilization,
    canExport: !issues.some((item) => item.severity === 'error')
  }
}

function issue(
  id: string,
  severity: CutterPreflightIssue['severity'],
  message: string,
  placedPieceIds: string[]
): CutterPreflightIssue {
  return { id, severity, message, placedPieceIds }
}
