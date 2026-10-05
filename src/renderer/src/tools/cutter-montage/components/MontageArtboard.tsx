import { useLanguage } from '@/i18n/useLanguage'
import { Copy, LockKeyhole, Maximize2, Minimize2, RotateCw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PreviewZoomControls } from '@/components/ui/preview-zoom-controls'
import { usePerformanceSettings } from '@/performance/usePerformanceSettings'
import type {
  AlignmentCommand,
  CutterLayerVisibility,
  CutterSheetSettings,
  PiecePreset,
  PlacedPiece
} from '../types'
import { getSafeArea } from '../lib/cutterLayout'
import { formatCm } from '../lib/cutterUnits'
import { CUTTER_PIECE_MAX_DIMENSION_CM, CUTTER_PIECE_MIN_DIMENSION_CM } from '../lib/piecePresets'
import { getRegistrationMarksSvgMarkup } from '../lib/registrationMarks'
import { ArtboardResizeHandle } from './ArtboardResizeHandle'
import { PlacedPieceItem } from './PlacedPieceItem'
import { useCanvasFullscreen } from '../hooks/useCanvasFullscreen'
import { getSheetDesignCounts } from '../lib/orderLayout'
import { LiveNumberInput } from './LiveNumberInput'

interface MontageArtboardProps {
  settings: CutterSheetSettings
  pieces: PiecePreset[]
  placedPieces: PlacedPiece[]
  totalPlacedCount?: number
  selectedPieceIds: string[]
  layers: CutterLayerVisibility
  onHeightChange: (heightCm: number) => void
  allowHeightResize?: boolean
  cleanArtworkPreview?: boolean
  sheetNumber?: number
  sheetCount?: number
  repeatCount?: number
  physicalSheetNumbers?: number[]
  active?: boolean
  stackedView?: boolean
  onActivate?: () => void
  onSelectPiece: (pieceId: string, additive: boolean) => void
  onMovePiece: (pieceId: string, xCm: number, yCm: number) => void
  onResizePiece: (pieceId: string, widthCm: number, heightCm: number) => void
  onDuplicatePieces: (pieceIds: string[]) => void
  onDeletePieces: (pieceIds: string[]) => void
  onRotatePiece: (pieceId: string) => void
  onToggleLock: (pieceId: string) => void
  onNudgeSelected: (dxCm: number, dyCm: number) => void
  outOfBoundsPieceIds?: string[]
  overlapPieceIds?: string[]
  onAlignSelected: (command: AlignmentCommand) => void
}

export function MontageArtboard({
  settings,
  pieces,
  placedPieces,
  totalPlacedCount = placedPieces.length,
  selectedPieceIds,
  layers,
  onHeightChange,
  allowHeightResize = true,
  cleanArtworkPreview = false,
  sheetNumber,
  sheetCount,
  repeatCount = 1,
  physicalSheetNumbers = [],
  active = true,
  stackedView = false,
  onActivate,
  onSelectPiece,
  onMovePiece,
  onResizePiece,
  onDuplicatePieces,
  onDeletePieces,
  onRotatePiece,
  onToggleLock,
  onNudgeSelected,
  outOfBoundsPieceIds = [],
  overlapPieceIds = [],
  onAlignSelected
}: MontageArtboardProps): JSX.Element {
  const { t } = useLanguage()

  const { preset: performancePreset } = usePerformanceSettings()
  const fullscreen = useCanvasFullscreen<HTMLElement>()
  const [manualScale, setManualScale] = useState<number | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 640, height: 480 })
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const updateSize = (): void => {
      setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])
  const pieceMap = useMemo(() => new Map(pieces.map((piece) => [piece.id, piece])), [pieces])
  const designCounts = useMemo(
    () => getSheetDesignCounts(pieces, placedPieces),
    [pieces, placedPieces]
  )
  const selectedPieces = placedPieces.filter((piece) => selectedPieceIds.includes(piece.id))
  const safeArea = getSafeArea(settings)
  const registrationMarksSvgMarkup = getRegistrationMarksSvgMarkup({
    sheet: settings,
    sources: [],
    pieces,
    placedPieces,
    layers,
    exportSettings: {
      strokeName: 'CutContour',
      includeArtwork: true,
      includeCutlines: true,
      includeRegistrationMarks: true
    }
  })
  const fitScale = Math.max(
    0.1,
    Math.min(
      (viewportSize.width - 48) / Math.max(settings.widthCm, 0.1),
      (viewportSize.height - 48) / Math.max(settings.heightCm, 0.1)
    )
  )
  const scale = manualScale ?? fitScale
  const widthPx = settings.widthCm * scale
  const heightPx = settings.heightCm * scale
  const showMiniMap = !cleanArtworkPreview && heightPx > viewportSize.height * 1.35

  return (
    <section
      ref={fullscreen.containerRef}
      className={`flex h-full min-h-0 min-w-0 flex-col rounded-[var(--ui-radius-lg)] border ${fullscreen.isExpanded ? 'bg-card p-3' : 'bg-muted/30 p-2'} ${
        active ? 'border-primary/20' : ''
      }`}
      data-production-sheet-index={sheetNumber === undefined ? undefined : sheetNumber - 1}
      data-production-sheet-active={active ? 'true' : 'false'}
      onPointerDownCapture={onActivate}
    >
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1">
            <h3 className="text-sm font-semibold">
              {sheetNumber === undefined
                ? t('Montage Sheet')
                : `Production Layout ${sheetNumber} of ${sheetCount ?? sheetNumber}`}
            </h3>
            {repeatCount > 1 && (
              <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                {t('Print')} {repeatCount} copies of this sheet
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCm(settings.widthCm)} × {formatCm(settings.heightCm)}
            {repeatCount > 1
              ? ` · Physical sheets ${formatSheetNumberList(physicalSheetNumbers)}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <div className="px-1 text-xs text-muted-foreground">
            {repeatCount > 1
              ? `This layout: ${placedPieces.length} × ${repeatCount} = ${placedPieces.length * repeatCount}`
              : `This sheet: ${placedPieces.length}`}{' '}
            · Job total: {totalPlacedCount}
          </div>
          <details className="relative text-xs">
            <summary className="cursor-pointer rounded border bg-card px-2 py-1">
              {t('Stickers per sheet')}
            </summary>
            <div className="absolute right-0 top-full z-50 mt-1 max-h-48 min-w-64 overflow-auto rounded border bg-card p-3 shadow-md">
              <table className="w-full text-left" aria-label="Sticker counts for this sheet">
                <thead>
                  <tr>
                    <th scope="col" className="pr-3">
                      {t('Sticker')}
                    </th>
                    <th scope="col" className="text-right">
                      {t('Per sheet')}
                    </th>
                    {repeatCount > 1 && (
                      <th scope="col" className="pl-3 text-right">
                        {t('All')} {repeatCount} sheets
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {designCounts.map((design) => (
                    <tr key={design.id}>
                      <th scope="row" className="max-w-48 break-words pr-3 font-normal">
                        {design.displayName}
                      </th>
                      <td className="text-right tabular-nums">{design.count}</td>
                      {repeatCount > 1 && (
                        <td className="pl-3 text-right tabular-nums">
                          {design.count * repeatCount}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {(!stackedView || active) && (
            <>
              <Button
                ref={fullscreen.buttonRef}
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={fullscreen.isExpanded}
                onClick={() => void fullscreen.toggleExpanded()}
                title={
                  fullscreen.isExpanded
                    ? 'Restore workspace (Esc)'
                    : 'Use the screen for the canvas'
                }
              >
                {fullscreen.isExpanded ? <Minimize2 /> : <Maximize2 />}
                {fullscreen.isExpanded ? t('Restore workspace') : t('Expand canvas')}
              </Button>
              <PreviewZoomControls
                zoom={scale / 10}
                zoomOutDisabled={scale <= 0.1}
                zoomInDisabled={scale >= 18}
                onFit={() => setManualScale(null)}
                onActualSize={() => setManualScale(10)}
                onZoomOut={() =>
                  setManualScale((current) => clamp((current ?? fitScale) * 0.85, 0.1, 18))
                }
                onZoomIn={() =>
                  setManualScale((current) => clamp((current ?? fitScale) * 1.18, 0.1, 18))
                }
              />
              {selectedPieces.length === 1 && (
                <details className="relative">
                  <summary className="flex h-8 cursor-pointer items-center rounded-md border bg-card px-2 text-xs">
                    {t('Size')}
                  </summary>
                  <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border bg-card p-3 shadow-md">
                    <p className="mb-2 text-xs text-muted-foreground">Selected copy · cm</p>
                    <div className="flex items-center gap-2">
                      <SmallNumber
                        label="W"
                        value={selectedPieces[0].widthCm}
                        min={CUTTER_PIECE_MIN_DIMENSION_CM}
                        max={CUTTER_PIECE_MAX_DIMENSION_CM}
                        disabled={selectedPieces[0].locked}
                        onChange={(widthCm) => {
                          const normalizedValue = clamp(
                            widthCm,
                            CUTTER_PIECE_MIN_DIMENSION_CM,
                            CUTTER_PIECE_MAX_DIMENSION_CM
                          )
                          onResizePiece(
                            selectedPieces[0].id,
                            normalizedValue,
                            selectedPieces[0].heightCm
                          )
                          return normalizedValue
                        }}
                      />
                      <SmallNumber
                        label="H"
                        value={selectedPieces[0].heightCm}
                        min={CUTTER_PIECE_MIN_DIMENSION_CM}
                        max={CUTTER_PIECE_MAX_DIMENSION_CM}
                        disabled={selectedPieces[0].locked}
                        onChange={(heightCm) => {
                          const normalizedValue = clamp(
                            heightCm,
                            CUTTER_PIECE_MIN_DIMENSION_CM,
                            CUTTER_PIECE_MAX_DIMENSION_CM
                          )
                          onResizePiece(
                            selectedPieces[0].id,
                            selectedPieces[0].widthCm,
                            normalizedValue
                          )
                          return normalizedValue
                        }}
                      />
                    </div>
                    {selectedPieces[0].locked ? (
                      <p className="mt-1 text-[11px] text-amber-700">
                        Unlock this copy to resize it.
                      </p>
                    ) : null}
                  </div>
                </details>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={selectedPieceIds.length === 0}
                onClick={() => onDuplicatePieces(selectedPieceIds)}
                className="size-8 p-0"
                aria-label={t('Duplicate')}
                title={t('Duplicate')}
              >
                <Copy />
              </Button>
              {selectedPieceIds.length > 1 && (
                <details className="relative">
                  <summary className="flex h-8 cursor-pointer items-center rounded-md border bg-card px-2 text-xs">
                    {t('Align')}
                  </summary>
                  <div className="absolute right-0 top-full z-50 mt-1 grid w-48 grid-cols-2 gap-1 rounded-md border bg-card p-2 shadow-md">
                    {(
                      [
                        ['left', 'Left'],
                        ['center-horizontal', 'H center'],
                        ['right', 'Right'],
                        ['top', 'Top'],
                        ['center-vertical', 'V center'],
                        ['bottom', 'Bottom'],
                        ['distribute-horizontal', 'Spread H'],
                        ['distribute-vertical', 'Spread V']
                      ] as Array<[AlignmentCommand, string]>
                    ).map(([command, label]) => (
                      <Button
                        key={command}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => onAlignSelected(command)}
                      >
                        {t(label)}
                      </Button>
                    ))}
                  </div>
                </details>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={selectedPieceIds.length !== 1}
                onClick={() => selectedPieceIds[0] && onRotatePiece(selectedPieceIds[0])}
                className="size-8 p-0"
                aria-label={t('Rotate')}
                title={t('Rotate')}
              >
                <RotateCw />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={selectedPieceIds.length !== 1}
                onClick={() => selectedPieceIds[0] && onToggleLock(selectedPieceIds[0])}
                className="size-8 p-0"
                aria-label={selectedPieces[0]?.locked ? t('Unlock') : t('Lock')}
                title={selectedPieces[0]?.locked ? t('Unlock') : t('Lock')}
              >
                <LockKeyhole />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={selectedPieceIds.length === 0}
                onClick={() => onDeletePieces(selectedPieceIds)}
                className="size-8 p-0"
                aria-label={t('Delete')}
                title={t('Delete')}
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </div>

      {fullscreen.error && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {fullscreen.error}
        </p>
      )}
      <div
        ref={viewportRef}
        dir="ltr"
        className="relative min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/70 p-6"
      >
        <div
          className="relative mx-auto shrink-0 bg-white shadow-panel outline-none"
          data-production-sheet-canvas="true"
          tabIndex={0}
          style={{
            width: widthPx,
            height: heightPx,
            backgroundImage:
              !cleanArtworkPreview && settings.showGrid
                ? 'linear-gradient(0deg,rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)'
                : undefined,
            backgroundSize: `${settings.gridStepCm * scale}px ${settings.gridStepCm * scale}px`
          }}
          onKeyDown={(event) => {
            if (selectedPieceIds.length === 0) {
              return
            }

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
              event.preventDefault()
              onDuplicatePieces(selectedPieceIds)
              return
            }

            const step = event.shiftKey ? 1 : settings.snapToGrid ? settings.gridStepCm : 0.1

            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              onNudgeSelected(-step, 0)
            } else if (event.key === 'ArrowRight') {
              event.preventDefault()
              onNudgeSelected(step, 0)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              onNudgeSelected(0, -step)
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              onNudgeSelected(0, step)
            } else if (event.key === 'Delete' || event.key === 'Backspace') {
              event.preventDefault()
              onDeletePieces(selectedPieceIds)
            }
          }}
        >
          {!cleanArtworkPreview && settings.showSafeArea !== false && (
            <>
              <div
                className="pointer-events-none absolute left-0 top-0 bg-amber-100/25"
                style={{ width: widthPx, height: safeArea.yCm * scale }}
              />
              <div
                className="pointer-events-none absolute bottom-0 left-0 bg-amber-100/25"
                style={{ width: widthPx, height: safeArea.yCm * scale }}
              />
              <div
                className="pointer-events-none absolute bg-amber-100/25"
                style={{
                  left: 0,
                  top: safeArea.yCm * scale,
                  width: safeArea.xCm * scale,
                  height: safeArea.heightCm * scale
                }}
              />
              <div
                className="pointer-events-none absolute bg-amber-100/25"
                style={{
                  right: 0,
                  top: safeArea.yCm * scale,
                  width: safeArea.xCm * scale,
                  height: safeArea.heightCm * scale
                }}
              />
              <div
                className="pointer-events-none absolute border border-dashed border-emerald-500/70 bg-emerald-50/20"
                style={{
                  left: safeArea.xCm * scale,
                  top: safeArea.yCm * scale,
                  width: safeArea.widthCm * scale,
                  height: safeArea.heightCm * scale
                }}
              />
            </>
          )}
          {!cleanArtworkPreview && settings.showRollGuides !== false && (
            <>
              <div
                className="pointer-events-none absolute bottom-0 top-0 border-l border-dotted border-slate-400"
                style={{ left: Math.max((settings.rollWidthCm - settings.widthCm) / 2, 0) * scale }}
              />
              <div className="pointer-events-none absolute left-2 top-2 rounded bg-white/85 px-2 py-1 text-[11px] text-slate-700 shadow-sm">
                {t('Roll')} {formatCm(settings.rollWidthCm)}
              </div>
            </>
          )}
          {registrationMarksSvgMarkup && (
            <svg
              className="pointer-events-none absolute inset-0 overflow-visible"
              width={widthPx}
              height={heightPx}
              viewBox={`0 0 ${settings.widthCm * 10} ${settings.heightCm * 10}`}
              aria-label="Automatic Mimaki Type 1 registration marks"
              data-mimaki-registration-preview="true"
              dangerouslySetInnerHTML={{ __html: registrationMarksSvgMarkup }}
            />
          )}
          {placedPieces.map((placed) => {
            const piece = pieceMap.get(placed.presetId)

            return piece ? (
              <PlacedPieceItem
                key={placed.id}
                piece={piece}
                placed={placed}
                scale={scale}
                selected={selectedPieceIds.includes(placed.id)}
                warning={
                  outOfBoundsPieceIds.includes(placed.id)
                    ? 'out-of-bounds'
                    : overlapPieceIds.includes(placed.id)
                      ? 'overlap'
                      : undefined
                }
                layers={layers}
                cleanArtworkPreview={cleanArtworkPreview}
                sheetWidthCm={settings.widthCm}
                sheetHeightCm={settings.heightCm}
                snapStepCm={settings.snapToGrid ? settings.gridStepCm : 0.1}
                simplifiedPreview={performancePreset === 'low-end'}
                onSelect={onSelectPiece}
                onMove={(pieceId, xCm, yCm) => {
                  const dragged = placedPieces.find((candidate) => candidate.id === pieceId)

                  if (
                    !dragged ||
                    !selectedPieceIds.includes(pieceId) ||
                    selectedPieceIds.length < 2
                  ) {
                    onMovePiece(pieceId, xCm, yCm)
                    return
                  }

                  const deltaX = xCm - dragged.xCm
                  const deltaY = yCm - dragged.yCm

                  for (const selected of selectedPieces) {
                    if (!selected.locked) {
                      onMovePiece(
                        selected.id,
                        clamp(
                          selected.xCm + deltaX,
                          0,
                          Math.max(settings.widthCm - selected.widthCm, 0)
                        ),
                        clamp(
                          selected.yCm + deltaY,
                          0,
                          Math.max(settings.heightCm - selected.heightCm, 0)
                        )
                      )
                    }
                  }
                }}
                onDuplicate={(pieceId) => onDuplicatePieces([pieceId])}
                onDelete={(pieceId) => onDeletePieces([pieceId])}
                onRotate={onRotatePiece}
                onToggleLock={onToggleLock}
              />
            ) : null
          })}
          {placedPieces.length === 0 && (
            <div className="absolute inset-0 grid place-items-center p-8 text-center text-sm text-muted-foreground">
              {t('Add prepared pieces from the library, then auto arrange or drag them manually.')}
            </div>
          )}
          {allowHeightResize ? (
            <ArtboardResizeHandle
              settings={settings}
              scale={scale}
              onHeightChange={onHeightChange}
            />
          ) : null}
        </div>
        {showMiniMap && (
          <div className="sticky bottom-3 ml-auto mt-3 w-28 rounded-md border bg-card/95 p-2 shadow-sm">
            <div
              className="relative mx-auto bg-white"
              style={{
                width: 72,
                height: Math.max(96, Math.min(180, (settings.heightCm / settings.widthCm) * 72))
              }}
            >
              {placedPieces.map((piece) => (
                <span
                  key={piece.id}
                  className="absolute rounded-sm bg-primary/55"
                  style={{
                    left: `${(piece.xCm / settings.widthCm) * 100}%`,
                    top: `${(piece.yCm / settings.heightCm) * 100}%`,
                    width: `${(piece.widthCm / settings.widthCm) * 100}%`,
                    height: `${(piece.heightCm / settings.heightCm) * 100}%`
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function SmallNumber({
  label,
  value,
  min,
  max,
  disabled = false,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onChange: (value: number) => number
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      {t(label)}
      <LiveNumberInput
        className="h-8 w-16 rounded border bg-background px-2 text-sm text-foreground"
        value={value}
        min={min}
        max={max}
        step={0.1}
        precision={2}
        disabled={disabled}
        onValueChange={onChange}
      />
    </label>
  )
}
function formatSheetNumberList(sheetNumbers: number[]): string {
  if (sheetNumbers.length === 0) return '—'

  const first = sheetNumbers[0]
  const last = sheetNumbers[sheetNumbers.length - 1]
  const consecutive = sheetNumbers.every((sheetNumber, index) => sheetNumber === first + index)

  return consecutive && first !== last ? `${first}–${last}` : sheetNumbers.join(', ')
}
