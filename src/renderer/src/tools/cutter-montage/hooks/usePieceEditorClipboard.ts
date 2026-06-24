import { useCallback, useRef, useState } from 'react'
import type { EditorObject, PiecePreset } from '../types'
import { duplicateObjects } from '../lib/editorObjects'
import { syncLegacyFieldsFromObjects } from '../lib/pieceModelSync'

export function usePieceEditorClipboard(): {
  hasClipboard: boolean
  copy: (piece: PiecePreset) => void
  paste: (piece: PiecePreset, inPlace: boolean) => PiecePreset | null
  duplicate: (piece: PiecePreset) => PiecePreset | null
} {
  const clipboardRef = useRef<EditorObject[]>([])
  const [hasClipboard, setHasClipboard] = useState(false)

  const copy = useCallback((piece: PiecePreset): void => {
    const selected = new Set(piece.selectedObjectIds)
    const nextClipboard = piece.objects.filter((object) => selected.has(object.id)).map(cloneObject)
    clipboardRef.current = nextClipboard
    setHasClipboard(nextClipboard.length > 0)
  }, [])

  const paste = useCallback((piece: PiecePreset, inPlace: boolean): PiecePreset | null => {
    const clipboard = clipboardRef.current
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
  }, [])

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

  return { hasClipboard, copy, paste, duplicate }
}

function cloneObject(object: EditorObject): EditorObject {
  return { ...object, transform: { ...object.transform } }
}
