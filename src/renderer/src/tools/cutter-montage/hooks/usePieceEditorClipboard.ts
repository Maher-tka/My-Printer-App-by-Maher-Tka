import { useCallback, useState } from 'react'
import type { EditorObject, PiecePreset } from '../types'
import { duplicateObjects } from '../lib/editorObjects'
import { syncLegacyFieldsFromObjects } from '../lib/pieceModelSync'

export function usePieceEditorClipboard(): {
  hasClipboard: boolean
  copy: (piece: PiecePreset) => void
  paste: (piece: PiecePreset, inPlace: boolean) => PiecePreset | null
  duplicate: (piece: PiecePreset) => PiecePreset | null
} {
  const [clipboard, setClipboard] = useState<EditorObject[]>([])

  const copy = useCallback((piece: PiecePreset): void => {
    const selected = new Set(piece.selectedObjectIds)
    setClipboard(piece.objects.filter((object) => selected.has(object.id)).map(cloneObject))
  }, [])

  const paste = useCallback((piece: PiecePreset, inPlace: boolean): PiecePreset | null => {
    if (clipboard.length === 0) return null
    const temporaryIds = clipboard.map((object) => object.id)
    const result = duplicateObjects(clipboard, temporaryIds, inPlace)
    const duplicates = result.objects.slice(clipboard.length)
    return syncLegacyFieldsFromObjects({
      ...piece,
      objects: [...piece.objects, ...duplicates],
      selectedObjectIds: duplicates.map((object) => object.id),
      keyObjectId: undefined
    })
  }, [clipboard])

  const duplicate = useCallback((piece: PiecePreset): PiecePreset | null => {
    if (piece.selectedObjectIds.length === 0) return null
    const result = duplicateObjects(piece.objects, piece.selectedObjectIds, false)
    return syncLegacyFieldsFromObjects({
      ...piece,
      objects: result.objects,
      selectedObjectIds: result.selectedObjectIds,
      keyObjectId: undefined
    })
  }, [])

  return { hasClipboard: clipboard.length > 0, copy, paste, duplicate }
}

function cloneObject(object: EditorObject): EditorObject {
  return { ...object, transform: { ...object.transform } }
}
