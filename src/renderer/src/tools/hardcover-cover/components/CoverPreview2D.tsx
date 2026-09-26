import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent
} from 'react'
import type {
  CoverZone,
  HardcoverPdfCoverTarget,
  HardcoverPdfPagePosition,
  HardcoverProjectState
} from '../types'
import { buildHardcoverSvg } from '../lib/hardcoverExportSvg'
import { WrapMarginOverlay } from './WrapMarginOverlay'
import { calculateCoverDimensions } from '../lib/coverCalculations'
import { dragPdfPagePosition, normalizePdfPagePosition } from '../lib/pdfPosition'

export const CoverPreview2D = memo(function CoverPreview2D({
  state,
  onSourcePdfPositionChange
}: {
  state: HardcoverProjectState
  onSourcePdfPositionChange?: (
    position: HardcoverPdfPagePosition,
    target?: HardcoverPdfCoverTarget
  ) => void
}): JSX.Element {
  const svgIdPrefix = `cover-preview-${useId()}`
  const previewState = useMemo<HardcoverProjectState>(
    () => ({
      ...state,
      exportSettings: {
        ...state.exportSettings,
        mode:
          state.viewMode === 'layout'
            ? 'production-guide'
            : state.viewMode === 'print'
              ? state.exportSettings.mode
              : 'print-final',
        includeFoldLines:
          state.viewMode === 'layout' ? state.showGuides : state.exportSettings.includeFoldLines,
        includeSafeZones:
          state.viewMode === 'layout' ? state.showSafeZones : state.exportSettings.includeSafeZones
      }
    }),
    [state]
  )
  const svg = useMemo(
    () => buildHardcoverSvg(previewState, { idPrefix: svgIdPrefix }),
    [previewState, svgIdPrefix]
  )
  const dimensions = useMemo(() => calculateCoverDimensions(state.setup), [state.setup])
  return (
    <div
      className="relative origin-top overflow-hidden rounded shadow-lg transition-transform"
      style={{ transform: `scale(${state.zoom})`, width: '100%' }}
    >
      <div
        className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {state.sourcePdf && onSourcePdfPositionChange ? (
        <SourcePageDragLayer
          state={state}
          dimensions={dimensions}
          onPositionChange={onSourcePdfPositionChange}
        />
      ) : null}
      {state.viewMode === 'layout' && (
        <WrapMarginOverlay setup={state.setup} dimensions={dimensions} />
      )}
    </div>
  )
})

interface DragState {
  target: HardcoverPdfCoverTarget
  pointerId: number
  startClientX: number
  startClientY: number
  startPosition: HardcoverPdfPagePosition
  zoneWidthPx: number
  zoneHeightPx: number
}

function SourcePageDragLayer({
  state,
  dimensions,
  onPositionChange
}: {
  state: HardcoverProjectState
  dimensions: ReturnType<typeof calculateCoverDimensions>
  onPositionChange: (position: HardcoverPdfPagePosition, target?: HardcoverPdfCoverTarget) => void
}): JSX.Element {
  const dragRef = useRef<DragState | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [activeTarget, setActiveTarget] = useState<HardcoverPdfCoverTarget | null>(null)
  const separate =
    state.sourcePdf?.sourceMode === 'separate' ||
    Boolean(state.sourcePdf?.frontSource || state.sourcePdf?.backSource)
  const showFront = separate ? Boolean(state.sourcePdf?.frontSource) : Boolean(state.sourcePdf)
  const showBack = Boolean(
    state.sourcePdf?.backCoverEnabled &&
    (separate ? state.sourcePdf.backSource : state.sourcePdf.backPageNumber)
  )

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    },
    []
  )

  const startDrag = (
    event: PointerEvent<HTMLDivElement>,
    target: HardcoverPdfCoverTarget
  ): void => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      target,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: getSourcePosition(state, target),
      zoneWidthPx: bounds.width,
      zoneHeightPx: bounds.height
    }
    setActiveTarget(target)
  }

  const moveDrag = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    event.preventDefault()
    const nextPosition = dragPdfPagePosition(
      drag.startPosition,
      event.clientX - drag.startClientX,
      event.clientY - drag.startClientY,
      drag.zoneWidthPx,
      drag.zoneHeightPx
    )

    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = requestAnimationFrame(() => {
      onPositionChange(nextPosition, drag.target)
      animationFrameRef.current = null
    })
  }

  const finishDrag = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
    setActiveTarget(null)
  }

  const renderDragZone = (target: HardcoverPdfCoverTarget, zone: CoverZone): JSX.Element => (
    <div
      key={target}
      className={`group pointer-events-auto absolute z-20 touch-none select-none border-2 transition-colors ${
        activeTarget === target
          ? 'cursor-grabbing border-primary bg-primary/10'
          : 'cursor-grab border-transparent hover:border-primary/70 hover:bg-primary/5'
      }`}
      style={zoneStyle(zone, dimensions.fullWidthMm, dimensions.fullHeightMm)}
      role="application"
      aria-label={`Drag ${target} cover artwork to reposition it`}
      title={`Drag ${target} cover artwork`}
      onPointerDown={(event) => startDrag(event, target)}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <span
        className={`pointer-events-none absolute left-2 top-2 rounded-md bg-slate-950/80 px-2 py-1 text-[10px] font-semibold capitalize text-white transition-opacity ${
          activeTarget === target ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        Drag {target}
      </span>
    </div>
  )

  return (
    <div className="pointer-events-none absolute inset-0">
      {showFront ? renderDragZone('front', dimensions.front) : null}
      {showBack ? renderDragZone('back', dimensions.back) : null}
    </div>
  )
}

function getSourcePosition(
  state: HardcoverProjectState,
  target: HardcoverPdfCoverTarget
): HardcoverPdfPagePosition {
  const source = state.sourcePdf
  if (!source) return normalizePdfPagePosition(undefined)
  const separate =
    source.sourceMode === 'separate' || Boolean(source.frontSource || source.backSource)
  if (separate) {
    return normalizePdfPagePosition(
      target === 'front' ? source.frontSource?.position : source.backSource?.position
    )
  }
  return normalizePdfPagePosition(target === 'front' ? source.frontPosition : source.backPosition)
}

function zoneStyle(zone: CoverZone, fullWidthMm: number, fullHeightMm: number): CSSProperties {
  return {
    left: `${(zone.xMm / fullWidthMm) * 100}%`,
    top: `${(zone.yMm / fullHeightMm) * 100}%`,
    width: `${(zone.widthMm / fullWidthMm) * 100}%`,
    height: `${(zone.heightMm / fullHeightMm) * 100}%`
  }
}
