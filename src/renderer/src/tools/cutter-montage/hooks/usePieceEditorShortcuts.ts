import { useCallback } from 'react'
import type { EditorTool } from '../types'

interface PieceEditorShortcutActions {
  clearSelection: () => void
  selectAll: () => void
  copy: () => void
  paste: (inPlace: boolean) => void
  duplicate: () => void
  duplicateAsCutline: () => void
  deleteSelection: () => void
  nudge: (dxCm: number, dyCm: number) => void
  group: (linked: boolean) => void
  makeClippingMask: () => void
  releaseClippingMask: () => void
  undo: () => void
  redo: () => void
  setZoom: (updater: (value: number) => number) => void
  resetZoom: () => void
  setTool: (tool: EditorTool) => void
}

export function usePieceEditorShortcuts(
  actions: PieceEditorShortcutActions
): (event: KeyboardEvent) => void {
  return useCallback(
    (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing) return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || Boolean(target.closest('button, [contenteditable="true"]'))))
      )
        return
      const ctrl = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (key === 'escape') {
        event.preventDefault()
        actions.clearSelection()
        return
      }
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault()
        actions.deleteSelection()
        return
      }
      if (!ctrl && !event.altKey && key === 'v') {
        event.preventDefault()
        actions.setTool('pan')
        return
      }
      if (!ctrl && !event.altKey && key === 's') {
        event.preventDefault()
        actions.setTool('select')
        return
      }
      if (!ctrl && !event.altKey && key === 'p') {
        event.preventDefault()
        actions.setTool('line')
        return
      }
      if (!ctrl && !event.altKey && key === 'r') {
        event.preventDefault()
        actions.setTool(event.shiftKey ? 'rounded-rectangle' : 'rectangle')
        return
      }
      if (!ctrl && !event.altKey && key === 'o') {
        event.preventDefault()
        actions.setTool('ellipse')
        return
      }
      if (key.startsWith('arrow')) {
        event.preventDefault()
        const step = event.shiftKey ? 0.5 : 0.1
        actions.nudge(
          key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0,
          key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0
        )
        return
      }
      if (!ctrl) return

      const handled = true
      if (key === 'c' && event.shiftKey) actions.duplicateAsCutline()
      else if (key === 'c') actions.copy()
      else if (key === 'v') actions.paste(false)
      else if (key === 'f') actions.paste(true)
      else if (key === 'd') actions.duplicate()
      else if (key === 'g') actions.group(!event.shiftKey)
      else if (key === 'a') actions.selectAll()
      else if ((key === 'z' && event.shiftKey) || key === 'y') actions.redo()
      else if (key === 'z') actions.undo()
      else if (key === '7' && event.altKey) actions.releaseClippingMask()
      else if (key === '7') actions.makeClippingMask()
      else if (event.key === '+' || event.key === '=')
        actions.setZoom((value) => Math.min(value + 0.15, 2.5))
      else if (event.key === '-') actions.setZoom((value) => Math.max(value - 0.15, 0.45))
      else if (key === '0' || key === '1') actions.resetZoom()
      else return
      if (handled) event.preventDefault()
    },
    [actions]
  )
}
