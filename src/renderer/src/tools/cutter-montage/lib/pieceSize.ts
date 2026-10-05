import type { ArtworkTransform, PiecePreset } from '../types'
import { synchronizePieceEditorModel } from './editorObjects'
import { resizePiecePreset } from './piecePresets'

/** Sticker dimensions exclude the source image outside an active clipping mask. */
export function getPieceSize(piece: PiecePreset): { widthCm: number; heightCm: number } {
  const mask = piece.clippingMaskEnabled
    ? piece.objects.find((object) => object.id === piece.maskObjectId)
    : undefined
  return mask
    ? { widthCm: mask.transform.widthCm, heightCm: mask.transform.heightCm }
    : { widthCm: piece.widthCm, heightCm: piece.heightCm }
}

/** Resize in the mask's axes while preserving the artwork crop and layer relationships. */
export function resizePieceToSize(
  piece: PiecePreset,
  widthCm: number,
  heightCm: number,
  source: 'width' | 'height'
): PiecePreset {
  const normalized = synchronizePieceEditorModel(piece)
  const mask = normalized.clippingMaskEnabled
    ? normalized.objects.find((object) => object.id === normalized.maskObjectId)
    : undefined
  if (!mask) return resizePiecePreset(normalized, widthCm, heightCm, source)
  const size = getPieceSize(normalized)
  const scaleX = widthCm / size.widthCm
  const scaleY = heightCm / size.heightCm
  const angle = mask.transform.rotation
  const inMaskAxes = {
    ...normalized,
    objects: normalized.objects.map((object) => ({
      ...object,
      transform: rotateTransform(object.transform, -angle)
    }))
  }
  const resized = resizePiecePreset(
    inMaskAxes,
    normalized.widthCm * scaleX,
    normalized.heightCm * scaleY,
    source
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
