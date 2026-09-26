import { useCallback } from 'react'
import type { ArtworkTransform, PiecePreset } from '../types'
import { syncLegacyFieldsFromObjects } from '../lib/pieceModelSync'

export function usePieceEditorTransforms(): {
  updateTransform: (
    piece: PiecePreset,
    objectId: string,
    patch: Partial<ArtworkTransform>
  ) => PiecePreset
  moveSelection: (piece: PiecePreset, dxCm: number, dyCm: number) => PiecePreset
  setSelectionLock: (piece: PiecePreset, locked: boolean) => PiecePreset
} {
  const updateTransform = useCallback(
    (piece: PiecePreset, objectId: string, patch: Partial<ArtworkTransform>): PiecePreset =>
      syncLegacyFieldsFromObjects({
        ...piece,
        objects: piece.objects.map((object) =>
          object.id === objectId && !object.locked && !isActiveMaskPairObject(piece, object.id)
            ? { ...object, transform: { ...object.transform, ...patch } }
            : object
        )
      }),
    []
  )

  const moveSelection = useCallback(
    (piece: PiecePreset, dxCm: number, dyCm: number): PiecePreset => {
      const selected = new Set(piece.selectedObjectIds)
      const selectedGroups = new Set(
        piece.objects
          .filter((object) => selected.has(object.id) && object.groupId)
          .map((object) => object.groupId)
      )
      return syncLegacyFieldsFromObjects({
        ...piece,
        objects: piece.objects.map((object) =>
          (selected.has(object.id) ||
            Boolean(
              !piece.maskEditingEnabled && object.groupId && selectedGroups.has(object.groupId)
            )) &&
          !object.locked &&
          !isActiveMaskPairObject(piece, object.id)
            ? {
                ...object,
                transform: {
                  ...object.transform,
                  xCm: object.transform.xCm + dxCm,
                  yCm: object.transform.yCm + dyCm
                }
              }
            : object
        )
      })
    },
    []
  )

  const setSelectionLock = useCallback((piece: PiecePreset, locked: boolean): PiecePreset => {
    const selected = new Set(piece.selectedObjectIds)
    return syncLegacyFieldsFromObjects({
      ...piece,
      objects: piece.objects.map((object) =>
        selected.has(object.id)
          ? { ...object, locked: isActiveMaskPairObject(piece, object.id) ? true : locked }
          : object
      )
    })
  }, [])

  return { updateTransform, moveSelection, setSelectionLock }
}

function isActiveMaskPairObject(piece: PiecePreset, objectId: string): boolean {
  return (
    piece.clippingMaskEnabled &&
    !piece.maskEditingEnabled &&
    (piece.maskObjectId === objectId || piece.artworkObjectId === objectId)
  )
}
