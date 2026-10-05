import type { ArtworkTransform, EditorObject, PiecePreset } from '../types'
import { getPieceCutlineRect } from './cutlineGenerator'
import {
  getCutlineObject,
  getMaskObject,
  syncLegacyFieldsFromObjects,
  updateObject
} from './pieceModelSync'

export function getCutlineOffsetMm(object: EditorObject, piece?: PiecePreset): number {
  return (
    object.offsetMm ??
    (piece && getCutlineObject(piece)?.id === object.id ? piece.cutline.transform.offsetMm : 0)
  )
}

/** Use the same physical offset in the editor as in production exports. */
export function getCutlinePreviewTransform(
  object: EditorObject,
  piece?: PiecePreset
): ArtworkTransform {
  if (object.role !== 'cutline') return object.transform
  return getPieceCutlineRect({
    shape: 'rectangle',
    transform: { ...object.transform, offsetMm: getCutlineOffsetMm(object, piece) },
    strokeName: object.strokeName ?? 'CutContour',
    strokeColor: object.strokeColor ?? '#ff00ff',
    strokeWidthPt: object.strokeWidthPt ?? 0.25
  })
}

export function setCutlineOffset(
  piece: PiecePreset,
  objectId: string,
  offsetMm: number
): PiecePreset {
  const cutline = piece.objects.find(
    (object) => object.id === objectId && object.role === 'cutline'
  )
  if (!cutline || cutline.locked || !Number.isFinite(offsetMm)) return piece
  const width = cutline.transform.widthCm + offsetMm / 5
  const height = cutline.transform.heightCm + offsetMm / 5
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0.02 || height < 0.02)
    return piece
  return updateObject(piece, objectId, { offsetMm })
}

/** Move only the contour, even when the artwork belongs to the same group. */
export function nudgeCutline(
  piece: PiecePreset,
  objectId: string,
  dxMm: number,
  dyMm: number
): PiecePreset {
  const cutline = piece.objects.find(
    (object) => object.id === objectId && object.role === 'cutline'
  )
  if (!cutline || !Number.isFinite(dxMm) || !Number.isFinite(dyMm)) return piece
  const xCm = Number((cutline.transform.xCm + dxMm / 10).toFixed(6))
  const yCm = Number((cutline.transform.yCm + dyMm / 10).toFixed(6))
  if (!Number.isFinite(xCm) || !Number.isFinite(yCm)) return piece
  return updateObject(piece, objectId, { transform: { ...cutline.transform, xCm, yCm } })
}

/** Copy the prepared edge exactly, clearing both size drift and the cut margin. */
export function matchCutlineToMask(piece: PiecePreset, objectId: string): PiecePreset {
  const mask = piece.clippingMaskEnabled ? getMaskObject(piece) : undefined
  const cutline = piece.objects.find(
    (object) => object.id === objectId && object.role === 'cutline'
  )
  if (!mask || !cutline || cutline.locked) return piece
  return syncLegacyFieldsFromObjects({
    ...piece,
    objects: piece.objects.map((object) =>
      object.id === objectId
        ? {
            ...object,
            shapeType: mask.shapeType,
            pathData: mask.pathData,
            transform: { ...mask.transform },
            offsetMm: 0
          }
        : object
    )
  })
}
