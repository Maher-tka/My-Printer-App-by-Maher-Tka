import { Copy, LockKeyhole, RotateCw, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import type { CutterLayerVisibility, CutterSheetSettings, PiecePreset, PlacedPiece } from '../types'
import { getSafeArea } from '../lib/cutterLayout'
import { formatCm } from '../lib/cutterUnits'
import { ArtboardResizeHandle } from './ArtboardResizeHandle'
import { PlacedPieceItem } from './PlacedPieceItem'

interface MontageArtboardProps {
  settings: CutterSheetSettings
  pieces: PiecePreset[]
  placedPieces: PlacedPiece[]
  selectedPieceIds: string[]
  layers: CutterLayerVisibility
  onHeightChange: (heightCm: number) => void
  onSelectPiece: (pieceId: string, additive: boolean) => void
  onMovePiece: (pieceId: string, xCm: number, yCm: number) => void
  onResizePiece: (pieceId: string, widthCm: number, heightCm: number) => void
  onDuplicatePieces: (pieceIds: string[]) => void
  onDeletePieces: (pieceIds: string[]) => void
  onRotatePiece: (pieceId: string) => void
  onToggleLock: (pieceId: string) => void
  onNudgeSelected: (dxCm: number, dyCm: number) => void
}

export function MontageArtboard({
  settings,
  pieces,
  placedPieces,
  selectedPieceIds,
  layers,
  onHeightChange,
  onSelectPiece,
  onMovePiece,
  onResizePiece,
  onDuplicatePieces,
  onDeletePieces,
  onRotatePiece,
  onToggleLock,
  onNudgeSelected
}: MontageArtboardProps): JSX.Element {
  const pieceMap = useMemo(() => new Map(pieces.map((piece) => [piece.id, piece])), [pieces])
  const selectedPieces = placedPieces.filter((piece) => selectedPieceIds.includes(piece.id))
  const safeArea = getSafeArea(settings)
  const scale = getArtboardScale(settings.widthCm)
  const widthPx = settings.widthCm * scale
  const heightPx = settings.heightCm * scale

  return (
    <section className="rounded-lg border bg-slate-100 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Montage Sheet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCm(settings.widthCm)} x {formatCm(settings.heightCm)}. Drag pieces, use arrow
            keys for small moves, or pull the bottom edge to resize height.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
            Placed pieces: {placedPieces.length}
          </div>
          {selectedPieces.length === 1 && (
            <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1">
              <SmallNumber
                label="W"
                value={selectedPieces[0].widthCm}
                onChange={(widthCm) =>
                  onResizePiece(
                    selectedPieces[0].id,
                    Math.max(widthCm, 0.5),
                    selectedPieces[0].heightCm
                  )
                }
              />
              <SmallNumber
                label="H"
                value={selectedPieces[0].heightCm}
                onChange={(heightCm) =>
                  onResizePiece(
                    selectedPieces[0].id,
                    selectedPieces[0].widthCm,
                    Math.max(heightCm, 0.5)
                  )
                }
              />
            </div>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedPieceIds.length === 0}
            onClick={() => onDuplicatePieces(selectedPieceIds)}
          >
            <Copy data-icon="inline-start" />
            Duplicate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedPieceIds.length !== 1}
            onClick={() => selectedPieceIds[0] && onRotatePiece(selectedPieceIds[0])}
          >
            <RotateCw data-icon="inline-start" />
            Rotate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedPieceIds.length !== 1}
            onClick={() => selectedPieceIds[0] && onToggleLock(selectedPieceIds[0])}
          >
            <LockKeyhole data-icon="inline-start" />
            {selectedPieces[0]?.locked ? 'Unlock' : 'Lock'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={selectedPieceIds.length === 0}
            onClick={() => onDeletePieces(selectedPieceIds)}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>

      <div className="flex justify-center">
        <div
          className="relative bg-white shadow-md outline-none"
          tabIndex={0}
          style={{
            width: widthPx,
            height: heightPx,
            backgroundImage: settings.showGrid
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
          <div
            className="pointer-events-none absolute border border-dashed border-emerald-500/70 bg-emerald-50/20"
            style={{
              left: safeArea.xCm * scale,
              top: safeArea.yCm * scale,
              width: safeArea.widthCm * scale,
              height: safeArea.heightCm * scale
            }}
          />
          {placedPieces.map((placed) => {
            const piece = pieceMap.get(placed.presetId)

            return piece ? (
              <PlacedPieceItem
                key={placed.id}
                piece={piece}
                placed={placed}
                scale={scale}
                selected={selectedPieceIds.includes(placed.id)}
                layers={layers}
                sheetWidthCm={settings.widthCm}
                sheetHeightCm={settings.heightCm}
                snapStepCm={settings.snapToGrid ? settings.gridStepCm : 0.1}
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
              Add prepared pieces from the library, then auto arrange or drag them manually.
            </div>
          )}
          <ArtboardResizeHandle settings={settings} scale={scale} onHeightChange={onHeightChange} />
        </div>
      </div>
    </section>
  )
}

function getArtboardScale(widthCm: number): number {
  return Math.max(5.5, Math.min(8.5, 820 / widthCm))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function SmallNumber({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      {label}
      <input
        className="h-8 w-16 rounded border bg-background px-2 text-sm text-foreground"
        type="number"
        min={0.5}
        step={0.1}
        value={Number(value.toFixed(2))}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
