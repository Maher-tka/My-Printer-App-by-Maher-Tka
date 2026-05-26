import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import type { AppRoute } from '@/types/navigation'
import { Booklet3DPreview } from './components/Booklet3DPreview'
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
  const [viewMode, setViewMode] = useState<BookletViewMode>('montage')
  const sideKeys = useMemo(
    () => montage.sheets.flatMap((sheet) => [`${sheet.sheetNumber}-front`, `${sheet.sheetNumber}-back`]),
    [montage.sheets]
  )
  const [selectedSideKey, setSelectedSideKey] = useState<string | null>(null)
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
  const canExport = montage.sheets.length > 0 && !exportIsBusy && !importIsBusy

  useEffect(() => {
    if (sideKeys.length === 0) {
      setSelectedSideKey(null)
      return
    }

    setSelectedSideKey((current) => (current && sideKeys.includes(current) ? current : sideKeys[0]))
  }, [sideKeys])

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
              Import PDF pages or images, arrange the page order, preview the
              booklet sheets, and export print-ready files.
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
            onExportPdf={montage.exportPdf}
            onExportImages={montage.exportImages}
            onViewModeChange={setViewMode}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="min-w-0">
              <PageManager
                pages={montage.pages}
                blanksNeeded={montage.blanksNeeded}
                pageCountIsValid={montage.pageCountIsValid}
                onAddBlankPage={montage.addBlankPage}
                onAutoAddBlankPages={montage.autoAddBlankPages}
                onMovePage={montage.movePage}
                onDeletePage={montage.deletePage}
              />
            </aside>
            <section className="min-w-0">
              <div className="flex min-w-0 flex-col gap-4">
                {montage.error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                    {montage.error}
                  </div>
                )}
                {viewMode === '3d' ? (
                  <Booklet3DPreview pages={montage.pages} />
                ) : (
                  <SheetPreview
                    sheets={montage.sheets}
                    settings={montage.settings}
                    pageCountIsValid={montage.pageCountIsValid}
                    viewMode={viewMode}
                    selectedSideKey={selectedSideKey}
                    onSelectSide={(sideKey) => {
                      setSelectedSideKey(sideKey)
                      setViewMode('sheet')
                    }}
                  />
                )}
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
