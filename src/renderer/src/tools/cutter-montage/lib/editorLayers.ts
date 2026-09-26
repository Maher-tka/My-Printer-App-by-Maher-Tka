import type { EditorObject, PiecePreset } from '../types'
import { syncLegacyFieldsFromObjects } from './pieceModelSync'

export function isSelectableLayerObject(piece: PiecePreset, object: EditorObject): boolean {
  return (
    object.visible &&
    !object.locked &&
    !(
      piece.clippingMaskEnabled &&
      !piece.maskEditingEnabled &&
      (object.id === piece.maskObjectId || object.id === piece.artworkObjectId)
    )
  )
}

/** Object arrays are painted back to front; the panel displays them in reverse. */
export function reorderLayerObject(
  piece: PiecePreset,
  id: string,
  targetIndex: number
): PiecePreset {
  const index = piece.objects.findIndex((object) => object.id === id)
  if (index < 0 || !Number.isFinite(targetIndex)) return piece
  const object = piece.objects[index]
  if (
    object.locked ||
    (piece.clippingMaskEnabled &&
      !piece.maskEditingEnabled &&
      (id === piece.maskObjectId || id === piece.artworkObjectId))
  )
    return piece
  const destination = Math.max(0, Math.min(piece.objects.length - 1, Math.trunc(targetIndex)))
  if (destination === index) return piece
  const objects = [...piece.objects]
  objects.splice(index, 1)
  objects.splice(destination, 0, object)
  return syncLegacyFieldsFromObjects({ ...piece, objects })
}

export function renameLayerObject(piece: PiecePreset, id: string, name: string): PiecePreset {
  const cleanName = name.trim().slice(0, 120)
  const object = piece.objects.find((item) => item.id === id)
  if (!object || !cleanName || object.name === cleanName || object.locked) return piece
  // Display names must never change the production spot-color name.
  return syncLegacyFieldsFromObjects({
    ...piece,
    objects: piece.objects.map((item) => (item.id === id ? { ...item, name: cleanName } : item))
  })
}

/** Enter/leave a clipping group's edit mode without altering any geometry. */
export function setMaskEditing(piece: PiecePreset, enabled: boolean): PiecePreset {
  if (!piece.clippingMaskEnabled) return piece
  const ids = new Set([piece.artworkObjectId, piece.maskObjectId])
  return syncLegacyFieldsFromObjects({
    ...piece,
    maskEditingEnabled: enabled,
    selectedObjectIds: [],
    keyObjectId: undefined,
    objects: piece.objects.map((object) =>
      ids.has(object.id) ? { ...object, locked: !enabled } : object
    )
  })
}
