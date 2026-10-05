import { ActionIcon } from '@/components/ui/action-button'
import { useLanguage } from '@/i18n/useLanguage'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CardArtwork } from '../types'
import { PdfPageSelector } from '../../shared/PdfPageSelector'

export function CardArtworkPanel({
  side,
  artwork,
  busy,
  widthMm,
  heightMm,
  onImport,
  onChangePage,
  onLoadMore,
  onPreview,
  onRemove,
  onUseFrontPage,
  includeBack,
  onIncludeBack
}: {
  side: 'front' | 'back'
  artwork: CardArtwork | null
  busy: boolean
  widthMm: number
  heightMm: number
  onImport: (file: File) => void
  onChangePage: (page: number) => void
  onLoadMore: (start: number) => void
  onPreview: () => void
  onRemove?: () => void
  onUseFrontPage?: () => void
  includeBack?: boolean
  onIncludeBack?: (value: boolean) => void
}): JSX.Element {
  const { t } = useLanguage()

  const label = side === 'front' ? 'Front' : 'Back'
  const fonts =
    artwork?.pdfInfo?.pages.find((page) => page.pageNumber === artwork.pageNumber)?.fonts ?? []
  const missing = fonts.filter((font) => !font.embedded)
  return (
    <section
      className="space-y-3 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4"
      aria-label={`${label} side panel`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t(label)} side</h2>
        {onRemove && artwork && (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            {t('Remove back')}
          </Button>
        )}
      </div>
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 hover:bg-muted/40 ${busy ? 'pointer-events-none' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files[0]
          if (!busy && file) onImport(file)
        }}
      >
        {busy ? (
          <LoaderCircle className="size-5 shrink-0 animate-spin text-primary" />
        ) : (
          <ActionIcon action="import" className="size-5 shrink-0 text-primary" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {artwork?.name ?? `Import ${side} design`}
          </span>
          <span className="text-xs text-muted-foreground">AI, PDF, PNG, JPG · up to 30 MB</span>
        </span>
        <input
          className="sr-only"
          type="file"
          aria-label={`Import ${side} design`}
          accept="application/pdf,image/png,image/jpeg,.ai,.pdf,.png,.jpg,.jpeg"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImport(file)
            event.target.value = ''
          }}
        />
      </label>
      {onUseFrontPage && (
        <Button className="w-full" size="sm" variant="outline" onClick={onUseFrontPage}>
          {t('Use page 2 / artboard 2 of front file')}
        </Button>
      )}
      {onIncludeBack && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="accent-primary"
            checked={Boolean(includeBack)}
            onChange={(event) => onIncludeBack(event.target.checked)}
          />
          {t('Include back in export and printing')}
        </label>
      )}
      {artwork ? (
        <>
          <button
            className="block w-full overflow-hidden rounded-xl border bg-white p-2"
            type="button"
            onClick={onPreview}
            aria-label={`Preview ${side} sheet`}
          >
            <img
              src={artwork.previewDataUrl}
              alt={`${label} card design`}
              className="mx-auto h-24 max-w-full object-contain"
            />
          </button>
          <div className="space-y-1 rounded-xl bg-secondary/60 p-3 text-xs">
            <p>
              <span className="font-semibold">{t('Original file size:')}</span>{' '}
              {(artwork.widthMm / 10).toFixed(2)} × {(artwork.heightMm / 10).toFixed(2)} cm
            </p>
            <p>
              <span className="font-semibold">{t('Printed card size:')}</span>{' '}
              {(widthMm / 10).toFixed(2)} × {(heightMm / 10).toFixed(2)} cm
            </p>
            {artwork.kind !== 'pdf' && (
              <p className="text-muted-foreground">
                {t('Original image size estimated at 300 dpi.')}
              </p>
            )}
          </div>
          {artwork.pdfInfo && (
            <div className="space-y-1 rounded-xl border p-3 text-xs">
              <p className="font-semibold">
                {artwork.pdfInfo.sourceFormat === 'illustrator'
                  ? 'PDF-compatible Illustrator'
                  : 'PDF'}{' '}
                · original artwork preserved
              </p>
              {missing.length ? (
                <p role="alert" className="text-destructive">
                  Font data is missing: {missing.map((font) => font.name).join(', ')}. This side
                  cannot be exported until fonts are embedded or outlined.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {fonts.length
                    ? `${fonts.length} embedded font${fonts.length === 1 ? '' : 's'} preserved. No installed fonts or Illustrator required.`
                    : 'Original vector artwork and embedded images preserved.'}
                </p>
              )}
            </div>
          )}
          {artwork.kind === 'pdf' && artwork.pageCount > 1 && (
            <PdfPageSelector
              title={t(
                artwork.pdfInfo?.sourceFormat === 'illustrator'
                  ? `${label} artboards`
                  : `${label} pages`
              )}
              pageCount={artwork.pageCount}
              selectedPageNumber={artwork.pageNumber}
              selectedLabel={label}
              previews={artwork.pagePreviews}
              itemLabel={artwork.pdfInfo?.sourceFormat === 'illustrator' ? 'Artboard' : 'Page'}
              disabled={busy}
              showScrollButtons={false}
              onSelect={onChangePage}
              onLoadMore={onLoadMore}
            />
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          {side === 'back'
            ? 'Add a separate back file, or use the second page/artboard from the front file.'
            : 'Choose the front of your business card.'}
        </p>
      )}
    </section>
  )
}
