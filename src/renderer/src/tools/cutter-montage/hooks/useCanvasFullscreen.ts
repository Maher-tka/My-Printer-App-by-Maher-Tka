import { useCallback, useEffect, useRef, useState } from 'react'

export function useCanvasFullscreen<T extends HTMLElement>() {
  const containerRef = useRef<T>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const expandedRef = useRef(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const update = (): void => {
      const expanded = document.fullscreenElement === containerRef.current
      if (expandedRef.current && !expanded) {
        buttonRef.current?.focus({ preventScroll: true })
      }
      expandedRef.current = expanded
      setIsExpanded(expanded)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || document.fullscreenElement !== containerRef.current) return
      event.preventDefault()
      event.stopPropagation()
      void document.exitFullscreen().catch(() => {
        setError('Could not restore the workspace. Use the Restore workspace button.')
      })
    }
    document.addEventListener('fullscreenchange', update)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('fullscreenchange', update)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])

  const toggleExpanded = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      if (document.fullscreenElement === containerRef.current) {
        await document.exitFullscreen()
      } else {
        await containerRef.current?.requestFullscreen()
      }
    } catch {
      setError('Could not expand the canvas. Try again from the canvas button.')
    }
  }, [])

  return { containerRef, buttonRef, isExpanded, error, toggleExpanded }
}
