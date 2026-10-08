import type { ArtworkTransform, EditorObject, PiecePreset } from '../types'
import { getArtworkObject, getCutlineObject, getMaskObject } from './pieceModelSync'
import { getCutlinePreviewTransform } from './cutlineAdjustment'
import type { ProductionBounds } from './cutlineGenerator'

/** The cut view changes the camera only; source coordinates remain intact. */
export function getPieceEditorViewBounds(
  piece: PiecePreset,
  focusSticker: boolean
): ProductionBounds {
  const frame = { xCm: 0, yCm: 0, widthCm: piece.widthCm, heightCm: piece.heightCm }
  if (!focusSticker) return frame
  const mask = piece.clippingMaskEnabled ? getMaskObject(piece) : undefined
  const cutlines = piece.objects.filter(
    (object) => object.role === 'cutline' && object.visible && object.exportEnabled !== false
  )
  const boundary = mask ?? getCutlineObject(piece) ?? getArtworkObject(piece)
  const bounds = [
    ...(boundary ? [rotatedBounds(boundary, boundary.transform)] : []),
    ...cutlines.map((object) => rotatedBounds(object, getCutlinePreviewTransform(object, piece)))
  ]
  if (!bounds.length) return frame
  const xCm = Math.min(...bounds.map((bound) => bound.xCm))
  const yCm = Math.min(...bounds.map((bound) => bound.yCm))
  return {
    xCm,
    yCm,
    widthCm: Math.max(...bounds.map((bound) => bound.xCm + bound.widthCm)) - xCm,
    heightCm: Math.max(...bounds.map((bound) => bound.yCm + bound.heightCm)) - yCm
  }
}

/** Preview unmasked artwork through its cutting shape in the cut step only. */
export function getCutViewMask(piece: PiecePreset): EditorObject | undefined {
  return (piece.clippingMaskEnabled ? getMaskObject(piece) : undefined) ?? getCutlineObject(piece)
}

function rotatedBounds(object: EditorObject, transform: ArtworkTransform): ProductionBounds {
  const angle = (transform.rotation * Math.PI) / 180
  const widthCm =
    object.shapeType === 'ellipse'
      ? Math.hypot(Math.cos(angle) * transform.widthCm, Math.sin(angle) * transform.heightCm)
      : Math.abs(Math.cos(angle)) * transform.widthCm +
        Math.abs(Math.sin(angle)) * transform.heightCm
  const heightCm =
    object.shapeType === 'ellipse'
      ? Math.hypot(Math.sin(angle) * transform.widthCm, Math.cos(angle) * transform.heightCm)
      : Math.abs(Math.sin(angle)) * transform.widthCm +
        Math.abs(Math.cos(angle)) * transform.heightCm
  return {
    xCm: transform.xCm + transform.widthCm / 2 - widthCm / 2,
    yCm: transform.yCm + transform.heightCm / 2 - heightCm / 2,
    widthCm,
    heightCm
  }
}
