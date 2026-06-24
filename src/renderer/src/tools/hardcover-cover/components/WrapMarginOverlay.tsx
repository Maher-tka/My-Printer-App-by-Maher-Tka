import type { CoverDimensions, CoverSetup } from '../types'

export function WrapMarginOverlay({
  setup,
  dimensions
}: {
  setup: CoverSetup
  dimensions: CoverDimensions
}): JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 text-[10px] font-semibold text-rose-700">
      <span className="absolute left-2 top-2 rounded bg-white/80 px-1">
        Wrap {setup.wrap.topMm} mm
      </span>
      <span className="absolute bottom-2 right-2 rounded bg-white/80 px-1">
        Sheet {dimensions.fullWidthMm.toFixed(1)} × {dimensions.fullHeightMm.toFixed(1)} mm
      </span>
    </div>
  )
}
