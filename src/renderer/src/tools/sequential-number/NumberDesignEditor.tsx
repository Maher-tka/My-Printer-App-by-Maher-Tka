import { useLanguage } from '@/i18n/useLanguage'
import { useEffect, useRef, useState } from 'react'
import type { NumberPosition, SequentialProject } from './types'
import { formatSequenceNumber, positionLabel } from './lib/layout'
import { moveNumberPosition } from './lib/positioning'

export function NumberDesignEditor({
  project,
  selected,
  onSelect,
  onChange: onPositionsChange,
  disabled
}: {
  project: SequentialProject
  selected: string
  onSelect: (id: string) => void
  onChange: (positions: NumberPosition[]) => void
  disabled: boolean
}): JSX.Element {
  const { t } = useLanguage()

  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{
    id: string
    pointer: number
    x: number
    y: number
    before: NumberPosition[]
    width: number
    height: number
  } | null>(null)
  const [snap, setSnap] = useState(false)
  const [zoom, setZoom] = useState(1)
  const history = useRef<NumberPosition[][]>([])
  const future = useRef<NumberPosition[][]>([])
  const expected = useRef(project.positions)
  const onChange = (positions: NumberPosition[]) => {
    expected.current = positions
    onPositionsChange(positions)
  }
  useEffect(() => {
    if (project.positions !== expected.current) {
      history.current = []
      future.current = []
      expected.current = project.positions
    }
  }, [project.positions])
  const latest = useRef(project.positions)
  latest.current = project.positions
  const { ticketWidthMm: width, ticketHeightMm: height } = project.settings
  const checkpoint = (positions: NumberPosition[]) => {
    history.current = [...history.current.slice(-49), positions]
    future.current = []
  }
  const endDrag = (cancel: boolean) => {
    const active = drag.current
    if (!active) return
    drag.current = null
    if (cancel) onChange(active.before)
    else if (JSON.stringify(active.before) !== JSON.stringify(latest.current))
      checkpoint(active.before)
    if (svg.current?.hasPointerCapture(active.pointer))
      svg.current.releasePointerCapture(active.pointer)
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          {t('Snap to 1 mm')}
        </label>
        <label>
          {t('Zoom')}{' '}
          <select
            aria-label="Design zoom"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-8 rounded-[10px] border border-input bg-background px-2"
          >
            {[1, 1.5, 2, 3].map((z) => (
              <option key={z} value={z}>
                {z * 100}%
              </option>
            ))}
          </select>
        </label>
        <span>
          Drag to move · Shift: straight line · Arrows: 0.1 mm · Shift+arrows: 1 mm · Ctrl+Z: undo
        </span>
      </div>
      <div className="max-h-[calc(100vh-340px)] min-h-64 overflow-auto rounded-[14px] border border-border/60 bg-muted/40 p-4">
        <svg
          ref={svg}
          tabIndex={0}
          role="group"
          aria-label="Number and fixed text editor"
          viewBox={`0 0 ${Math.max(1, width)} ${Math.max(1, height)}`}
          className="block touch-none select-none bg-white shadow-sm outline-none focus:ring-2 focus:ring-primary"
          style={{
            width: `${zoom * 100}%`,
            maxWidth: 'none',
            aspectRatio: `${Math.max(1, width)}/${Math.max(1, height)}`
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d || e.pointerId !== d.pointer) return
            const dx = ((e.clientX - d.x) * width) / d.width,
              dy = ((e.clientY - d.y) * height) / d.height
            onChange(
              d.before.map((p) =>
                p.id === d.id ? moveNumberPosition(p, dx, dy, width, height, e.shiftKey, snap) : p
              )
            )
          }}
          onPointerUp={() => endDrag(false)}
          onPointerCancel={() => endDrag(true)}
          onLostPointerCapture={() => endDrag(true)}
          onKeyDown={(e) => {
            if (disabled) return
            if (e.key === 'Escape') {
              e.preventDefault()
              endDrag(true)
              return
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
              e.preventDefault()
              if (drag.current) return
              const source = e.shiftKey ? future : history,
                destination = e.shiftKey ? history : future
              const previous = source.current.pop()
              if (previous) {
                destination.current.push(project.positions)
                onChange(previous)
              }
              return
            }
            if (
              !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) ||
              !selected ||
              drag.current
            )
              return
            e.preventDefault()
            const step = e.shiftKey ? 1 : 0.1
            checkpoint(project.positions)
            onChange(
              project.positions.map((p) =>
                p.id === selected
                  ? moveNumberPosition(
                      p,
                      e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0,
                      e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0,
                      width,
                      height,
                      false,
                      false
                    )
                  : p
              )
            )
          }}
        >
          {project.front && (
            <image
              href={project.front.previewDataUrl}
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid meet"
              pointerEvents="none"
            />
          )}
          {project.positions.map((p, i) => (
            <text
              key={p.id}
              x={p.xMm}
              y={p.yMm + ((p.fontSizePt * 25.4) / 72) * 0.718}
              textAnchor={p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start'}
              fontFamily="Helvetica, Arial, sans-serif"
              fontSize={(p.fontSizePt * 25.4) / 72}
              fill={p.color}
              pointerEvents="bounding-box"
              aria-label={`${p.kind === 'text' ? 'Fixed text' : 'Number'} ${i + 1}`}
              style={{
                cursor: disabled ? 'default' : 'move',
                ...(p.id === selected
                  ? { paintOrder: 'stroke', stroke: '#93c5fd', strokeWidth: 0.25 }
                  : {})
              }}
              onPointerDown={(e) => {
                if (disabled || e.button !== 0) return
                e.preventDefault()
                e.stopPropagation()
                onSelect(p.id)
                svg.current?.focus()
                const box = svg.current!.getBoundingClientRect()
                drag.current = {
                  id: p.id,
                  pointer: e.pointerId,
                  x: e.clientX,
                  y: e.clientY,
                  before: project.positions,
                  width: box.width,
                  height: box.height
                }
                svg.current!.setPointerCapture(e.pointerId)
              }}
            >
              {positionLabel(p, formatSequenceNumber(project.settings, 0)) || 'Fixed text'}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
