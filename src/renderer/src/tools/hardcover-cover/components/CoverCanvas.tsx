import type { HardcoverProjectState } from '../types'
import { CoverPreview2D } from './CoverPreview2D'

export function CoverCanvas({ state }: { state: HardcoverProjectState }): JSX.Element {
  return (
    <section
      className="min-h-[340px] min-w-0 max-w-full overflow-hidden rounded-lg border bg-muted/40 p-2 sm:p-4 xl:min-h-[520px]"
      data-hardcover-cover-canvas
    >
      <div className="min-w-0 max-w-full overflow-auto">
        <div className="mx-auto max-w-6xl">
          <CoverPreview2D state={state} />
        </div>
      </div>
    </section>
  )
}
