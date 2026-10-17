import type { ArtworkTransform, EditorObject, PiecePreset } from '../types'
import { synchronizePieceEditorModel } from './editorObjects'
import { resizePiecePreset } from './piecePresets'
import { getPathBounds } from './pathBounds'

/** Measure the finished sticker, excluding cropped source artwork and cut margin. */
export function getPieceSize(piece: PiecePreset): { widthCm: number; heightCm: number } {
  const boundary = getStickerBoundary(piece)
  return boundary ? getBoundarySize(boundary) : { widthCm: piece.widthCm, heightCm: piece.heightCm }
}

function getBoundarySize(boundary: EditorObject): { widthCm: number; heightCm: number } {
  const bounds =
    boundary.shapeType === 'path' && boundary.pathData ? getPathBounds(boundary.pathData) : null
  return {
    widthCm: boundary.transform.widthCm * (bounds?.width ?? 1),
    heightCm: boundary.transform.heightCm * (bounds?.height ?? 1)
  }
}

function getCutContour(piece: PiecePreset): EditorObject | undefined {
  return (
    piece.objects.find(
      (object) =>
        object.role === 'cutline' &&
        object.id === piece.cutlineObjectId &&
        object.exportEnabled !== false
    ) ?? piece.objects.find((object) => object.role === 'cutline' && object.exportEnabled !== false)
  )
}

/** Finished production dimensions come from the cutting contour, including its cut margin. */
export function getFinishedPieceSize(piece: PiecePreset): { widthCm: number; heightCm: number } {
  const contour = getCutContour(piece)
  if (!contour) return getPieceSize(piece)
  const size = getBoundarySize(contour)
  const margin = ((contour.offsetMm ?? 0) / 10) * 2
  return margin
    ? getBoundarySize({
        ...contour,
        transform: {
          ...contour.transform,
          widthCm: contour.transform.widthCm + margin,
          heightCm: contour.transform.heightCm + margin
        }
      })
    : size
}

export function resizeFinishedPiece(
  piece: PiecePreset,
  widthCm: number,
  heightCm: number,
  source: 'width' | 'height'
): PiecePreset {
  const normalized = synchronizePieceEditorModel(piece)
  const contour = getCutContour(normalized)
  if (!contour) return resizePieceToSize(piece, widthCm, heightCm, source)
  const base = getBoundarySize(contour)
  const finished = getFinishedPieceSize(normalized)
  return resizeUsingBoundary(
    normalized,
    contour,
    widthCm - (finished.widthCm - base.widthCm),
    heightCm - (finished.heightCm - base.heightCm),
    source
  )
}

function getStickerBoundary(piece: PiecePreset): EditorObject | undefined {
  const objects = piece.objects ?? []
  const mask =
    (piece.clippingMaskEnabled ?? piece.mask.enabled)
      ? (objects.find(
          (object) => object.role === 'clipping-mask' && object.id === piece.maskObjectId
        ) ?? objects.find((object) => object.role === 'clipping-mask'))
      : undefined
  return (
    mask ??
    objects.find((object) => object.role === 'cutline' && object.id === piece.cutlineObjectId) ??
    objects.find((object) => object.role === 'cutline' && object.exportEnabled !== false)
  )
}

/** Resize in the sticker's axes while preserving the crop and layer relationships. */
export function resizePieceToSize(
  piece: PiecePreset,
  widthCm: number,
  heightCm: number,
  source: 'width' | 'height'
): PiecePreset {
  const normalized = synchronizePieceEditorModel(piece)
  const boundary = getStickerBoundary(normalized)
  if (!boundary) return resizePiecePreset(normalized, widthCm, heightCm, source)
  return resizeUsingBoundary(normalized, boundary, widthCm, heightCm, source)
}

function resizeUsingBoundary(
  normalized: PiecePreset,
  boundary: EditorObject,
  widthCm: number,
  heightCm: number,
  source: 'width' | 'height'
): PiecePreset {
  const angle = boundary.transform.rotation
  const inStickerAxes = {
    ...normalized,
    objects: normalized.objects.map((object) => ({
      ...object,
      transform: rotateTransform(object.transform, -angle)
    }))
  }
  const resized = resizePiecePreset(
    inStickerAxes,
    widthCm,
    heightCm,
    source,
    getBoundarySize(boundary)
  )
  const actualScaleX = resized.widthCm / normalized.widthCm
  const actualScaleY = resized.heightCm / normalized.heightCm
  // The source frame remains a coordinate frame; its dimensions are not the sticker size.
  const corners = [
    [0, 0],
    [normalized.widthCm, 0],
    [0, normalized.heightCm],
    [normalized.widthCm, normalized.heightCm]
  ].map(([x, y]) => {
    const local = rotatePoint(x, y, -angle)
    return rotatePoint(local.x * actualScaleX, local.y * actualScaleY, angle)
  })
  const left = Math.min(...corners.map((point) => point.x))
  const top = Math.min(...corners.map((point) => point.y))
  return synchronizePieceEditorModel({
    ...resized,
    widthCm: Math.max(...corners.map((point) => point.x)) - left,
    heightCm: Math.max(...corners.map((point) => point.y)) - top,
    objects: resized.objects.map((object) => {
      const transform = rotateTransform(object.transform, angle)
      return {
        ...object,
        transform: { ...transform, xCm: transform.xCm - left, yCm: transform.yCm - top }
      }
    })
  })
}

function rotatePoint(x: number, y: number, angle: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians)
  }
}

function rotateTransform(transform: ArtworkTransform, angle: number): ArtworkTransform {
  const center = rotatePoint(
    transform.xCm + transform.widthCm / 2,
    transform.yCm + transform.heightCm / 2,
    angle
  )
  return {
    ...transform,
    xCm: center.x - transform.widthCm / 2,
    yCm: center.y - transform.heightCm / 2,
    rotation: transform.rotation + angle
  }
}
