import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SheetBoardPosition } from '../types'
import { SHEET_BOARD_CARD } from '../lib/sheetLayoutState'

interface DraggableSheetCardProps {
  itemId: string
  position: SheetBoardPosition
  selected: boolean
  onSelect: () => void
  onPositionChange: (itemId: string, position: SheetBoardPosition) => void
  children: ReactNode
}

export function DraggableSheetCard({
  itemId,
  position,
  selected,
  onSelect,
  onPositionChange,
  children
}: DraggableSheetCardProps): JSX.Element {
  const [dragging, setDragging] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const latestPositionRef = useRef(position)
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  })

  useEffect(() => {
    latestPositionRef.current = position

    if (!dragRef.current.active) {
      setCardTransform(position)
    }
  }, [position])

  return (
    <div
      ref={cardRef}
      data-draggable-sheet-card="true"
      className={`group absolute touch-none select-none rounded-md border bg-card shadow-sm will-change-transform transition-shadow ${
        dragging ? 'z-30 cursor-grabbing shadow-xl' : 'z-10 cursor-grab hover:shadow-md'
      } ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
      style={{
        width: SHEET_BOARD_CARD.width,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        contentVisibility: dragging ? 'visible' : 'auto',
        containIntrinsicSize: `${SHEET_BOARD_CARD.width}px 326px`
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || hasNoDragTarget(event.target)) {
          return
        }

        event.preventDefault()
        dragRef.current = {
          active: true,
          moved: false,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: position.x,
          originY: position.y
        }
        latestPositionRef.current = position
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current

        if (!drag.active || drag.pointerId !== event.pointerId) {
          return
        }

        event.preventDefault()
        const deltaX = event.clientX - drag.startX
        const deltaY = event.clientY - drag.startY

        if (Math.abs(deltaX) + Math.abs(deltaY) > 3) {
          drag.moved = true
        }

        const nextPosition = {
          x: drag.originX + deltaX,
          y: drag.originY + deltaY
        }

        latestPositionRef.current = nextPosition
        scheduleTransform()
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current

        if (drag.pointerId === event.pointerId) {
          dragRef.current = { ...drag, active: false, pointerId: -1 }
          setDragging(false)
          cancelScheduledTransform()

          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }

          if (!drag.moved) {
            setCardTransform(position)
            onSelect()
            return
          }

          onPositionChange(itemId, latestPositionRef.current)
        }
      }}
      onPointerCancel={() => {
        dragRef.current = { ...dragRef.current, active: false, pointerId: -1 }
        cancelScheduledTransform()
        setCardTransform(position)
        setDragging(false)
      }}
    >
      {children}
    </div>
  )

  function scheduleTransform(): void {
    if (animationFrameRef.current !== null) {
      return
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null
      setCardTransform(latestPositionRef.current)
    })
  }

  function cancelScheduledTransform(): void {
    if (animationFrameRef.current === null) {
      return
    }

    window.cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
  }

  function setCardTransform(nextPosition: SheetBoardPosition): void {
    if (!cardRef.current) {
      return
    }

    cardRef.current.style.transform = `translate3d(${nextPosition.x}px, ${nextPosition.y}px, 0)`
  }
}

function hasNoDragTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('[data-no-drag="true"]'))
}
