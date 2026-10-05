import type { CutterProject, EditorObject, PiecePreset, PlacedPiece } from '../types'
import { CUT_CONTOUR_COLOR, CUT_CONTOUR_NAME } from './colorSpot'
import { getArtworkObject, getCutlineObject, syncLegacyFieldsFromObjects } from './pieceModelSync'

export type CutlineValidationSeverity = 'error' | 'warning' | 'info'

export interface CutlineValidationIssue {
  id: string
  severity: CutlineValidationSeverity
  message: string
  pieceId?: string
  placedPieceIds: string[]
}

export interface CutlineInspectorState {
  shape: string
  strokeName: string
  strokeWidthPt: number
  offsetMm: number
  vectorSafe: boolean
  issues: CutlineValidationIssue[]
}

export function validateCutterCutlines(project: CutterProject): CutlineValidationIssue[] {
  const pieceMap = new Map(project.pieces.map((piece) => [piece.id, piece]))
  const placedIdsByPiece = new Map<string, string[]>()

  for (const placed of project.placedPieces) {
    placedIdsByPiece.set(placed.presetId, [
      ...(placedIdsByPiece.get(placed.presetId) ?? []),
      placed.id
    ])
  }

  const issues: CutlineValidationIssue[] = []

  if (!project.pieces.some((piece) => getCutlineObject(piece))) {
    issues.push({
      id: 'no-cutcontour-objects',
      severity: 'error',
      message: 'No CutContour objects found.',
      placedPieceIds: []
    })
  }

  for (const piece of project.pieces) {
    issues.push(...validatePieceCutline(piece, placedIdsByPiece.get(piece.id) ?? []))
  }

  for (const placed of project.placedPieces) {
    const piece = pieceMap.get(placed.presetId)

    if (!piece) continue

    const artwork = getArtworkObject(piece)
    const cutline = getCutlineObject(piece)

    if (artwork && cutline) {
      const distance = getCutlineDistanceFromArtwork(piece, placed, artwork, cutline)

      if (distance > 1.5) {
        issues.push({
          id: 'cutline-too-far',
          severity: 'warning',
          message: `${piece.displayName} CutContour sits more than 15 mm outside artwork.`,
          pieceId: piece.id,
          placedPieceIds: [placed.id]
        })
      }
    }
  }

  return mergeIssues(issues)
}

export function getCutlineInspectorState(piece: PiecePreset): CutlineInspectorState {
  const cutline = getCutlineObject(piece)
  const issues = validatePieceCutline(piece, [])

  return {
    shape: cutline?.shapeType ?? piece.cutline.shape,
    strokeName: cutline?.strokeName ?? piece.cutline.strokeName,
    strokeWidthPt: cutline?.strokeWidthPt ?? piece.cutline.strokeWidthPt,
    offsetMm: cutline?.offsetMm ?? piece.cutline.transform.offsetMm,
    vectorSafe: Boolean(
      cutline && cutline.shapeType !== 'image' && cutline.exportEnabled !== false
    ),
    issues
  }
}

export function fixPieceCutlineForMimaki(piece: PiecePreset): PiecePreset {
  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      strokeName: CUT_CONTOUR_NAME,
      strokeColor: CUT_CONTOUR_COLOR
    },
    objects: piece.objects.map((object) =>
      object.role === 'cutline'
        ? {
            ...object,
            strokeName: CUT_CONTOUR_NAME,
            strokeColor: CUT_CONTOUR_COLOR,
            fillColor: 'none',
            exportEnabled: true
          }
        : object
    )
  }
}

export function createCutlineFromArtworkBounds(piece: PiecePreset): PiecePreset {
  const artwork = getArtworkObject(piece)

  if (!artwork) return piece

  return upsertCutlineFromBounds(piece, artwork, 'rectangle')
}

export function createCutlineFromMaskBounds(piece: PiecePreset): PiecePreset {
  const mask =
    piece.objects.find((object) => object.id === piece.maskObjectId) ??
    piece.objects.find((object) => object.role === 'clipping-mask')

  if (!mask) return piece

  return upsertCutlineFromBounds(
    piece,
    mask,
    mask.shapeType === 'ellipse'
      ? 'ellipse'
      : mask.shapeType === 'rounded-rectangle'
        ? 'rounded-rectangle'
        : mask.shapeType === 'path'
          ? 'custom-path'
          : 'rectangle'
  )
}

function upsertCutlineFromBounds(
  piece: PiecePreset,
  source: EditorObject,
  shape: PiecePreset['cutline']['shape']
): PiecePreset {
  const existingCutline = getCutlineObject(piece)
  const cutlineId = existingCutline?.id ?? createCutlineId(piece.id)
  const cutline: EditorObject = {
    ...existingCutline,
    id: cutlineId,
    type: 'cutline',
    shapeType: source.shapeType === 'image' ? 'rectangle' : source.shapeType,
    role: 'cutline',
    name: CUT_CONTOUR_NAME,
    visible: piece.objectVisibility.cutline,
    locked: existingCutline?.locked ?? false,
    transform: { ...source.transform },
    fillColor: 'none',
    strokeColor: piece.cutline.strokeColor || CUT_CONTOUR_COLOR,
    strokeWidthPt: piece.cutline.strokeWidthPt || 0.25,
    strokeName: CUT_CONTOUR_NAME,
    pathData: source.shapeType === 'path' ? source.pathData : undefined,
    offsetMm: piece.cutline.transform.offsetMm,
    exportEnabled: true
  }
  const objects = existingCutline
    ? piece.objects.map((object) => (object.id === existingCutline.id ? cutline : object))
    : [...piece.objects, cutline]

  return syncLegacyFieldsFromObjects({
    ...piece,
    cutline: {
      ...piece.cutline,
      shape,
      transform: {
        ...source.transform,
        offsetMm: piece.cutline.transform.offsetMm
      },
      strokeName: CUT_CONTOUR_NAME,
      strokeColor: piece.cutline.strokeColor || CUT_CONTOUR_COLOR,
      strokeWidthPt: piece.cutline.strokeWidthPt || 0.25,
      customPathData: source.shapeType === 'path' ? source.pathData : undefined
    },
    objects,
    cutlineObjectId: cutline.id,
    selectedObjectIds: [cutline.id],
    keyObjectId: undefined
  })
}

function createCutlineId(pieceId: string): string {
  return `cutline-${pieceId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function validatePieceCutline(
  piece: PiecePreset,
  placedPieceIds: string[]
): CutlineValidationIssue[] {
  const issues: CutlineValidationIssue[] = []
  const artwork = getArtworkObject(piece)
  const cutline = getCutlineObject(piece)

  if (artwork && !cutline) {
    issues.push({
      id: 'piece-artwork-without-cutline',
      severity: 'error',
      message: `${piece.displayName} has artwork but no CutContour.`,
      pieceId: piece.id,
      placedPieceIds
    })
  }

  if (cutline && !artwork) {
    issues.push({
      id: 'piece-cutline-without-artwork',
      severity: 'warning',
      message: `${piece.displayName} has CutContour but no artwork.`,
      pieceId: piece.id,
      placedPieceIds
    })
  }

  if (!cutline) {
    return issues
  }

  if (!cutline.visible || !piece.objectVisibility.cutline) {
    issues.push({
      id: 'piece-cutline-hidden',
      severity: 'warning',
      message: `${piece.displayName} CutContour exists but is hidden.`,
      pieceId: piece.id,
      placedPieceIds
    })
  }

  if ((cutline.strokeName ?? piece.cutline.strokeName) !== CUT_CONTOUR_NAME) {
    issues.push({
      id: 'piece-cutline-wrong-spot',
      severity: 'warning',
      message: `${piece.displayName} CutContour stroke name is not CutContour.`,
      pieceId: piece.id,
      placedPieceIds
    })
  }

  if (cutline.fillColor && cutline.fillColor !== 'none' && cutline.fillColor !== 'transparent') {
    issues.push({
      id: 'piece-cutline-has-fill',
      severity: 'warning',
      message: `${piece.displayName} CutContour has fill enabled.`,
      pieceId: piece.id,
      placedPieceIds
    })
  }

  if (cutline.shapeType === 'image' || cutline.exportEnabled === false) {
    issues.push({
      id: 'piece-cutline-not-vector',
      severity: 'error',
      message: `${piece.displayName} CutContour is not vector-safe.`,
      pieceId: piece.id,
      placedPieceIds
    })
  }

  const offsetMm = cutline.offsetMm ?? piece.cutline.transform.offsetMm

  if (offsetMm > 10) {
    issues.push({
      id: 'piece-cutline-offset-large',
      severity: 'warning',
      message: `${piece.displayName} CutContour offset is above 10 mm.`,
      pieceId: piece.id,
      placedPieceIds
    })
  }

  return issues
}

function getCutlineDistanceFromArtwork(
  piece: PiecePreset,
  placed: PlacedPiece,
  artwork: EditorObject,
  cutline: EditorObject
): number {
  const scaleX = placed.widthCm / piece.widthCm
  const scaleY = placed.heightCm / piece.heightCm
  const art = {
    x: placed.xCm + artwork.transform.xCm * scaleX,
    y: placed.yCm + artwork.transform.yCm * scaleY,
    right: placed.xCm + (artwork.transform.xCm + artwork.transform.widthCm) * scaleX,
    bottom: placed.yCm + (artwork.transform.yCm + artwork.transform.heightCm) * scaleY
  }
  const offsetCm = (cutline.offsetMm ?? piece.cutline.transform.offsetMm) / 10
  const cut = {
    x: placed.xCm + cutline.transform.xCm * scaleX - offsetCm,
    y: placed.yCm + cutline.transform.yCm * scaleY - offsetCm,
    right: placed.xCm + (cutline.transform.xCm + cutline.transform.widthCm) * scaleX + offsetCm,
    bottom: placed.yCm + (cutline.transform.yCm + cutline.transform.heightCm) * scaleY + offsetCm
  }

  return Math.max(art.x - cut.x, art.y - cut.y, cut.right - art.right, cut.bottom - art.bottom, 0)
}

function mergeIssues(issues: CutlineValidationIssue[]): CutlineValidationIssue[] {
  const byKey = new Map<string, CutlineValidationIssue>()

  for (const issue of issues) {
    const key = `${issue.id}:${issue.pieceId ?? 'project'}`
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, issue)
      continue
    }

    byKey.set(key, {
      ...existing,
      placedPieceIds: Array.from(new Set([...existing.placedPieceIds, ...issue.placedPieceIds]))
    })
  }

  return [...byKey.values()]
}
