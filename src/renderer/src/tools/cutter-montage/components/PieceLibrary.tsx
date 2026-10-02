import {
  FileText,
  FolderOpen,
  ImagePlus,
  ListFilter,
  PlusSquare,
  Search,
  Trash2,
  Wand2
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { PdfProductionMetadata, PiecePreset, PieceSourceKind } from '../types'
import { PieceCard } from './PieceCard'

type PieceFilter = 'all' | PieceSourceKind

interface PieceLibraryProps {
  pieces: PiecePreset[]
  activePieceId: string | null
  onImport: (files: File[]) => void
  onEditPiece: (pieceId: string) => void
  onDuplicatePiece: (pieceId: string) => void
  onDeletePiece: (pieceId: string) => void
  onAddToSheet: (pieceId: string) => void
  onAddSelectedToSheet: (pieceIds: string[]) => void
  onAutoArrangeSelected: (pieceIds: string[]) => void
  onDeleteUnusedPieces: () => void
  onPieceQuantityChange: (pieceId: string, quantity: number) => void
  onPieceTargetLengthChange: (pieceId: string, targetLengthCm: number) => void
  onPieceRotationAllowedChange: (pieceId: string, rotationAllowed: boolean) => void
  onRename: (pieceId: string, name: string) => void
}

export function PieceLibrary({
  pieces,
  activePieceId,
  onImport,
  onEditPiece,
  onDuplicatePiece,
  onDeletePiece,
  onAddToSheet,
  onAddSelectedToSheet,
  onAutoArrangeSelected,
  onDeleteUnusedPieces,
  onPieceQuantityChange,
  onPieceTargetLengthChange,
  onPieceRotationAllowedChange,
  onRename
}: PieceLibraryProps): JSX.Element {
  const artworkInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<PieceFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const filteredPieces = useMemo(
    () =>
      pieces.filter((piece) => {
        const matchesFilter = filter === 'all' || inferPieceKind(piece) === filter
        const normalizedQuery = query.trim().toLowerCase()
        const matchesQuery =
          !normalizedQuery ||
          piece.displayName.toLowerCase().includes(normalizedQuery) ||
          piece.sourceFileName.toLowerCase().includes(normalizedQuery)

        return matchesFilter && matchesQuery
      }),
    [filter, pieces, query]
  )
  const filteredIds = useMemo(() => filteredPieces.map((piece) => piece.id), [filteredPieces])
  const selectedVisibleIds = filteredIds.filter((id) => selectedIds.has(id))
  const missingCutlineCount = pieces.filter((piece) => !piece.cutlineObjectId).length
  const inspectedPdfPieces = pieces.filter((piece) => piece.pdfProductionMetadata)

  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(pieces.map((piece) => piece.id))
      const next = new Set([...current].filter((id) => validIds.has(id)))

      return next.size === current.size ? current : next
    })
  }, [pieces])

  return (
    <section className="min-w-0 max-w-full overflow-hidden space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Sticker Job</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {pieces.length} models · {missingCutlineCount} still need CutContour
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <Button
          type="button"
          className="w-full justify-start"
          onClick={() => artworkInputRef.current?.click()}
        >
          <ImagePlus data-icon="inline-start" />
          Import Artwork
        </Button>
        <details className="min-w-0 rounded-md border bg-muted/20">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            More import options
          </summary>
          <div className="grid min-w-0 gap-2 border-t p-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-w-0 justify-start"
              onClick={() => pdfInputRef.current?.click()}
            >
              <FileText data-icon="inline-start" />
              Import PDF / AI Pages
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-w-0 justify-start"
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderOpen data-icon="inline-start" />
              Import Folder
            </Button>
          </div>
        </details>

        {inspectedPdfPieces.length > 0 && (
          <section className="rounded-md border border-primary/15 bg-primary/5 p-3 text-xs text-primary">
            <div className="font-semibold">PDF production inspection</div>
            <div className="mt-2 grid gap-2">
              {inspectedPdfPieces.slice(0, 4).map((piece) => (
                <div key={piece.id} className="rounded border border-primary/15 bg-white/60 p-2">
                  <div className="font-medium">{piece.displayName}</div>
                  <div className="mt-1">
                    {formatPdfClassification(piece.pdfProductionMetadata!)}
                    {piece.pdfPageMetadata?.physicalSizeMm && (
                      <>
                        {' '}
                        ·{' '}
                        {formatPdfSize(
                          piece.pdfPageMetadata.physicalSizeMm.widthMm,
                          piece.pdfPageMetadata.physicalSizeMm.heightMm
                        )}
                      </>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {piece.pdfProductionMetadata!.layers.length} layer(s) ·{' '}
                    {piece.pdfProductionMetadata!.colorants.length} spot color(s)
                  </div>
                </div>
              ))}
              {inspectedPdfPieces.length > 4 && (
                <div className="text-[11px]">
                  + {inspectedPdfPieces.length - 4} more inspected PDF page(s)
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Hidden layers and Mimaki registration separations stay in the original source. They
              are not automatically editable CutContour lines.
            </p>
          </section>
        )}

        {pieces.length > 3 && (
          <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
            <Search className="size-4 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent outline-none"
              value={query}
              placeholder="Search pieces"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}

        {pieces.length > 3 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <ListFilter className="size-3" />
              Filter
            </span>
            {(
              [
                ['all', 'All'],
                ['image', 'Images'],
                ['svg', 'SVG'],
                ['pdf-page', 'PDF pages']
              ] as Array<[PieceFilter, string]>
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? 'default' : 'outline'}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        )}

        {selectedVisibleIds.length > 0 && (
          <div className="grid min-w-0 grid-cols-1 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-w-0 justify-start"
              disabled={selectedVisibleIds.length === 0}
              onClick={() => onAddSelectedToSheet(selectedVisibleIds)}
            >
              <PlusSquare data-icon="inline-start" />
              Add selected
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-w-0 justify-start"
              disabled={selectedVisibleIds.length === 0}
              onClick={() => onAutoArrangeSelected(selectedVisibleIds)}
            >
              <Wand2 data-icon="inline-start" />
              Arrange selected
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-w-0 justify-start"
              onClick={onDeleteUnusedPieces}
            >
              <Trash2 data-icon="inline-start" />
              Delete unused
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {filteredPieces.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            Stage 1: import one PNG, JPG, or SVG and prepare its CutContour.
          </div>
        ) : (
          filteredPieces.map((piece) => (
            <PieceCard
              key={piece.id}
              piece={piece}
              active={piece.id === activePieceId}
              selected={selectedIds.has(piece.id)}
              onSelectedChange={(pieceId, selected) =>
                setSelectedIds((current) => {
                  const next = new Set(current)

                  if (selected) {
                    next.add(pieceId)
                  } else {
                    next.delete(pieceId)
                  }

                  return next
                })
              }
              onEdit={onEditPiece}
              onDuplicate={onDuplicatePiece}
              onDelete={(pieceId) => {
                const candidate = pieces.find((item) => item.id === pieceId)
                if (!candidate) return
                const confirmed = window.confirm(
                  `Delete “${candidate.displayName}”? Any copies placed on the sheet will also be removed.`
                )
                if (confirmed) onDeletePiece(pieceId)
              }}
              onAddToSheet={onAddToSheet}
              onQuantityChange={onPieceQuantityChange}
              onTargetLengthChange={onPieceTargetLengthChange}
              onRotationAllowedChange={onPieceRotationAllowedChange}
              onRename={onRename}
            />
          ))
        )}
      </div>

      <input
        ref={artworkInputRef}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
        multiple
        onChange={(event) => {
          onImport(Array.from(event.target.files ?? []))
          event.currentTarget.value = ''
        }}
      />
      <input
        ref={pdfInputRef}
        className="hidden"
        type="file"
        accept="application/pdf,.pdf,.ai"
        multiple
        onChange={(event) => {
          onImport(Array.from(event.target.files ?? []))
          event.currentTarget.value = ''
        }}
      />
      <input
        ref={folderInputRef}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,application/pdf,.png,.jpg,.jpeg,.svg,.pdf,.ai"
        multiple
        {...({ webkitdirectory: 'true' } as Record<string, string>)}
        onChange={(event) => {
          onImport(Array.from(event.target.files ?? []))
          event.currentTarget.value = ''
        }}
      />
    </section>
  )
}

function formatPdfClassification(metadata: PdfProductionMetadata): string {
  if (metadata.classification === 'likely-print-and-cut') return 'Likely print-and-cut'
  if (metadata.classification === 'artwork-only') return 'Artwork only'
  return 'Ambiguous structure'
}

function formatPdfSize(widthMm: number, heightMm: number): string {
  return `${formatPdfMm(widthMm)} × ${formatPdfMm(heightMm)} mm`
}

function formatPdfMm(value: number): string {
  return value >= 100 ? value.toFixed(1) : value.toFixed(2)
}

function inferPieceKind(piece: PiecePreset): PieceSourceKind {
  if (piece.sourceKind) return piece.sourceKind
  if (/\.pdf$/i.test(piece.sourceFileName)) return 'pdf-page'
  if (/\.svg$/i.test(piece.sourceFileName)) return 'svg'
  return 'image'
}
