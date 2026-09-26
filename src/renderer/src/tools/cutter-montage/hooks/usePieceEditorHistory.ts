import { useCallback, useEffect, useRef, useState } from 'react'
import type { PiecePreset } from '../types'

const HISTORY_LIMIT = 50

export type PieceHistoryUpdate = PiecePreset | ((currentPiece: PiecePreset) => PiecePreset)

export function usePieceEditorHistory(
  piece: PiecePreset,
  onPieceChange: (piece: PiecePreset) => void
): {
  commit: (update: PieceHistoryUpdate) => void
  checkpoint: (previousPiece: PiecePreset) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
} {
  const [past, setPast] = useState<PiecePreset[]>([])
  const [future, setFuture] = useState<PiecePreset[]>([])
  const pastRef = useRef<PiecePreset[]>([])
  const futureRef = useRef<PiecePreset[]>([])
  const pieceRef = useRef(piece)
  pieceRef.current = piece

  useEffect(() => {
    pastRef.current = []
    futureRef.current = []
    setPast([])
    setFuture([])
  }, [piece.id])

  const commit = useCallback(
    (update: PieceHistoryUpdate): void => {
      const currentPiece = pieceRef.current
      const nextPiece = resolvePieceHistoryUpdate(currentPiece, update)
      if (arePiecesEqual(currentPiece, nextPiece)) return

      const nextPast = appendHistoryEntry(pastRef.current, currentPiece)
      pastRef.current = nextPast
      futureRef.current = []
      pieceRef.current = nextPiece
      setPast(nextPast)
      setFuture([])
      onPieceChange(nextPiece)
    },
    [onPieceChange]
  )

  const checkpoint = useCallback((previousPiece: PiecePreset): void => {
    const nextPast = appendHistoryEntry(pastRef.current, previousPiece)
    if (nextPast === pastRef.current) return

    pastRef.current = nextPast
    futureRef.current = []
    setPast(nextPast)
    setFuture([])
  }, [])

  const undo = useCallback((): void => {
    const previous = pastRef.current[pastRef.current.length - 1]
    if (!previous) return

    const nextPast = pastRef.current.slice(0, -1)
    const nextFuture = [pieceRef.current, ...futureRef.current].slice(0, HISTORY_LIMIT)
    pastRef.current = nextPast
    futureRef.current = nextFuture
    pieceRef.current = previous
    setPast(nextPast)
    setFuture(nextFuture)
    onPieceChange(previous)
  }, [onPieceChange])

  const redo = useCallback((): void => {
    const next = futureRef.current[0]
    if (!next) return

    const nextPast = appendHistoryEntry(pastRef.current, pieceRef.current)
    const nextFuture = futureRef.current.slice(1)
    pastRef.current = nextPast
    futureRef.current = nextFuture
    pieceRef.current = next
    setPast(nextPast)
    setFuture(nextFuture)
    onPieceChange(next)
  }, [onPieceChange])

  return { commit, checkpoint, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 }
}

export function resolvePieceHistoryUpdate(
  currentPiece: PiecePreset,
  update: PieceHistoryUpdate
): PiecePreset {
  return typeof update === 'function' ? update(currentPiece) : update
}

function appendHistoryEntry(history: PiecePreset[], entry: PiecePreset): PiecePreset[] {
  const latest = history[history.length - 1]
  if (latest && arePiecesEqual(latest, entry)) return history
  return [...history.slice(-(HISTORY_LIMIT - 1)), entry]
}

function arePiecesEqual(left: PiecePreset, right: PiecePreset): boolean {
  if (left === right) return true
  if (left.id !== right.id) return false
  return JSON.stringify(left) === JSON.stringify(right)
}
