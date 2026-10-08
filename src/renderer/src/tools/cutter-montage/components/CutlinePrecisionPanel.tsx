import { useLanguage } from '@/i18n/useLanguage'
import { useEffect, useId, useRef, useState } from 'react'
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
  onPieceChange,
  layout = 'sidebar'
}: {
  piece: PiecePreset
  onPieceChange: (piece: PiecePreset) => void
  layout?: 'sidebar' | 'workspace'
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
    <section
      className="space-y-4 rounded-[var(--ui-radius-lg)] border bg-card p-4"
      aria-label={t('Cut edge precision')}
    >
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
      <CutEdgePreview
        key={`${piece.id}-${cutline.id}`}
        piece={piece}
        cutline={cutline}
        layout={layout}
      />
      {cutline.locked && (
        <p className="text-xs text-muted-foreground">
          {t('Unlock this contour in Layers to adjust it.')}
        </p>
      )}
      <fieldset disabled={cutline.locked} className="space-y-3 disabled:opacity-50">
        <div className={layout === 'workspace' ? 'grid gap-4 xl:grid-cols-2' : 'space-y-3'}>
          <div className="space-y-3">
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
            <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              {t('Adjustment step')}
              <select
                aria-label={t('Contour adjustment step')}
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
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => adjust(Number((offset - stepMm).toFixed(3)))}
                disabled={offset - stepMm < minOffset}
              >
                {t('Inward −')}
                {stepMm}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => adjust(Number((offset + stepMm).toFixed(3)))}
              >
                {t('Outward +')}
                {stepMm}
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => adjust(0)}>
                {t('Zero adjustment')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => adjust(-0.2)}
                disabled={minOffset > -0.2}
              >
                {t('Trim 0.2 mm')}
              </Button>
            </div>
            {piece.clippingMaskEnabled && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onPieceChange(matchCutlineToMask(piece, cutline.id))}
              >
                {t('Match mask · no gap')}
              </Button>
            )}
            <div
              className="grid grid-cols-4 gap-2"
              dir="ltr"
              aria-label={t('Move cut contour only')}
            >
              {[
                { label: 'Move contour left', icon: ArrowLeft, dx: -stepMm, dy: 0 },
                { label: 'Move contour up', icon: ArrowUp, dx: 0, dy: -stepMm },
                { label: 'Move contour down', icon: ArrowDown, dx: 0, dy: stepMm },
                { label: 'Move contour right', icon: ArrowRight, dx: stepMm, dy: 0 }
              ].map(({ label, icon: Icon, dx, dy }) => (
                <Button
                  type="button"
                  key={label}
                  size="sm"
                  variant="outline"
                  aria-label={t(label)}
                  title={`${t(label)} · ${stepMm} mm`}
                  onClick={() => onPieceChange(nudgeCutline(piece, cutline.id, dx, dy))}
                >
                  <Icon className="size-4" data-physical-direction />
                </Button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {offset > 0
            ? t('{value} mm outward on each side adds a border.').replace(
                '{value}',
                String(Number(offset.toFixed(3)))
              )
            : offset < 0
              ? t('{value} mm inward on each side trims inside the edge.').replace(
                  '{value}',
                  String(Number(Math.abs(offset).toFixed(3)))
                )
              : t('Zero adds no extra border to this contour.')}
          {cutline.shapeType === 'path'
            ? ` ${t('Custom paths are resized at their bounds; this is not a uniform path offset.')}`
            : ''}
        </p>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        {t(
          'Magenta is the cut line. White space inside the image needs a tighter mask in Prepare artwork. Use an inward trim or artwork bleed to cover small cutting shifts.'
        )}
      </p>
      {piece.stickerMakerOffsetMm !== undefined && (
        <p className="text-xs text-muted-foreground">
          {t(
            'The Sticker Maker border is already built into this path. Zero adjustment keeps that border; change it in Sticker Maker to retrace the edge.'
          )}
        </p>
      )}
    </section>
  )
}

function CutEdgePreview({
  piece,
  cutline,
  layout
}: {
  piece: PiecePreset
  cutline: EditorObject
  layout: 'sidebar' | 'workspace'
}): JSX.Element {
  const { t } = useLanguage()

  const [edge, setEdge] = useState('top')
  const [spanMm, setSpanMm] = useState(12)
  const previewRef = useRef<SVGSVGElement>(null)
  const [aspectRatio, setAspectRatio] = useState(2)
  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return
    const observer = new ResizeObserver(() => {
      const { width, height } = preview.getBoundingClientRect()
      if (width > 0 && height > 0) setAspectRatio(width / height)
    })
    observer.observe(preview)
    return () => observer.disconnect()
  }, [])
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
  const spanCm = spanMm / 10
  const heightCm = spanCm / aspectRatio
  const shapeTransform = (object: EditorObject, transform = object.transform) =>
    `${rotation(transform)} translate(${transform.xCm} ${transform.yCm}) scale(${transform.widthCm} ${transform.heightCm})`
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t('Edge close-up')}
          <select
            aria-label={t('Edge close-up location')}
            value={edge}
            onChange={(event) => setEdge(event.target.value)}
            className="h-8 rounded border bg-background px-2 text-foreground"
          >
            {['top', 'right', 'bottom', 'left'].map((side) => (
              <option key={side} value={side}>
                {t(side[0].toUpperCase() + side.slice(1))}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t('Close-up width mm')}
          <select
            aria-label={t('Close-up width mm')}
            className="h-8 rounded border bg-background px-2 text-foreground"
            value={spanMm}
            onChange={(event) => setSpanMm(Number(event.target.value))}
          >
            {[6, 12, 24].map((span) => (
              <option key={span} value={span}>
                {span} mm
              </option>
            ))}
          </select>
        </label>
      </div>
      <svg
        ref={previewRef}
        aria-label={t('Cut edge close-up')}
        className={`block w-full rounded border ${layout === 'workspace' ? 'h-[clamp(160px,24vh,280px)]' : 'aspect-[2/1]'}`}
        viewBox={`${x - spanCm / 2} ${y - heightCm / 2} ${spanCm} ${heightCm}`}
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
        <rect
          x={x - spanCm / 2}
          y={y - heightCm / 2}
          width={spanCm}
          height={heightCm}
          fill={`url(#${id}-grid)`}
        />
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
      <p className="text-xs text-muted-foreground">
        {spanMm} × {Number((heightCm * 10).toFixed(1))} mm ·{' '}
        {t('Checkerboard shows unprinted area')}
      </p>
    </div>
  )
}

function rotation(t: ArtworkTransform): string {
  return `rotate(${t.rotation} ${t.xCm + t.widthCm / 2} ${t.yCm + t.heightCm / 2})`
}
