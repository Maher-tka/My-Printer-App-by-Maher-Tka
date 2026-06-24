import { memo, useMemo } from 'react'
import type { HardcoverProjectState } from '../types'
import { buildHardcoverSvg } from '../lib/hardcoverExportSvg'
import { WrapMarginOverlay } from './WrapMarginOverlay'
import { calculateCoverDimensions } from '../lib/coverCalculations'

export const CoverPreview2D = memo(function CoverPreview2D({
  state
}: {
  state: HardcoverProjectState
}): JSX.Element {
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
  const svg = useMemo(() => buildHardcoverSvg(previewState), [previewState])
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
      {state.viewMode === 'layout' && (
        <WrapMarginOverlay setup={state.setup} dimensions={dimensions} />
      )}
    </div>
  )
})
