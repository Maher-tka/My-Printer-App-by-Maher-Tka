import type { CutterProject, PiecePreset, PlacedPiece } from '../types'
import { CUT_CONTOUR_NAME } from './colorSpot'
import { getPlacedProductionBounds } from './cutlineGenerator'
import { validateCutterCutlines } from './cutlineValidation'
import { getSafeArea } from './cutterLayout'
import { calculateUsedArea, detectOverlaps } from './nestingStrategies'
import {
  getRegistrationMarkOutOfBoundsCount,
  getRegistrationMarkOverlapIds
} from './registrationMarks'
import { getPieceSourceKind } from './sourcePreview'
import { getCutterExportSemantics } from './exportPresets'

const GEOMETRY_EPSILON_CM = 1e-9

export interface CutterPreflightIssue {
  id: string
  severity: 'error' | 'warning' | 'info'
  message: string
  placedPieceIds: string[]
}

export interface CutterPreflightReport {
  issues: CutterPreflightIssue[]
  outOfBoundsIds: string[]
  safeAreaOutOfBoundsIds: string[]
  overlapIds: string[]
  cutlineCount: number
  usedAreaPercent: number
  wasteAreaPercent: number
  canExport: boolean
}

export function runCutterPreflight(project: CutterProject): CutterPreflightReport {
  const issues: CutterPreflightIssue[] = []
  const requiresCutlines =
    getCutterExportSemantics(project.exportSettings).contourRenderKind === 'production'
  const pieceMap = new Map(project.pieces.map((piece) => [piece.id, piece]))
  const productionGeometry = resolveProductionGeometry(project, pieceMap)
  const placedPiecesWithValidProductionBounds = project.placedPieces.flatMap((placed) => {
    const bounds = productionGeometry.boundsByPlacedId.get(placed.id)
    return bounds ? [{ ...placed, productionBoundsCm: bounds }] : []
  })
  const outOfBoundsIds = detectProductionBoundsOutside(placedPiecesWithValidProductionBounds, {
    xCm: 0,
    yCm: 0,
    widthCm: project.sheet.widthCm,
    heightCm: project.sheet.heightCm
  })
  const safeAreaOutOfBoundsIds = detectProductionBoundsOutside(
    placedPiecesWithValidProductionBounds,
    getSafeArea(project.sheet)
  )
  const overlaps = detectOverlaps(placedPiecesWithValidProductionBounds)
  const overlapIds = Array.from(new Set(overlaps.flat()))
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
  const pdfPreviewIssueIds = project.placedPieces
    .filter((placed) => {
      const piece = pieceMap.get(placed.presetId)
      const source = piece
        ? project.sources.find((candidate) => candidate.id === piece.sourceId)
        : undefined

      return Boolean(
        source &&
        getPieceSourceKind(source) === 'pdf-page' &&
        (!source.pdfPageNumber || !source.pageCount || !source.previewDataUrl)
      )
    })
    .map((placed) => placed.id)
  const lowResolutionIds = project.placedPieces
    .filter((placed) => {
      const piece = pieceMap.get(placed.presetId)
      const source = piece
        ? project.sources.find((candidate) => candidate.id === piece.sourceId)
        : undefined

      if (!source || getPieceSourceKind(source) !== 'image') return false

      const dpiX = source.naturalWidthPx / Math.max(placed.widthCm / 2.54, 0.1)
      const dpiY = source.naturalHeightPx / Math.max(placed.heightCm / 2.54, 0.1)

      return Math.min(dpiX, dpiY) < 120
    })
    .map((placed) => placed.id)
  const registrationOverlapIds = getRegistrationMarkOverlapIds(project)
  const registrationOutOfBoundsCount = getRegistrationMarkOutOfBoundsCount(project)

  if (project.placedPieces.length === 0)
    issues.push(issue('no-pieces-placed', 'error', 'No pieces are placed on the sheet.', []))
  if (productionGeometry.invalidPlacedPieceIds.length)
    issues.push(
      issue(
        'invalid-production-geometry',
        'error',
        `${productionGeometry.invalidPlacedPieceIds.length} placed piece(s) have invalid production geometry (NaN, Infinity, or non-positive bounds).`,
        productionGeometry.invalidPlacedPieceIds
      )
    )
  if (outOfBoundsIds.length)
    issues.push(
      issue(
        'out-of-bounds',
        'error',
        `${outOfBoundsIds.length} piece(s) are outside the sheet.`,
        outOfBoundsIds
      )
    )
  if (safeAreaOutOfBoundsIds.length)
    issues.push(
      issue(
        'outside-safe-area',
        'warning',
        `${safeAreaOutOfBoundsIds.length} piece(s) extend outside the print/cut safe area.`,
        safeAreaOutOfBoundsIds
      )
    )
  if (overlapIds.length)
    issues.push(issue('overlap', 'error', `${overlaps.length} overlap(s) detected.`, overlapIds))
  if (requiresCutlines && missingCutlineIds.length)
    issues.push(
      issue(
        'missing-cutline',
        'error',
        `${missingCutlineIds.length} placed piece(s) have no vector CutContour.`,
        missingCutlineIds
      )
    )
  if (requiresCutlines && hiddenCutlineIds.length)
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
  if (pdfPreviewIssueIds.length)
    issues.push(
      issue(
        'pdf-page-source-warning',
        'warning',
        'One or more PDF page sources are missing page metadata or a reopen preview.',
        pdfPreviewIssueIds
      )
    )
  if (lowResolutionIds.length)
    issues.push(
      issue(
        'low-resolution-artwork',
        'warning',
        `${lowResolutionIds.length} raster artwork item(s) may print below 120 DPI at placed size.`,
        lowResolutionIds
      )
    )
  if (registrationOverlapIds.length)
    issues.push(
      issue(
        'registration-overlap',
        'warning',
        'Registration marks overlap one or more placed pieces.',
        registrationOverlapIds
      )
    )
  if (registrationOutOfBoundsCount > 0)
    issues.push(
      issue(
        'registration-out-of-bounds',
        'error',
        `${registrationOutOfBoundsCount} registration mark(s) are outside the sheet.`,
        []
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
  if (project.exportSettings.includeArtwork && !project.layers.artwork)
    issues.push(
      issue(
        'artwork-layer-hidden',
        'warning',
        'Artwork export is enabled while the preview layer is hidden.',
        []
      )
    )
  if (project.sheet.heightCm > 100)
    issues.push(
      issue(
        'roll-height-large',
        'warning',
        'This is a long production sheet. 100 cm is preferred for easier feeding and handling.',
        []
      )
    )
  if (
    project.exportSettings.includeCutlines &&
    project.exportSettings.strokeName.trim() !== CUT_CONTOUR_NAME
  )
    issues.push(
      issue(
        'cutcontour-spot-name',
        'warning',
        'CutContour spot name should be exactly CutContour.',
        []
      )
    )
  if (project.exportSettings.mode === 'print-only' && project.exportSettings.includeCutlines)
    issues.push(
      issue(
        'print-only-cutline-conflict',
        'warning',
        'Print-only export mode still has CutContour enabled.',
        []
      )
    )
  if (
    (project.exportSettings.mode === 'cut-only' || project.exportSettings.mode === 'test-cut') &&
    project.exportSettings.includeArtwork
  )
    issues.push(
      issue(
        'cut-only-artwork-conflict',
        'warning',
        'Cut-only export mode still has artwork enabled.',
        []
      )
    )
  for (const cutlineIssue of requiresCutlines ? validateCutterCutlines(project) : []) {
    issues.push({
      id: cutlineIssue.id,
      severity: cutlineIssue.severity,
      message: cutlineIssue.message,
      placedPieceIds: cutlineIssue.placedPieceIds
    })
  }
  const cutlineCount = project.placedPieces.filter((placed) =>
    Boolean(pieceMap.get(placed.presetId)?.cutlineObjectId)
  ).length
  const utilization = calculateUsedArea(placedPiecesWithValidProductionBounds, project.sheet)
  return {
    issues,
    outOfBoundsIds,
    safeAreaOutOfBoundsIds,
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

type ProductionBounds = NonNullable<PlacedPiece['productionBoundsCm']>

function resolveProductionGeometry(
  project: CutterProject,
  pieceMap: Map<string, PiecePreset>
): {
  boundsByPlacedId: Map<string, ProductionBounds>
  invalidPlacedPieceIds: string[]
} {
  const boundsByPlacedId = new Map<string, ProductionBounds>()
  const invalidPlacedPieceIds: string[] = []

  for (const placed of project.placedPieces) {
    const preset = pieceMap.get(placed.presetId)
    let bounds: ProductionBounds

    try {
      bounds = preset
        ? getPlacedProductionBounds(placed, preset)
        : (placed.productionBoundsCm ?? nominalBounds(placed))
    } catch {
      invalidPlacedPieceIds.push(placed.id)
      continue
    }

    if (!hasValidPlacement(placed) || !hasValidBounds(bounds)) {
      invalidPlacedPieceIds.push(placed.id)
      continue
    }

    boundsByPlacedId.set(placed.id, bounds)
  }

  return { boundsByPlacedId, invalidPlacedPieceIds }
}

function nominalBounds(placed: PlacedPiece): ProductionBounds {
  return {
    xCm: placed.xCm,
    yCm: placed.yCm,
    widthCm: placed.widthCm,
    heightCm: placed.heightCm
  }
}

function hasValidPlacement(placed: PlacedPiece): boolean {
  return (
    [placed.xCm, placed.yCm, placed.widthCm, placed.heightCm, placed.rotation].every(
      Number.isFinite
    ) &&
    placed.widthCm > 0 &&
    placed.heightCm > 0
  )
}

function hasValidBounds(bounds: ProductionBounds): boolean {
  return (
    [bounds.xCm, bounds.yCm, bounds.widthCm, bounds.heightCm].every(Number.isFinite) &&
    bounds.widthCm > 0 &&
    bounds.heightCm > 0
  )
}

function detectProductionBoundsOutside(
  placedPieces: PlacedPiece[],
  area: ProductionBounds
): string[] {
  return placedPieces
    .filter((piece) => {
      const bounds = piece.productionBoundsCm!
      return (
        bounds.xCm < area.xCm - GEOMETRY_EPSILON_CM ||
        bounds.yCm < area.yCm - GEOMETRY_EPSILON_CM ||
        bounds.xCm + bounds.widthCm > area.xCm + area.widthCm + GEOMETRY_EPSILON_CM ||
        bounds.yCm + bounds.heightCm > area.yCm + area.heightCm + GEOMETRY_EPSILON_CM
      )
    })
    .map((piece) => piece.id)
}
