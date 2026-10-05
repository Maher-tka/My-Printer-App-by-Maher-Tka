import { useLanguage } from '@/i18n/useLanguage'
import type { CardArtwork } from '../types'
import type { getCardLayout } from '../lib/layout'
import { CARD_CROP_LINE_WIDTH_MM } from '../lib/cropMarks'

export function CardSheetPreview({
  artwork,
  side,
  layout,
  showLabel = false,
  sheetWidthPx
}: {
  artwork: CardArtwork | null
  side: 'front' | 'back'
  layout: ReturnType<typeof getCardLayout>
  showLabel?: boolean
  sheetWidthPx?: number
}): JSX.Element {
  const { t } = useLanguage()

  const label = side === 'front' ? 'Front' : 'Back'
  return (
    <figure className="min-w-0 space-y-3">
      {showLabel && (
        <figcaption className="text-center text-sm font-semibold">{t(label)} side</figcaption>
      )}
      <svg
        role="img"
        aria-label={`${label} A4 montage preview, ${layout.columns} columns and ${layout.rows} rows, ${layout.capacity} cards`}
        viewBox={`0 0 ${layout.sheetWidthMm} ${layout.sheetHeightMm}`}
        className="mx-auto block bg-white shadow-lg"
        style={{
          width:
            sheetWidthPx ??
            `min(100%, ${(72 * layout.sheetWidthMm) / layout.sheetHeightMm}vh, 590px)`,
          aspectRatio: `${layout.sheetWidthMm} / ${layout.sheetHeightMm}`
        }}
      >
        <rect width={layout.sheetWidthMm} height={layout.sheetHeightMm} fill="white" />
        {layout.slots.map((slot, index) => (
          <g key={index}>
            {artwork ? (
              <image
                href={artwork.previewDataUrl}
                x={slot.xMm}
                y={slot.yMm}
                width={layout.widthMm}
                height={layout.heightMm}
                preserveAspectRatio={layout.artworkFit === 'stretch' ? 'none' : 'xMidYMid meet'}
              />
            ) : (
              <>
                <rect
                  x={slot.xMm}
                  y={slot.yMm}
                  width={layout.widthMm}
                  height={layout.heightMm}
                  fill="#f1f5f9"
                />
                <text
                  x={slot.xMm + layout.widthMm / 2}
                  y={slot.yMm + layout.heightMm / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="3"
                  fill="#64748b"
                >
                  Your {side} design
                </text>
              </>
            )}
            {!artwork && !layout.outlines.length && (
              <rect
                x={slot.xMm}
                y={slot.yMm}
                width={layout.widthMm}
                height={layout.heightMm}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="0.12"
                strokeDasharray="0.6 0.6"
              />
            )}
          </g>
        ))}
        {layout.marks.map((mark, index) => (
          <line
            key={index}
            x1={mark.x1}
            y1={mark.y1}
            x2={mark.x2}
            y2={mark.y2}
            stroke={layout.lineColor}
            strokeWidth={CARD_CROP_LINE_WIDTH_MM}
          />
        ))}
        {layout.outlines.map((outline, index) => (
          <rect
            key={`outline-${index}`}
            x={outline.xMm}
            y={outline.yMm}
            width={outline.widthMm}
            height={outline.heightMm}
            fill="none"
            stroke={layout.lineColor}
            strokeWidth={CARD_CROP_LINE_WIDTH_MM}
          />
        ))}
      </svg>
      {!artwork && showLabel && (
        <p className="text-center text-xs text-muted-foreground">
          Import a {side} design to fill this sheet.
        </p>
      )}
    </figure>
  )
}
