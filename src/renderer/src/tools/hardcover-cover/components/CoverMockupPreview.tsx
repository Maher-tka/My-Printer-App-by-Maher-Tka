import type { CoverMockupMode, HardcoverProjectState } from '../types'
import { getMockupTransform } from '../lib/coverMockup'
import { CoverPreview2D } from './CoverPreview2D'

export function CoverMockupPreview({
  state,
  onModeChange
}: {
  state: HardcoverProjectState
  onModeChange: (mode: CoverMockupMode) => void
}): JSX.Element {
  const simpleState = { ...state, zoom: 1, viewMode: 'clean' as const }
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Customer mockup</h3>
          <p className="text-sm text-muted-foreground">Lightweight approval preview.</p>
        </div>
        <select
          className="rounded-md border bg-background px-2 py-1 text-sm"
          value={state.mockupMode}
          onChange={(event) => onModeChange(event.target.value as CoverMockupMode)}
        >
          <option value="flat">Flat sheet</option>
          <option value="folded">Folded hardcover</option>
          <option value="spine">Spine check</option>
          <option value="front">Front cover</option>
        </select>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg bg-muted p-6">
        <div
          className="mx-auto max-w-2xl origin-center transition-transform"
          style={{ transform: getMockupTransform(state.mockupMode), transformStyle: 'preserve-3d' }}
        >
          <CoverPreview2D state={simpleState} />
        </div>
      </div>
    </section>
  )
}

export default CoverMockupPreview
