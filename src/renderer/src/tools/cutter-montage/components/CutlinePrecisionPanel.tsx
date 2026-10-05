import { useLanguage } from '@/i18n/useLanguage'
import { useId, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ArtworkTransform, EditorObject, PiecePreset } from '../types'
import { getArtworkObject, getCutlineObject, getMaskObject } from '../lib/pieceModelSync'
import {
  getCutlineOffsetMm,
  getCutlinePreviewTransform,
  matchCutlineToMask,
  nudgeCutline,
  setCutlineOffset
} from '../lib/cutlineAdjustment'
import { getNormalizedShapePath } from '../lib/shapeGeometry'
import { LiveNumberInput } from './LiveNumberInput'

export function CutlinePrecisionPanel({
  piece,
  onPieceChange
}: {
  piece: PiecePreset
  onPieceChange: (piece: PiecePreset) => void
}): JSX.Element | null {
  const { t } = useLanguage()

  const [stepMm, setStepMm] = useState(0.05)
  const cutlines = piece.objects.filter((object) => object.role === 'cutline')
  const cutline =
    cutlines.find((object) => piece.selectedObjectIds.includes(object.id)) ??
    getCutlineObject(piece)
  if (!cutline) return null
  const offset = getCutlineOffsetMm(cutline, piece)
  const minOffset =
    Math.ceil((0.02 - Math.min(cutline.transform.widthCm, cutline.transform.heightCm)) * 500) / 100
  const adjust = (value: number): boolean => {
    const next = setCutlineOffset(piece, cutline.id, value)
    if (next === piece) return false
    onPieceChange(next)
    return true
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-3" aria-label="Cut contour precision">
      <h4 className="text-sm font-semibold">{t('Cut edge precision')}</h4>
      {cutlines.length > 1 && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('Contour to adjust')}
          <select
            className="h-8 rounded border bg-background px-2 text-foreground"
            value={cutline.id}
            onChange={(event) =>
              onPieceChange({ ...piece, selectedObjectIds: [event.target.value] })
            }
          >
            {cutlines.map((object, index) => (
              <option key={object.id} value={object.id}>
                {index + 1}. {object.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <CutEdgePreview key={`${piece.id}-${cutline.id}`} piece={piece} cutline={cutline} />
      {cutline.locked && (
        <p className="text-xs text-muted-foreground">
          {t('Unlock this contour in Layers to adjust it.')}
        </p>
      )}
      <fieldset disabled={cutline.locked} className="space-y-3 disabled:opacity-50">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('Cut adjustment mm')}
          <LiveNumberInput
            key={`${piece.id}-${cutline.id}`}
            aria-label={t('Cut adjustment mm')}
            className="h-9 rounded border bg-background px-2 text-sm text-foreground"
            value={offset}
            min={minOffset}
            step={stepMm}
            precision={3}
            onValueChange={adjust}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          {offset > 0
            ? `${Number(offset.toFixed(3))} mm outward on each side adds a border.`
            : offset < 0
              ? `${Number(Math.abs(offset).toFixed(3))} mm inward on each side trims inside the edge.`
              : 'Zero adds no extra border to this contour.'}
          {cutline.shapeType === 'path'
            ? ' Custom paths are resized at their bounds; this is not a uniform path offset.'
            : ''}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => adjust(Number((offset - stepMm).toFixed(3)))}
            disabled={offset - stepMm < minOffset}
          >
            {t('Inward −')}
            {stepMm}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => adjust(Number((offset + stepMm).toFixed(3)))}
          >
            {t('Outward +')}
            {stepMm}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => adjust(0)}>
            {t('Zero adjustment')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => adjust(-0.2)}
            disabled={minOffset > -0.2}
          >
            Trim 0.2 mm
          </Button>
        </div>
        {piece.clippingMaskEnabled && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => onPieceChange(matchCutlineToMask(piece, cutline.id))}
          >
            Match mask · no gap
          </Button>
        )}
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {t('Adjustment step')}
          <select
            aria-label="Contour adjustment step"
            className="h-8 rounded border bg-background px-2 text-foreground"
            value={stepMm}
            onChange={(event) => setStepMm(Number(event.target.value))}
          >
            {[0.01, 0.05, 0.1, 0.5].map((step) => (
              <option key={step} value={step}>
                {step} mm
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-4 gap-1" aria-label="Move cut contour only">
          {[
            { label: 'Move contour left', icon: ArrowLeft, dx: -stepMm, dy: 0 },
            { label: 'Move contour up', icon: ArrowUp, dx: 0, dy: -stepMm },
            { label: 'Move contour down', icon: ArrowDown, dx: 0, dy: stepMm },
            { label: 'Move contour right', icon: ArrowRight, dx: stepMm, dy: 0 }
          ].map(({ label, icon: Icon, dx, dy }) => (
            <Button
              key={label}
              size="sm"
              variant="outline"
              aria-label={t(label)}
              title={`${label} by ${stepMm} mm`}
              onClick={() => onPieceChange(nudgeCutline(piece, cutline.id, dx, dy))}
            >
              <Icon className="size-4" />
            </Button>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        Magenta is the cut line. White space inside the image needs a tighter mask in Prepare
        artwork. Use an inward trim or artwork bleed to cover small cutting shifts.
      </p>
      {piece.stickerMakerOffsetMm !== undefined && (
        <p className="text-xs text-muted-foreground">
          The Sticker Maker border is already built into this path. Zero adjustment keeps that
          border; change it in Sticker Maker to retrace the edge.
        </p>
      )}
    </section>
  )
}

function CutEdgePreview({
  piece,
  cutline
}: {
  piece: PiecePreset
  cutline: EditorObject
}): JSX.Element {
  const { t } = useLanguage()

  const [edge, setEdge] = useState('top')
  const id = useId().replace(/:/g, '')
  const mask = piece.clippingMaskEnabled ? getMaskObject(piece) : undefined
  const artwork = getArtworkObject(piece)
  const edgeTransform = (mask ?? cutline).transform
  const cx = edgeTransform.xCm + edgeTransform.widthCm / 2
  const cy = edgeTransform.yCm + edgeTransform.heightCm / 2
  const dx =
    edge === 'left' ? -edgeTransform.widthCm / 2 : edge === 'right' ? edgeTransform.widthCm / 2 : 0
  const dy =
    edge === 'top'
      ? -edgeTransform.heightCm / 2
      : edge === 'bottom'
        ? edgeTransform.heightCm / 2
        : 0
  const angle = (edgeTransform.rotation * Math.PI) / 180
  const x = cx + dx * Math.cos(angle) - dy * Math.sin(angle)
  const y = cy + dx * Math.sin(angle) + dy * Math.cos(angle)
  const cut = getCutlinePreviewTransform(cutline, piece)
  const shapeTransform = (object: EditorObject, transform = object.transform) =>
    `${rotation(transform)} translate(${transform.xCm} ${transform.yCm}) scale(${transform.widthCm} ${transform.heightCm})`
  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
        {t('Edge close-up')}
        <select
          aria-label="Edge close-up location"
          value={edge}
          onChange={(event) => setEdge(event.target.value)}
          className="h-7 rounded border bg-background px-1 text-foreground"
        >
          {['top', 'right', 'bottom', 'left'].map((side) => (
            <option key={side} value={side}>
              {side[0].toUpperCase() + side.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <svg
        aria-label={`${edge} cut edge close-up, 12 by 6 millimetres`}
        className="block aspect-[2/1] w-full rounded border"
        viewBox={`${x - 0.6} ${y - 0.3} 1.2 0.6`}
      >
        <defs>
          <pattern id={`${id}-grid`} width="0.05" height="0.05" patternUnits="userSpaceOnUse">
            <rect width="0.05" height="0.05" fill="white" />
            <path d="M0 0H.025V.025H0Z M.025 .025H.05V.05H.025Z" fill="#e2e8f0" />
          </pattern>
          {mask && (
            <clipPath id={`${id}-mask`}>
              <path
                d={getNormalizedShapePath(mask, mask.transform.widthCm, mask.transform.heightCm)}
                transform={shapeTransform(mask)}
              />
            </clipPath>
          )}
        </defs>
        <rect x={x - 0.6} y={y - 0.3} width="1.2" height="0.6" fill={`url(#${id}-grid)`} />
        {artwork?.visible && (
          <g clipPath={mask ? `url(#${id}-mask)` : undefined}>
            <image
              href={piece.artwork.previewUrl || piece.previewUrl}
              x={artwork.transform.xCm}
              y={artwork.transform.yCm}
              width={artwork.transform.widthCm}
              height={artwork.transform.heightCm}
              transform={rotation(artwork.transform)}
              preserveAspectRatio="none"
            />
          </g>
        )}
        <path
          d={getNormalizedShapePath(cutline, cut.widthCm, cut.heightCm)}
          transform={shapeTransform(cutline, cut)}
          fill="none"
          stroke={cutline.strokeColor ?? '#ff00ff'}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="text-[10px] text-muted-foreground">
        12 × 6 mm · checkerboard shows unprinted area
      </p>
    </div>
  )
}

function rotation(t: ArtworkTransform): string {
  return `rotate(${t.rotation} ${t.xCm + t.widthCm / 2} ${t.yCm + t.heightCm / 2})`
}
