import { useRef, useState } from 'react'
import type { CutterSheetSettings } from '../types'
import { calculateDraggedSheetHeight, clampSheetHeight } from '../lib/cutterLayout'
import {
  MAX_PRODUCTION_SHEET_HEIGHT_CM,
  MIN_PRODUCTION_SHEET_HEIGHT_CM
} from '../lib/productionSheets'

interface ArtboardResizeHandleProps {
  settings: CutterSheetSettings
  scale: number
  onHeightChange: (heightCm: number) => void
}

export function ArtboardResizeHandle({
  settings,
  scale,
  onHeightChange
}: ArtboardResizeHandleProps): JSX.Element {
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({
    pointerId: -1,
    startY: 0,
    startHeightCm: settings.heightCm,
    lastHeightCm: settings.heightCm
  })

  const emitHeight = (heightCm: number): void => {
    const nextHeightCm = clampSheetHeight(heightCm)
    if (nextHeightCm === dragRef.current.lastHeightCm) return
    dragRef.current.lastHeightCm = nextHeightCm
    onHeightChange(nextHeightCm)
  }

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 flex h-8 translate-y-1/2 touch-none select-none items-center justify-center outline-none ${
        dragging ? 'cursor-grabbing text-primary' : 'cursor-ns-resize text-muted-foreground'
      } focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
      role="slider"
      tabIndex={0}
      aria-label="Adjust production sheet height"
      aria-orientation="vertical"
      aria-valuemin={MIN_PRODUCTION_SHEET_HEIGHT_CM}
      aria-valuemax={MAX_PRODUCTION_SHEET_HEIGHT_CM}
      aria-valuenow={settings.heightCm}
      aria-valuetext={`${settings.heightCm.toFixed(1)} centimeters`}
      title="Drag up or down to resize the production sheet and reflow the montage"
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.focus({ preventScroll: true })
        dragRef.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          startHeightCm: settings.heightCm,
          lastHeightCm: settings.heightCm
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
        onHeightChange(settings.heightCm)
      }}
      onPointerMove={(event) => {
        if (dragRef.current.pointerId !== event.pointerId) {
          return
        }

        emitHeight(
          calculateDraggedSheetHeight(
            dragRef.current.startHeightCm,
            event.clientY - dragRef.current.startY,
            scale,
            settings.gridStepCm
          )
        )
      }}
      onPointerUp={(event) => {
        if (dragRef.current.pointerId !== event.pointerId) {
          return
        }

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }

        dragRef.current.pointerId = -1
        setDragging(false)
      }}
      onPointerCancel={() => {
        dragRef.current.pointerId = -1
        setDragging(false)
      }}
      onKeyDown={(event) => {
        const stepCm = event.shiftKey ? 10 : Math.max(settings.gridStepCm, 0.5)
        let nextHeightCm: number | null = null

        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          nextHeightCm = settings.heightCm - stepCm
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          nextHeightCm = settings.heightCm + stepCm
        } else if (event.key === 'PageUp') {
          nextHeightCm = settings.heightCm - 10
        } else if (event.key === 'PageDown') {
          nextHeightCm = settings.heightCm + 10
        } else if (event.key === 'Home') {
          nextHeightCm = MIN_PRODUCTION_SHEET_HEIGHT_CM
        } else if (event.key === 'End') {
          nextHeightCm = MAX_PRODUCTION_SHEET_HEIGHT_CM
        }

        if (nextHeightCm === null) return
        event.preventDefault()
        emitHeight(nextHeightCm)
      }}
    >
      <div className="absolute inset-x-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary/45" />
      <div className="relative rounded-full border bg-card px-3 py-1 text-xs font-semibold shadow-sm">
        ↕ Drag sheet height · {settings.heightCm.toFixed(1)} cm
      </div>
    </div>
  )
}
