import { useCallback, useMemo } from 'react'
import type { EditorObjectType, KeyObjectState, PiecePreset } from '../types'
import { syncLegacyFieldsFromObjects } from '../lib/pieceModelSync'

export function usePieceEditorSelection(
  piece: PiecePreset,
  onPieceChange: (piece: PiecePreset) => void,
  onSelectedTypesChange: (objects: EditorObjectType[]) => void,
  onKeyTypeChange: (object: EditorObjectType | null) => void
): {
  selectedObjectIds: string[]
  selectedTypes: EditorObjectType[]
  keyObjectId?: string
  keyObject: KeyObjectState
  selectIds: (ids: string[]) => void
  toggleId: (id: string, additive: boolean) => void
  selectTypes: (types: EditorObjectType[]) => void
  setKeyObjectId: (id?: string) => void
  setKeyObjectType: (type: EditorObjectType | null) => void
} {
  const selectedTypes = useMemo(
    () => Array.from(new Set(piece.objects
      .filter((object) => piece.selectedObjectIds.includes(object.id))
      .map((object) => object.type))),
    [piece.objects, piece.selectedObjectIds]
  )
  const keyObject = useMemo<KeyObjectState>(() => {
    const object = piece.objects.find((candidate) => candidate.id === piece.keyObjectId)
    return { object: object?.type ?? null, objectId: object?.id }
  }, [piece.keyObjectId, piece.objects])

  const selectIds = useCallback((ids: string[]): void => {
    const validIds = Array.from(new Set(ids)).filter((id) => piece.objects.some((object) => object.id === id))
    const keyObjectId = piece.keyObjectId && validIds.includes(piece.keyObjectId)
      ? piece.keyObjectId
      : undefined
    const next = syncLegacyFieldsFromObjects({ ...piece, selectedObjectIds: validIds, keyObjectId })
    onPieceChange(next)
  }, [onPieceChange, piece])

  const toggleId = useCallback((id: string, additive: boolean): void => {
    if (!additive) {
      selectIds([id])
      return
    }
    selectIds(piece.selectedObjectIds.includes(id)
      ? piece.selectedObjectIds.filter((selectedId) => selectedId !== id)
      : [...piece.selectedObjectIds, id])
  }, [piece.selectedObjectIds, selectIds])

  const selectTypes = useCallback((types: EditorObjectType[]): void => {
    const typeSet = new Set(types)
    selectIds(piece.objects.filter((object) => typeSet.has(object.type)).map((object) => object.id))
    onSelectedTypesChange(types)
  }, [onSelectedTypesChange, piece.objects, selectIds])

  const setKeyObjectId = useCallback((id?: string): void => {
    if (id && !piece.selectedObjectIds.includes(id)) return
    const object = piece.objects.find((candidate) => candidate.id === id)
    onPieceChange(syncLegacyFieldsFromObjects({ ...piece, keyObjectId: object?.id }))
  }, [onPieceChange, piece])

  const setKeyObjectType = useCallback((type: EditorObjectType | null): void => {
    if (!type) {
      setKeyObjectId(undefined)
      return
    }
    const object = piece.objects.find(
      (candidate) => candidate.type === type && piece.selectedObjectIds.includes(candidate.id)
    )
    setKeyObjectId(object?.id)
    onKeyTypeChange(object?.type ?? null)
  }, [onKeyTypeChange, piece.objects, piece.selectedObjectIds, setKeyObjectId])

  return {
    selectedObjectIds: piece.selectedObjectIds,
    selectedTypes,
    keyObjectId: piece.keyObjectId,
    keyObject,
    selectIds,
    toggleId,
    selectTypes,
    setKeyObjectId,
    setKeyObjectType
  }
}
