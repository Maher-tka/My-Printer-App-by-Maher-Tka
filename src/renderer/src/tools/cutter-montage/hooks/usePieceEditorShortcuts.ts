import { useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react'

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
}

export function usePieceEditorShortcuts(
  actions: PieceEditorShortcutActions
): (event: ReactKeyboardEvent<HTMLElement>) => void {
  return useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): void => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return
      const ctrl = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (key === 'escape') {
        actions.clearSelection()
        return
      }
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault()
        actions.deleteSelection()
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
