import { CUT_CONTOUR_COLOR, CUT_CONTOUR_NAME } from './colorSpot'
import { getPlacedProductionBounds } from './cutlineGenerator'
import { createCutterId } from './nesting'
import { synchronizePieceEditorModel } from './editorObjects'
import type {
  ArtworkTransform,
  CutlineTransform,
  PiecePreset,
  PieceSourceFile,
  PlacedPiece
} from '../types'

export const CUTTER_PIECE_MIN_DIMENSION_CM = 0.5
export const CUTTER_PIECE_MAX_DIMENSION_CM = 96

export function createPiecePresetFromSource(
  source: PieceSourceFile,
  existingPieces: PiecePreset[]
): PiecePreset {
  const previewUrl = source.previewDataUrl ?? source.previewUrl
  const widthCm = getDefaultPieceWidthCm(source.naturalWidthPx)
  const heightCm = clampPieceDimension(widthCm * (source.naturalHeightPx / source.naturalWidthPx))
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
  const artworkObjectId = `artwork-${pieceId}`

  return synchronizePieceEditorModel({
    id: pieceId,
    sourceId: source.id,
    sourceKind: source.sourceKind,
    sourceFileName: source.fileName,
    originalFileName: source.originalFileName,
    pdfPageNumber: source.pdfPageNumber,
    pageCount: source.pageCount,
    displayName,
    previewUrl,
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
      previewUrl,
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
    objects: [
      {
        id: artworkObjectId,
        type: 'artwork',
        shapeType: 'image',
        role: 'artwork',
        name: 'Artwork',
        visible: true,
        locked: false,
        transform: { ...artworkTransform },
        sourceId: source.id,
        exportEnabled: true
      }
    ],
    objectModelInitialized: true,
    artworkObjectId,
    maskObjectId: undefined,
    cutlineObjectId: undefined,
    helperObjectIds: [],
    selectedObjectIds: [artworkObjectId],
    keyObjectId: undefined,
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
  const placed: PlacedPiece = {
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

  return {
    ...placed,
    productionBoundsCm: getPlacedProductionBounds(placed, piece)
  }
}

/**
 * Refresh derived placement geometry from the normalized preset while
 * preserving the placement itself. This is used when restoring legacy
 * projects and when a masked preset changes in the piece editor.
 */
export function refreshPlacedPieceFromPreset(placed: PlacedPiece, piece: PiecePreset): PlacedPiece {
  const rotated = placed.rotation === 90 || placed.rotation === 270
  const refreshed: PlacedPiece = {
    ...placed,
    sourceFileName: piece.sourceFileName,
    displayName: piece.displayName,
    widthCm: rotated ? piece.heightCm : piece.widthCm,
    heightCm: rotated ? piece.widthCm : piece.heightCm,
    locked: placed.locked,
    artworkTransform: { ...piece.artwork.transform },
    maskTransform: { ...piece.mask.transform },
    cutlineTransform: { ...piece.cutline.transform }
  }

  return {
    ...refreshed,
    productionBoundsCm: getPlacedProductionBounds(refreshed, piece)
  }
}

export function syncPieceBounds(
  piece: PiecePreset,
  widthCm: number,
  heightCm: number
): PiecePreset {
  const safeWidth = clampPieceDimension(widthCm)
  const safeHeight = clampPieceDimension(heightCm)
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

/**
 * Resize the complete piece as one Illustrator-style clipping group.
 *
 * Object locks intentionally do not participate here: they prevent individual
 * edits, while this operation transforms the piece's complete object model.
 */
export function resizePiecePreset(
  piece: PiecePreset,
  requestedWidthCm: number,
  requestedHeightCm: number,
  sourceAxis: 'width' | 'height'
): PiecePreset {
  const synchronizedPiece = synchronizePieceEditorModel(piece)
  const currentWidthCm = getUsableCurrentDimension(synchronizedPiece.widthCm)
  const currentHeightCm = getUsableCurrentDimension(synchronizedPiece.heightCm)
  const requestedWidth = getRequestedDimension(requestedWidthCm, currentWidthCm)
  const requestedHeight = getRequestedDimension(requestedHeightCm, currentHeightCm)
  const aspectRatio = currentWidthCm / currentHeightCm
  let widthCm = requestedWidth
  let heightCm = requestedHeight

  if (synchronizedPiece.lockAspectRatio && !isUsableScale(aspectRatio)) {
    return createResizeFallback(synchronizedPiece, currentWidthCm, currentHeightCm)
  }

  if (synchronizedPiece.lockAspectRatio) {
    const constrained = constrainAspectLockedDimensions(
      aspectRatio,
      requestedWidth,
      requestedHeight,
      sourceAxis
    )
    widthCm = constrained.widthCm
    heightCm = constrained.heightCm
  }

  if (!isUsableDimension(widthCm) || !isUsableDimension(heightCm)) {
    return createResizeFallback(synchronizedPiece, currentWidthCm, currentHeightCm)
  }

  const widthScale = widthCm / currentWidthCm
  const heightScale = heightCm / currentHeightCm
  if (!isUsableScale(widthScale) || !isUsableScale(heightScale)) {
    return createResizeFallback(synchronizedPiece, currentWidthCm, currentHeightCm)
  }

  const resizedObjects = synchronizedPiece.objects.map((object) => {
    const transform = resizeObjectTransform(object.transform, widthScale, heightScale)
    return transform ? { ...object, transform } : undefined
  })

  if (resizedObjects.some((object) => !object)) {
    return createResizeFallback(synchronizedPiece, currentWidthCm, currentHeightCm)
  }

  return synchronizePieceEditorModel({
    ...synchronizedPiece,
    widthCm,
    heightCm,
    objects: resizedObjects.filter((object): object is NonNullable<typeof object> =>
      Boolean(object)
    )
  })
}

/**
 * Apply a piece-space anisotropic scale to a rotated object.
 *
 * The object model has rotation and independent local width/height, but no
 * skew. Scaling a rotated rectangle non-uniformly produces skew except at
 * quarter turns. We therefore use the rotation-preserving, shear-free part of
 * the polar decomposition: object centers receive the exact piece transform,
 * while local dimensions receive the diagonal of R^T S R. This is exact for
 * 0/90/180/270 degrees and is the least-squares representable transform for
 * arbitrary angles when the unrepresentable shear terms are discarded.
 */
function resizeObjectTransform(
  transform: ArtworkTransform,
  widthScale: number,
  heightScale: number
): ArtworkTransform | undefined {
  const { xCm, yCm, widthCm, heightCm, rotation } = transform
  if (
    !Number.isFinite(xCm) ||
    !Number.isFinite(yCm) ||
    !isUsableScale(widthCm) ||
    !isUsableScale(heightCm) ||
    !Number.isFinite(rotation)
  ) {
    return undefined
  }

  const radians = (rotation * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const cosineSquared = cosine * cosine
  const sineSquared = sine * sine
  const localWidthScale = widthScale * cosineSquared + heightScale * sineSquared
  const localHeightScale = widthScale * sineSquared + heightScale * cosineSquared
  const centerX = xCm + widthCm / 2
  const centerY = yCm + heightCm / 2
  const resizedCenterX = centerX * widthScale
  const resizedCenterY = centerY * heightScale
  const resizedWidth = widthCm * localWidthScale
  const resizedHeight = heightCm * localHeightScale
  const resizedX = resizedCenterX - resizedWidth / 2
  const resizedY = resizedCenterY - resizedHeight / 2

  if (
    !isUsableScale(localWidthScale) ||
    !isUsableScale(localHeightScale) ||
    !Number.isFinite(resizedCenterX) ||
    !Number.isFinite(resizedCenterY) ||
    !isUsableScale(resizedWidth) ||
    !isUsableScale(resizedHeight) ||
    !Number.isFinite(resizedX) ||
    !Number.isFinite(resizedY)
  ) {
    return undefined
  }

  return {
    ...transform,
    xCm: resizedX,
    yCm: resizedY,
    widthCm: resizedWidth,
    heightCm: resizedHeight
  }
}

function createResizeFallback(
  piece: PiecePreset,
  currentWidthCm: number,
  currentHeightCm: number
): PiecePreset {
  return synchronizePieceEditorModel({
    ...piece,
    widthCm: currentWidthCm,
    heightCm: currentHeightCm,
    objects: piece.objects.map((object) => ({
      ...object,
      transform: { ...object.transform }
    }))
  })
}

function isUsableDimension(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= CUTTER_PIECE_MIN_DIMENSION_CM &&
    value <= CUTTER_PIECE_MAX_DIMENSION_CM
  )
}

function isUsableScale(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function getUsableCurrentDimension(value: number): number {
  return Number.isFinite(value) && value > 0
    ? clampPieceDimension(value)
    : CUTTER_PIECE_MIN_DIMENSION_CM
}

function getRequestedDimension(value: number, currentValue: number): number {
  return clampPieceDimension(Number.isFinite(value) ? value : currentValue)
}

function clampPieceDimension(value: number): number {
  if (!Number.isFinite(value)) return CUTTER_PIECE_MIN_DIMENSION_CM
  return Math.min(Math.max(value, CUTTER_PIECE_MIN_DIMENSION_CM), CUTTER_PIECE_MAX_DIMENSION_CM)
}

function constrainAspectLockedDimensions(
  aspectRatio: number,
  requestedWidthCm: number,
  requestedHeightCm: number,
  sourceAxis: 'width' | 'height'
): { widthCm: number; heightCm: number } {
  let widthCm: number
  let heightCm: number

  if (sourceAxis === 'width') {
    widthCm = requestedWidthCm
    heightCm = widthCm / aspectRatio

    if (heightCm < CUTTER_PIECE_MIN_DIMENSION_CM) {
      heightCm = CUTTER_PIECE_MIN_DIMENSION_CM
      widthCm = heightCm * aspectRatio
    } else if (heightCm > CUTTER_PIECE_MAX_DIMENSION_CM) {
      heightCm = CUTTER_PIECE_MAX_DIMENSION_CM
      widthCm = heightCm * aspectRatio
    }
  } else {
    heightCm = requestedHeightCm
    widthCm = heightCm * aspectRatio

    if (widthCm < CUTTER_PIECE_MIN_DIMENSION_CM) {
      widthCm = CUTTER_PIECE_MIN_DIMENSION_CM
      heightCm = widthCm / aspectRatio
    } else if (widthCm > CUTTER_PIECE_MAX_DIMENSION_CM) {
      widthCm = CUTTER_PIECE_MAX_DIMENSION_CM
      heightCm = widthCm / aspectRatio
    }
  }

  return { widthCm, heightCm }
}

function getDefaultPieceWidthCm(naturalWidthPx: number): number {
  return Math.max(3, Math.min(naturalWidthPx / 80, 18))
}

function getUniquePieceName(fileName: string, existingPieces: PiecePreset[]): string {
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const matchingCount = existingPieces.filter((piece) => piece.sourceFileName === fileName).length

  return matchingCount === 0 ? baseName : `${baseName} copy ${matchingCount + 1}`
}
