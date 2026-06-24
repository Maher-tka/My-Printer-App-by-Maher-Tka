import { useCallback } from 'react'
import type { PiecePreset } from '../types'
import { syncLegacyFieldsFromObjects } from '../lib/pieceModelSync'

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
        piece.objects.some((object) => object.id === id)
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
    [piece.selectedObjectIds, selectIds]
  )

  const setKeyObjectId = useCallback(
    (id?: string): void => {
      if (id && !piece.selectedObjectIds.includes(id)) return
      const object = piece.objects.find((candidate) => candidate.id === id)
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
