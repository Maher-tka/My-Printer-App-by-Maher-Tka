import { useState, type Dispatch, type SetStateAction } from 'react'
import type { EditorTool } from '../types'
import type { PieceEditorContextMenuState } from '../components/piece-editor/PieceEditorContextMenu'

export function usePieceEditorState(): {
  tool: EditorTool
  setTool: (tool: EditorTool) => void
  zoom: number
  setZoom: Dispatch<SetStateAction<number>>
  showGrid: boolean
  setShowGrid: (value: boolean) => void
  snapToGrid: boolean
  setSnapToGrid: (value: boolean) => void
  smartGuides: boolean
  setSmartGuides: (value: boolean) => void
  contextMenu: PieceEditorContextMenuState | null
  setContextMenu: (value: PieceEditorContextMenuState | null) => void
} {
  const [tool, setTool] = useState<EditorTool>('select')
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [smartGuides, setSmartGuides] = useState(true)
  const [contextMenu, setContextMenu] = useState<PieceEditorContextMenuState | null>(null)

  return {
    tool,
    setTool,
    zoom,
    setZoom,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    smartGuides,
    setSmartGuides,
    contextMenu,
    setContextMenu
  }
}
