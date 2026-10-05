import { useLanguage } from '@/i18n/useLanguage'
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
  const { t } = useLanguage()

  const simpleState = { ...state, zoom: 1, viewMode: 'clean' as const }
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t('Customer mockup')}</h3>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <span className="sr-only">{t('Mockup view')}</span>
          <select
            aria-label={t('Mockup view')}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={state.mockupMode}
            onChange={(event) => onModeChange(event.target.value as CoverMockupMode)}
          >
            <option value="flat">{t('Flat sheet')}</option>
            <option value="folded">{t('Folded hardcover')}</option>
            <option value="spine">{t('Spine check')}</option>
            <option value="front">{t('Front cover')}</option>
          </select>
        </label>
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
