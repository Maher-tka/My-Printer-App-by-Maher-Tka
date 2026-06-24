import type { HardcoverProjectState } from '../types'
import { CoverPreview2D } from './CoverPreview2D'

export function CoverCanvas({ state }: { state: HardcoverProjectState }): JSX.Element {
  return (
    <section className="min-h-[500px] overflow-auto rounded-lg border bg-muted/40 p-8">
      <div className="mx-auto max-w-5xl">
        <CoverPreview2D state={state} />
      </div>
    </section>
  )
}
