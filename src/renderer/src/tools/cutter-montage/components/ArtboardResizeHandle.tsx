import { useRef, useState } from 'react'
import type { CutterSheetSettings } from '../types'
import { clampSheetHeight } from '../lib/cutterLayout'
import { roundToStep } from '../lib/units'

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
    startHeightCm: settings.heightCm
  })

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 flex translate-y-1/2 cursor-ns-resize items-center justify-center ${
        dragging ? 'text-primary' : 'text-muted-foreground'
      }`}
      onPointerDown={(event) => {
        event.preventDefault()
        dragRef.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          startHeightCm: settings.heightCm
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
      }}
      onPointerMove={(event) => {
        if (dragRef.current.pointerId !== event.pointerId) {
          return
        }

        const deltaCm = (event.clientY - dragRef.current.startY) / scale
        const nextHeight = clampSheetHeight(
          roundToStep(dragRef.current.startHeightCm + deltaCm, settings.gridStepCm)
        )

        onHeightChange(nextHeight)
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
    >
      <div className="rounded-full border bg-card px-3 py-1 text-xs font-semibold shadow-sm">
        Drag height: {settings.heightCm.toFixed(1)} cm
      </div>
    </div>
  )
}
