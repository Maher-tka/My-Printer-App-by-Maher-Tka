import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getLargeProjectWarning } from '@/performance/renderQuality'
import { usePerformanceSettings } from '@/performance/usePerformanceSettings'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import type { AppRoute } from '@/types/navigation'
import { BookFlipPreview } from './components/BookFlipPreview'
import { BookletToolbar } from './components/BookletToolbar'
import { PageManager } from './components/PageManager'
import { SheetPreview } from './components/SheetPreview'
import { useBookletMontage } from './hooks/useBookletMontage'
import type { BookletViewMode } from './types'

interface BookletMontagePageProps {
  onNavigate: (route: AppRoute) => void
}

export function BookletMontagePage({
  onNavigate
}: BookletMontagePageProps): JSX.Element {
  const montage = useBookletMontage()
  const { settings: performanceSettings, setPreset: setPerformancePreset } =
    usePerformanceSettings()
  const [viewMode, setViewMode] = useState<BookletViewMode>('sheet')
  const boardItemIds = useMemo(
    () => montage.sheetBoardState.items.map((item) => item.id),
    [montage.sheetBoardState.items]
  )
  const pageIds = useMemo(() => montage.pages.map((page) => page.id), [montage.pages])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const importIsBusy =
    montage.importProgress.phase === 'reading' ||
    montage.importProgress.phase === 'loading-page' ||
    montage.importProgress.phase === 'generating-thumbnails' ||
    montage.importProgress.phase === 'rendering'
  const exportIsBusy =
    montage.exportProgress.phase === 'preparing-pages' ||
    montage.exportProgress.phase === 'rendering-page' ||
    montage.exportProgress.phase === 'creating-pdf' ||
    montage.exportProgress.phase === 'saving-file'
  const hasExportableItems =
    montage.sheets.length > 0 || montage.emptySheetsForExport.length > 0
  const readingDirectionLabel =
    montage.settings.readingDirection === 'rtl' ? 'RTL Arabic mode' : 'LTR mode'
  const canExport =
    hasExportableItems &&
    (montage.pages.length === 0 || montage.pageCountIsValid) &&
    !exportIsBusy &&
    !importIsBusy
  const largeProjectWarning = getLargeProjectWarning({
    pageCount: montage.pages.length,
    totalBytes: montage.sources.reduce((total, source) => total + source.bytes.byteLength, 0)
  })

  useEffect(() => {
    if (boardItemIds.length === 0) {
      setSelectedItemId(null)
      return
    }

    setSelectedItemId((current) => (current && boardItemIds.includes(current) ? current : boardItemIds[0]))
    setInspectedItemId((current) => (current && boardItemIds.includes(current) ? current : null))
  }, [boardItemIds])

  useEffect(() => {
    if (pageIds.length === 0) {
      setSelectedPageId(null)
      return
    }

    setSelectedPageId((current) => (current && pageIds.includes(current) ? current : pageIds[0]))
  }, [pageIds])

  useEffect(() => {
    if (viewMode !== 'montage') {
      setInspectedItemId(null)
    }
  }, [viewMode])

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-5">
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => onNavigate('dashboard')}
        type="button"
      >
        <ArrowLeft data-icon="inline-start" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-xl">Booklet Montage</CardTitle>
            <CardDescription>
              Arrange source pages, inspect imposed print sheets, and preview the final booklet.
            </CardDescription>
          </div>
          <div className="rounded-md border bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
            Local-first: no cloud processing
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <BookletToolbar
            settings={montage.settings}
            viewMode={viewMode}
            blanksNeeded={montage.blanksNeeded}
            hasBoardItems={montage.sheetBoardState.items.length > 0}
            canExport={canExport}
            isBusy={importIsBusy || exportIsBusy}
            importProgress={montage.importProgress}
            exportProgress={montage.exportProgress}
            onImportPdf={montage.importPdfFiles}
            onImportImages={montage.importImages}
            onCancelImport={montage.cancelImport}
            onCancelExport={montage.cancelExport}
            onClear={montage.clearProject}
            onSettingsChange={montage.updateSettings}
            onAutoAddBlankPages={montage.autoAddBlankPages}
            onAddEmptySheet={montage.addEmptySheet}
            onResetSheetLayout={montage.resetSheetLayout}
            onExportPdf={montage.exportPdf}
            onExportImages={montage.exportImages}
            onViewModeChange={setViewMode}
          />

          <section className="min-w-0">
            <div className="flex min-w-0 flex-col gap-4">
              {montage.error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {montage.error}
                </div>
              )}
              {largeProjectWarning && performanceSettings.preset !== 'low-end' && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <span>{largeProjectWarning}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPerformancePreset('low-end')}
                  >
                    Switch to Low-end PC mode
                  </Button>
                </div>
              )}
              {viewMode === 'sheet' && (
                <>
                  <ModePurposeBanner
                    title="Sheet Mode"
                    description={`Manage the source page sequence before booklet imposition. Current order drives Montage Mode, 3D Book Mode, and export in ${readingDirectionLabel}.`}
                  />
                  <PageManager
                    pages={montage.pages}
                    selectedPageId={selectedPageId}
                    blanksNeeded={montage.blanksNeeded}
                    pageCountIsValid={montage.pageCountIsValid}
                    onSelectPage={setSelectedPageId}
                    onAddBlankPage={montage.addBlankPage}
                    onAutoAddBlankPages={montage.autoAddBlankPages}
                    onReorderPages={montage.reorderPages}
                    onResetOrder={montage.resetPageOrder}
                    onDeletePage={montage.deletePage}
                  />
                </>
              )}

              {viewMode === 'montage' && (
                <>
                  <ModePurposeBanner
                    title="Montage Mode"
                    description={`Inspect every imposed front/back print sheet generated from the current Sheet Mode order. ${readingDirectionLabel} is active.`}
                  />
                  <SheetPreview
                    sheets={montage.sheets}
                    settings={montage.settings}
                    pageCountIsValid={montage.pageCountIsValid}
                    selectedItemId={selectedItemId}
                    inspectedItemId={inspectedItemId}
                    boardState={montage.sheetBoardState}
                    onInspectItem={(itemId) => {
                      setSelectedItemId(itemId)
                      setInspectedItemId(itemId)
                    }}
                    onCloseInspect={() => setInspectedItemId(null)}
                    onMoveItem={montage.moveSheetBoardItem}
                    onDeleteItem={montage.deleteSheetBoardItem}
                    onDuplicateItem={montage.duplicateSheetBoardItem}
                    onEmptySheetColorChange={montage.setEmptySheetColor}
                  />
                </>
              )}

              {viewMode === 'book' && (
                <>
                  <ModePurposeBanner
                    title="3D Book Mode"
                    description={`Flip through the current booklet visually in ${readingDirectionLabel}. Print accuracy still comes from Montage Mode and export.`}
                  />
                  <BookFlipPreview
                    orderedPages={montage.pages}
                    sources={montage.sources}
                    settings={montage.settings}
                  />
                </>
              )}
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}

function ModePurposeBanner({
  title,
  description
}: {
  title: string
  description: string
}): JSX.Element {
  return (
    <div className="rounded-lg border bg-muted/35 px-4 py-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
