import { Move } from 'lucide-react'
import type {
  HardcoverPdfCoverTarget,
  HardcoverPdfPagePosition,
  HardcoverProjectState
} from '../types'
import { CoverPreview2D } from './CoverPreview2D'

export function CoverCanvas({
  state,
  onSourcePdfPositionChange
}: {
  state: HardcoverProjectState
  onSourcePdfPositionChange: (
    position: HardcoverPdfPagePosition,
    target?: HardcoverPdfCoverTarget
  ) => void
}): JSX.Element {
  return (
    <section
      className="min-h-[340px] min-w-0 max-w-full overflow-hidden rounded-lg border bg-muted/40 p-2 sm:p-4 xl:min-h-[520px]"
      data-hardcover-cover-canvas
    >
      {state.sourcePdf ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Move className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Drag the front or back artwork directly on the preview to adjust its position.
        </div>
      ) : null}
      <div className="min-w-0 max-w-full overflow-auto">
        <div className="mx-auto max-w-6xl">
          <CoverPreview2D state={state} onSourcePdfPositionChange={onSourcePdfPositionChange} />
        </div>
      </div>
    </section>
  )
}
