import { AlertTriangle, Check, FileText, Info, Loader2, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CutterPdfImportSession } from '../lib/pdfImport'
import { parsePdfPageRange } from '../lib/pdfPageRange'
import type { PdfProductionMetadata } from '../types'

interface PdfPageImportDialogProps {
  session: CutterPdfImportSession
  busy: boolean
  onLoadMore: () => void
  onCancel: () => void
  onImport: (pageNumbers: number[]) => void
}

export function PdfPageImportDialog({
  session,
  busy,
  onLoadMore,
  onCancel,
  onImport
}: PdfPageImportDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const rangeErrorId = useId()
  const [selectedPages, setSelectedPages] = useState<Set<number>>(() => new Set([1]))
  const [rangeValue, setRangeValue] = useState('1')
  const [rangeError, setRangeError] = useState<string | null>(null)
  const selectedPageNumbers = useMemo(
    () => [...selectedPages].sort((first, second) => first - second),
    [selectedPages]
  )
  const selectedLabel =
    selectedPageNumbers.length === 1
      ? `Page ${selectedPageNumbers[0]}`
      : `${selectedPageNumbers.length} pages`

  useEffect(() => {
    setSelectedPages(new Set([1]))
    setRangeValue('1')
    setRangeError(null)
  }, [session.id])

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    return () => {
      dialog?.close()
      previousFocus?.focus()
    }
  }, [session.id])

  function applyRange(): void {
    try {
      setSelectedPages(new Set(parsePdfPageRange(rangeValue, session.pageCount)))
      setRangeError(null)
    } catch (error) {
      setRangeError(error instanceof Error ? error.message : 'Invalid page range.')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-5xl overflow-hidden rounded-xl border bg-card p-0 text-foreground shadow-xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <section>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <h3 id={titleId} className="truncate font-semibold">
                {session.fileName}
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {session.pageCount} pages · {session.loadedPageCount} thumbnails loaded
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onCancel} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="grid max-h-[calc(90vh_-_100px)] grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_260px] lg:overflow-hidden">
          <div className="p-4 lg:overflow-y-auto">
            {session.warning && (
              <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950">
                {session.warning}
              </div>
            )}
            <PdfProductionMetadataPanel metadata={session.productionMetadata} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {session.pages.map((page) => {
                const selected = selectedPages.has(page.pageNumber)

                return (
                  <button
                    key={page.pageNumber}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`Select page ${page.pageNumber}`}
                    className={`group overflow-hidden rounded-md border bg-background text-left shadow-sm transition ${
                      selected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/60'
                    }`}
                    style={{
                      contentVisibility: 'auto',
                      containIntrinsicSize: '180px 140px'
                    }}
                    onClick={() =>
                      setSelectedPages((current) => {
                        const next = new Set(current)

                        if (next.has(page.pageNumber)) {
                          next.delete(page.pageNumber)
                        } else {
                          next.add(page.pageNumber)
                        }

                        return next
                      })
                    }
                  >
                    <span className="relative grid aspect-[4/3] place-items-center bg-white">
                      <img
                        src={page.thumbnailUrl}
                        alt={`Page ${page.pageNumber}`}
                        className="h-full w-full object-contain"
                      />
                      {selected && (
                        <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-4" />
                        </span>
                      )}
                    </span>
                    <span className="block truncate px-2 py-2 text-sm font-medium">
                      Page {page.pageNumber}
                    </span>
                    {page.productionMetadata?.physicalSizeMm && (
                      <span className="block px-2 pb-2 text-[11px] text-muted-foreground">
                        {formatPhysicalSize(
                          page.productionMetadata.physicalSizeMm.widthMm,
                          page.productionMetadata.physicalSizeMm.heightMm
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <aside className="border-t bg-muted/20 p-4 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSelectedPages(
                    new Set(Array.from({ length: session.pageCount }, (_, i) => i + 1))
                  )
                }
              >
                Select all
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelectedPages(new Set())}>
                Select none
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedPages(new Set([1]))}
              >
                Page 1 only
              </Button>
            </div>

            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              Page range
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                value={rangeValue}
                placeholder="1-4,7,10"
                aria-invalid={Boolean(rangeError)}
                aria-describedby={rangeError ? rangeErrorId : undefined}
                onChange={(event) => {
                  setRangeValue(event.target.value)
                  setRangeError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    applyRange()
                  }
                }}
              />
            </label>
            <Button type="button" variant="outline" className="mt-2 w-full" onClick={applyRange}>
              Apply range
            </Button>
            {rangeError && (
              <p id={rangeErrorId} role="alert" className="mt-2 text-xs text-destructive">
                {rangeError}
              </p>
            )}

            <div className="mt-5 rounded-md border bg-background p-3 text-sm">
              <div className="font-medium" role="status" aria-live="polite">
                {selectedLabel} selected
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {selectedPageNumbers.length === 0
                  ? 'Select at least one page to continue.'
                  : selectedPageNumbers.slice(0, 12).join(', ')}
                {selectedPageNumbers.length > 12 ? '...' : ''}
              </div>
            </div>

            {session.loadedPageCount < session.pageCount && (
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                onClick={onLoadMore}
                disabled={busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Load more pages
              </Button>
            )}

            <Button
              type="button"
              className="mt-3 w-full"
              disabled={busy || selectedPages.size === 0}
              onClick={() => onImport(selectedPageNumbers)}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Import {selectedPageNumbers.length || 'selected'}{' '}
              {selectedPageNumbers.length === 1 ? 'page' : 'pages'}
            </Button>
          </aside>
        </div>
      </section>
    </dialog>
  )
}

function PdfProductionMetadataPanel({
  metadata
}: {
  metadata: PdfProductionMetadata
}): JSX.Element {
  const layerSummary = metadata.layers.length
    ? metadata.layers
        .map((layer) => `${layer.name} (${layer.defaultVisible ? 'visible' : 'hidden'})`)
        .join(' · ')
    : 'None detected'
  const colorantSummary = metadata.colorants.length
    ? metadata.colorants.map((colorant) => `${colorant.kind}: ${colorant.name}`).join(' · ')
    : 'None detected'

  return (
    <section
      className="mb-3 rounded-md border bg-muted/20 p-3 text-xs"
      aria-label="PDF production inspection"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Info className="size-4 text-primary" />
        <strong>Production structure inspection</strong>
        <span className="rounded bg-background px-1.5 py-0.5 font-medium">
          {getClassificationLabel(metadata.classification)}
        </span>
        {metadata.sourceFormat === 'pdf-compatible-ai' && (
          <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-950">
            PDF-compatible AI
          </span>
        )}
      </div>
      <div className="mt-2 grid gap-1 text-muted-foreground">
        <div>
          Page size:{' '}
          {metadata.pageSizeMm
            ? formatPhysicalSize(metadata.pageSizeMm.widthMm, metadata.pageSizeMm.heightMm)
            : 'unavailable'}
        </div>
        <div>Layers: {layerSummary}</div>
        <div>Spot colors: {colorantSummary}</div>
        <div>Page boxes: {formatBoxSummary(metadata.pageBoxes)}</div>
      </div>
      {metadata.warnings.length > 0 && (
        <div className="mt-2 grid gap-1 rounded border border-amber-300 bg-amber-50 p-2 text-amber-950">
          {metadata.warnings.map((warning) => (
            <div key={warning} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-muted-foreground">
        Inspection only: the original PDF/AI bytes stay intact, and hidden layers or spot colors are
        not imported as editable CutContour geometry.
      </p>
    </section>
  )
}

function getClassificationLabel(classification: PdfProductionMetadata['classification']): string {
  if (classification === 'likely-print-and-cut') return 'Likely print-and-cut'
  if (classification === 'artwork-only') return 'Artwork only'
  return 'Ambiguous structure'
}

function formatPhysicalSize(widthMm: number, heightMm: number): string {
  return `${formatMm(widthMm)} × ${formatMm(heightMm)} mm`
}

function formatBoxSummary(boxes: PdfProductionMetadata['pageBoxes']): string {
  if (!boxes) return 'unavailable'

  const entries = [
    ['Media', boxes.media],
    ['Crop', boxes.crop],
    ['Trim', boxes.trim],
    ['Bleed', boxes.bleed],
    ['Art', boxes.art]
  ] as const

  const summary = entries
    .filter(([, box]) => Boolean(box))
    .map(([label, box]) => `${label} ${formatPhysicalSize(box!.widthMm, box!.heightMm)}`)

  return summary.length > 0 ? summary.join(' · ') : 'unavailable'
}

function formatMm(value: number): string {
  return value >= 100 ? value.toFixed(1) : value.toFixed(2)
}
