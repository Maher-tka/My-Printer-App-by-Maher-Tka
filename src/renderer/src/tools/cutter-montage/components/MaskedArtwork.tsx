import { useId } from 'react'
import type { ArtworkTransform, EditorObject } from '../types'
import { getNormalizedShapePath } from '../lib/shapeGeometry'

export function MaskedArtwork({
  artwork,
  mask,
  src,
  width,
  height
}: {
  artwork: ArtworkTransform
  mask: EditorObject
  src: string
  width: number
  height: number
}): JSX.Element {
  const id = useId().replace(/:/g, '')
  const m = mask.transform
  const rotation = (t: ArtworkTransform) =>
    `rotate(${t.rotation} ${t.xCm + t.widthCm / 2} ${t.yCm + t.heightCm / 2})`
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id={id} clipPathUnits="userSpaceOnUse">
          <path
            d={getNormalizedShapePath(mask, m.widthCm, m.heightCm)}
            transform={`${rotation(m)} translate(${m.xCm} ${m.yCm}) scale(${m.widthCm} ${m.heightCm})`}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <image
          href={src}
          x={artwork.xCm}
          y={artwork.yCm}
          width={artwork.widthCm}
          height={artwork.heightCm}
          transform={rotation(artwork)}
          preserveAspectRatio="none"
        />
      </g>
    </svg>
  )
}
