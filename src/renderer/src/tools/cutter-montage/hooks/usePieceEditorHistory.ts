import { useCallback, useEffect, useRef, useState } from 'react'
import type { PiecePreset } from '../types'

const HISTORY_LIMIT = 50

export function usePieceEditorHistory(
  piece: PiecePreset,
  onPieceChange: (piece: PiecePreset) => void
): {
  commit: (nextPiece: PiecePreset) => void
  checkpoint: (previousPiece: PiecePreset) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
} {
  const [past, setPast] = useState<PiecePreset[]>([])
  const [future, setFuture] = useState<PiecePreset[]>([])
  const pieceRef = useRef(piece)
  pieceRef.current = piece

  useEffect(() => {
    setPast([])
    setFuture([])
  }, [piece.id])

  const commit = useCallback(
    (nextPiece: PiecePreset): void => {
      setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), pieceRef.current])
      setFuture([])
      onPieceChange(nextPiece)
    },
    [onPieceChange]
  )

  const checkpoint = useCallback((previousPiece: PiecePreset): void => {
    setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), previousPiece])
    setFuture([])
  }, [])

  const undo = useCallback((): void => {
    setPast((current) => {
      const previous = current[current.length - 1]
      if (!previous) return current
      setFuture((items) => [pieceRef.current, ...items].slice(0, HISTORY_LIMIT))
      onPieceChange(previous)
      return current.slice(0, -1)
    })
  }, [onPieceChange])

  const redo = useCallback((): void => {
    setFuture((current) => {
      const next = current[0]
      if (!next) return current
      setPast((items) => [...items.slice(-(HISTORY_LIMIT - 1)), pieceRef.current])
      onPieceChange(next)
      return current.slice(1)
    })
  }, [onPieceChange])

  return { commit, checkpoint, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 }
}
