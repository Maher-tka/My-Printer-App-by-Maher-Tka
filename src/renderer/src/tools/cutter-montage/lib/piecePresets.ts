import { CUT_CONTOUR_COLOR, CUT_CONTOUR_NAME } from './colorSpot'
import { createCutterId } from './nesting'
import { synchronizePieceEditorModel } from './editorObjects'
import type {
  ArtworkTransform,
  CutlineTransform,
  PiecePreset,
  PieceSourceFile,
  PlacedPiece
} from '../types'

export function createPiecePresetFromSource(
  source: PieceSourceFile,
  existingPieces: PiecePreset[]
): PiecePreset {
  const widthCm = getDefaultPieceWidthCm(source.naturalWidthPx)
  const heightCm = Math.max(widthCm * (source.naturalHeightPx / source.naturalWidthPx), 0.5)
  const displayName = getUniquePieceName(source.fileName, existingPieces)
  const artworkTransform: ArtworkTransform = {
    xCm: 0,
    yCm: 0,
    widthCm,
    heightCm,
    rotation: 0
  }
  const cutlineTransform: CutlineTransform = {
    xCm: 0,
    yCm: 0,
    widthCm,
    heightCm,
    rotation: 0,
    offsetMm: 1
  }
  const pieceId = createCutterId('piece')

  return synchronizePieceEditorModel({
    id: pieceId,
    sourceId: source.id,
    sourceFileName: source.fileName,
    displayName,
    previewUrl: source.previewUrl,
    naturalWidthPx: source.naturalWidthPx,
    naturalHeightPx: source.naturalHeightPx,
    widthCm,
    heightCm,
    quantity: 1,
    rotationAllowed: true,
    locked: false,
    artwork: {
      sourceId: source.id,
      sourceFileName: source.fileName,
      previewUrl: source.previewUrl,
      transform: artworkTransform
    },
    mask: {
      enabled: false,
      shape: 'rectangle',
      transform: { ...artworkTransform }
    },
    cutline: {
      shape: 'rectangle',
      transform: cutlineTransform,
      strokeName: CUT_CONTOUR_NAME,
      strokeColor: CUT_CONTOUR_COLOR,
      strokeWidthPt: 0.25
    },
    artworkCutlineGrouped: false,
    objectVisibility: {
      artwork: true,
      mask: true,
      cutline: true,
      helper: true
    },
    objectLocks: {
      artwork: false,
      mask: false,
      cutline: false,
      helper: false
    },
    objects: [],
    artworkObjectId: `artwork-${pieceId}`,
    maskObjectId: undefined,
    cutlineObjectId: `cutline-${pieceId}`,
    helperObjectIds: [],
    selectedObjectIds: [`artwork-${pieceId}`, `cutline-${pieceId}`],
    keyObjectId: `cutline-${pieceId}`,
    groupLinked: false,
    lockAspectRatio: true,
    clippingMaskEnabled: false
  })
}

export function duplicatePiecePreset(
  piece: PiecePreset,
  existingPieces: PiecePreset[]
): PiecePreset {
  const pieceId = createCutterId('piece')
  const objectIds = new Map(piece.objects.map((object) => [object.id, createCutterId(object.type)]))
  const groupIds = new Map<string, string>()
  const objects = piece.objects.map((object) => {
    const groupId = object.groupId
      ? (groupIds.get(object.groupId) ?? createCutterId('group'))
      : undefined
    if (object.groupId && groupId) groupIds.set(object.groupId, groupId)
    return {
      ...object,
      id: objectIds.get(object.id) ?? createCutterId(object.type),
      groupId,
      transform: { ...object.transform }
    }
  })
  const remapId = (id: string | undefined): string | undefined =>
    id ? objectIds.get(id) : undefined
  const duplicate = {
    ...piece,
    id: pieceId,
    displayName: getUniquePieceName(piece.sourceFileName, existingPieces),
    artwork: {
      ...piece.artwork,
      transform: { ...piece.artwork.transform }
    },
    mask: {
      ...piece.mask,
      transform: { ...piece.mask.transform }
    },
    cutline: {
      ...piece.cutline,
      transform: { ...piece.cutline.transform }
    },
    helperShape: piece.helperShape
      ? {
          ...piece.helperShape,
          id: createCutterId('shape'),
          transform: { ...piece.helperShape.transform }
        }
      : undefined,
    artworkCutlineGrouped: piece.artworkCutlineGrouped,
    objectVisibility: { ...piece.objectVisibility },
    objectLocks: { ...piece.objectLocks },
    objects,
    artworkObjectId: remapId(piece.artworkObjectId) ?? `artwork-${pieceId}`,
    maskObjectId: remapId(piece.maskObjectId),
    cutlineObjectId: remapId(piece.cutlineObjectId),
    helperObjectIds: piece.helperObjectIds
      .map((id) => remapId(id))
      .filter((id): id is string => Boolean(id)),
    selectedObjectIds: [],
    keyObjectId: undefined
  }

  return synchronizePieceEditorModel(duplicate)
}

export function createPlacedPieceFromPreset(
  piece: PiecePreset,
  xCm: number,
  yCm: number,
  rotation: 0 | 90 | 180 | 270 = 0
): PlacedPiece {
  return {
    id: createCutterId('placed'),
    presetId: piece.id,
    sourceFileName: piece.sourceFileName,
    displayName: piece.displayName,
    xCm,
    yCm,
    widthCm: rotation === 90 || rotation === 270 ? piece.heightCm : piece.widthCm,
    heightCm: rotation === 90 || rotation === 270 ? piece.widthCm : piece.heightCm,
    rotation,
    locked: piece.locked,
    artworkTransform: { ...piece.artwork.transform },
    maskTransform: { ...piece.mask.transform },
    cutlineTransform: { ...piece.cutline.transform }
  }
}

export function syncPieceBounds(
  piece: PiecePreset,
  widthCm: number,
  heightCm: number
): PiecePreset {
  const safeWidth = Math.max(widthCm, 0.5)
  const safeHeight = Math.max(heightCm, 0.5)
  const widthScale = safeWidth / piece.widthCm
  const heightScale = safeHeight / piece.heightCm

  return synchronizePieceEditorModel({
    ...piece,
    widthCm: safeWidth,
    heightCm: safeHeight,
    objects: piece.objects.map((object) => ({
      ...object,
      transform: {
        ...object.transform,
        xCm: object.transform.xCm * widthScale,
        yCm: object.transform.yCm * heightScale,
        widthCm: object.transform.widthCm * widthScale,
        heightCm: object.transform.heightCm * heightScale
      }
    }))
  })
}

function getDefaultPieceWidthCm(naturalWidthPx: number): number {
  return Math.max(3, Math.min(naturalWidthPx / 80, 18))
}

function getUniquePieceName(fileName: string, existingPieces: PiecePreset[]): string {
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const matchingCount = existingPieces.filter((piece) => piece.sourceFileName === fileName).length

  return matchingCount === 0 ? baseName : `${baseName} copy ${matchingCount + 1}`
}
