import { useCallback } from 'react'
import type { PiecePreset } from '../types'
import { syncLegacyFieldsFromObjects } from '../lib/pieceModelSync'
import { isSelectableLayerObject } from '../lib/editorLayers'

export function usePieceEditorSelection(
  piece: PiecePreset,
  onPieceChange: (piece: PiecePreset) => void
): {
  selectIds: (ids: string[]) => void
  toggleId: (id: string, additive: boolean) => void
  setKeyObjectId: (id?: string) => void
} {
  const selectIds = useCallback(
    (ids: string[]): void => {
      const validIds = Array.from(new Set(ids)).filter((id) =>
        piece.objects.some((object) => object.id === id && isSelectableLayerObject(piece, object))
      )
      const keyObjectId =
        piece.keyObjectId && validIds.includes(piece.keyObjectId) ? piece.keyObjectId : undefined
      const next = syncLegacyFieldsFromObjects({
        ...piece,
        selectedObjectIds: validIds,
        keyObjectId
      })
      onPieceChange(next)
    },
    [onPieceChange, piece]
  )

  const toggleId = useCallback(
    (id: string, additive: boolean): void => {
      const object = piece.objects.find((item) => item.id === id)
      if (!object || !isSelectableLayerObject(piece, object)) return
      if (!additive) {
        selectIds([id])
        return
      }
      selectIds(
        piece.selectedObjectIds.includes(id)
          ? piece.selectedObjectIds.filter((selectedId) => selectedId !== id)
          : [...piece.selectedObjectIds, id]
      )
    },
    [piece, selectIds]
  )

  const setKeyObjectId = useCallback(
    (id?: string): void => {
      if (id && !piece.selectedObjectIds.includes(id)) return
      const object = piece.objects.find((candidate) => candidate.id === id)
      if (object && !isSelectableLayerObject(piece, object)) return
      onPieceChange(syncLegacyFieldsFromObjects({ ...piece, keyObjectId: object?.id }))
    },
    [onPieceChange, piece]
  )

  return {
    selectIds,
    toggleId,
    setKeyObjectId
  }
}
