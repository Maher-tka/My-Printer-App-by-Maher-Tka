import type {
  ArtworkTransform,
  CutlineShape,
  MaskShape,
  PieceHelperShape,
  PieceMask,
  PiecePreset,
  PlacedPiece
} from '../types'
import { CUT_CONTOUR_COLOR, CUT_CONTOUR_NAME } from './colorSpot'

export interface MaskRect {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotation: number
}

export function createMaskForPiece(piece: PiecePreset, shape: MaskShape): PiecePreset {
  const baseSize = Math.min(piece.widthCm, piece.heightCm)
  const isSquareOrCircle = shape === 'square' || shape === 'ellipse'
  const widthCm = isSquareOrCircle ? baseSize : piece.widthCm
  const heightCm = isSquareOrCircle ? baseSize : piece.heightCm

  return {
    ...piece,
    mask: {
      enabled: true,
      shape,
      transform: {
        xCm: (piece.widthCm - widthCm) / 2,
        yCm: (piece.heightCm - heightCm) / 2,
        widthCm,
        heightCm,
        rotation: 0
      }
    }
  }
}

export function createCutlineFromMask(piece: PiecePreset): PiecePreset {
  const maskRect = getPieceMaskRect(piece.mask)

  return {
    ...piece,
    cutline: {
      ...piece.cutline,
      shape: maskShapeToCutlineShape(piece.mask.shape),
      strokeName: CUT_CONTOUR_NAME,
      strokeColor: piece.cutline.strokeColor || CUT_CONTOUR_COLOR,
      strokeWidthPt: piece.cutline.strokeWidthPt || 0.25,
      transform: {
        xCm: maskRect.xCm,
        yCm: maskRect.yCm,
        widthCm: maskRect.widthCm,
        heightCm: maskRect.heightCm,
        rotation: maskRect.rotation,
        offsetMm: piece.cutline.transform.offsetMm
      }
    }
  }
}

export function makeClippingMaskFromHelper(piece: PiecePreset): PiecePreset {
  if (!piece.helperShape) {
    return {
      ...piece,
      mask: { ...piece.mask, enabled: true },
      clippingMaskEnabled: true
    }
  }

  return {
    ...piece,
    helperShape: undefined,
    mask: {
      enabled: true,
      shape: piece.helperShape.shape,
      transform: { ...piece.helperShape.transform }
    },
    clippingMaskEnabled: true
  }
}

export function releaseClippingMaskToHelper(piece: PiecePreset): PiecePreset {
  if (!piece.mask.enabled) {
    return piece
  }

  return {
    ...piece,
    helperShape: createHelperShape(piece.mask.shape, piece.mask.transform),
    mask: { ...piece.mask, enabled: false },
    clippingMaskEnabled: false
  }
}

export function createCutlineFromHelper(piece: PiecePreset): PiecePreset {
  if (!piece.helperShape) {
    return piece
  }

  return {
    ...piece,
    helperShape: undefined,
    cutline: {
      ...piece.cutline,
      shape: maskShapeToCutlineShape(piece.helperShape.shape),
      strokeName: CUT_CONTOUR_NAME,
      strokeColor: piece.cutline.strokeColor || CUT_CONTOUR_COLOR,
      strokeWidthPt: piece.cutline.strokeWidthPt || 0.25,
      transform: {
        xCm: piece.helperShape.transform.xCm,
        yCm: piece.helperShape.transform.yCm,
        widthCm: piece.helperShape.transform.widthCm,
        heightCm: piece.helperShape.transform.heightCm,
        rotation: piece.helperShape.transform.rotation,
        offsetMm: piece.cutline.transform.offsetMm
      }
    }
  }
}

export function createHelperShapeFromMask(piece: PiecePreset): PiecePreset {
  return {
    ...piece,
    helperShape: {
      id: createShapeId(),
      role: 'helper',
      shape: piece.mask.shape,
      transform: { ...piece.mask.transform },
      visible: true,
      locked: false
    }
  }
}

export function createHelperShape(shape: MaskShape, transform: ArtworkTransform): PieceHelperShape {
  return {
    id: createShapeId(),
    role: 'helper',
    shape,
    transform: { ...transform },
    visible: true,
    locked: false
  }
}

export function matchCutlineToMask(piece: PiecePreset): PiecePreset {
  return createCutlineFromMask(piece)
}

export function matchMaskToCutline(piece: PiecePreset): PiecePreset {
  return {
    ...piece,
    mask: {
      enabled: true,
      shape: cutlineShapeToMaskShape(piece.cutline.shape),
      transform: {
        xCm: piece.cutline.transform.xCm,
        yCm: piece.cutline.transform.yCm,
        widthCm: piece.cutline.transform.widthCm,
        heightCm: piece.cutline.transform.heightCm,
        rotation: piece.cutline.transform.rotation
      }
    }
  }
}

export function getPieceMaskRect(mask: PieceMask): MaskRect {
  return {
    xCm: mask.transform.xCm,
    yCm: mask.transform.yCm,
    widthCm: mask.transform.widthCm,
    heightCm: mask.transform.heightCm,
    rotation: mask.transform.rotation
  }
}

export function getPlacedMaskRect(placed: PlacedPiece, preset: PiecePreset): MaskRect {
  const scaleX = placed.widthCm / preset.widthCm
  const scaleY = placed.heightCm / preset.heightCm

  return {
    xCm: placed.xCm + placed.maskTransform.xCm * scaleX,
    yCm: placed.yCm + placed.maskTransform.yCm * scaleY,
    widthCm: placed.maskTransform.widthCm * scaleX,
    heightCm: placed.maskTransform.heightCm * scaleY,
    rotation: (placed.rotation + placed.maskTransform.rotation) % 360
  }
}

export function getMaskClipPath(mask: PieceMask): string | undefined {
  if (!mask.enabled) {
    return undefined
  }

  if (mask.shape === 'ellipse') {
    return getShapeClipPath(mask.shape)
  }

  if (mask.shape === 'rounded-rectangle') {
    return getShapeClipPath(mask.shape)
  }

  if (mask.shape === 'custom-polygon') {
    return getShapeClipPath(mask.shape)
  }

  return getShapeClipPath(mask.shape)
}

export function getShapeClipPath(shape: MaskShape): string {
  if (shape === 'ellipse') {
    return 'ellipse(50% 50% at 50% 50%)'
  }

  if (shape === 'rounded-rectangle') {
    return 'inset(0 round 8%)'
  }

  if (shape === 'custom-polygon') {
    return 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)'
  }

  return 'inset(0)'
}

export function updateMaskTransform(
  piece: PiecePreset,
  patch: Partial<ArtworkTransform>
): PiecePreset {
  return {
    ...piece,
    mask: {
      ...piece.mask,
      transform: { ...piece.mask.transform, ...patch }
    }
  }
}

export function updateHelperTransform(
  piece: PiecePreset,
  patch: Partial<ArtworkTransform>
): PiecePreset {
  if (!piece.helperShape) {
    return piece
  }

  return {
    ...piece,
    helperShape: {
      ...piece.helperShape,
      transform: { ...piece.helperShape.transform, ...patch }
    }
  }
}

export function toggleArtworkCutlineGroup(piece: PiecePreset): PiecePreset {
  return {
    ...piece,
    artworkCutlineGrouped: !piece.artworkCutlineGrouped
  }
}

export function maskShapeToCutlineShape(shape: MaskShape): CutlineShape {
  if (shape === 'ellipse') {
    return 'ellipse'
  }

  if (shape === 'rounded-rectangle') {
    return 'rounded-rectangle'
  }

  return 'rectangle'
}

function cutlineShapeToMaskShape(shape: CutlineShape): MaskShape {
  if (shape === 'ellipse') {
    return 'ellipse'
  }

  if (shape === 'rounded-rectangle') {
    return 'rounded-rectangle'
  }

  return 'rectangle'
}

function createShapeId(): string {
  return `shape-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
