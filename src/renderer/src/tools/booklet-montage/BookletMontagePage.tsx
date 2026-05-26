import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import type { AppRoute } from '@/types/navigation'
import { ExportPanel } from './components/ExportPanel'
import { FileImporter } from './components/FileImporter'
import { PageManager } from './components/PageManager'
import { SheetPreview } from './components/SheetPreview'
import { SheetSettingsPanel } from './components/SheetSettingsPanel'
import { useBookletMontage } from './hooks/useBookletMontage'

interface BookletMontagePageProps {
  onNavigate: (route: AppRoute) => void
}

export function BookletMontagePage({
  onNavigate
}: BookletMontagePageProps): JSX.Element {
  const montage = useBookletMontage()
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

  return (
    <div className="mx-auto flex max-w-[1560px] flex-col gap-5">
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
        <CardHeader className="flex-row items-start justify-between gap-4">
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
        <CardContent>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
            <aside className="flex flex-col gap-5">
              <FileImporter
                importProgress={montage.importProgress}
                isBusy={importIsBusy || exportIsBusy}
                onImportPdf={montage.importPdfFiles}
                onImportImages={montage.importImages}
                onCancelImport={montage.cancelImport}
                onClear={montage.clearProject}
              />
              <SheetSettingsPanel
                settings={montage.settings}
                onChange={montage.updateSettings}
              />
              <ExportPanel
                exportProgress={montage.exportProgress}
                canExport={canExport}
                isBusy={importIsBusy || exportIsBusy}
                onExportPdf={montage.exportPdf}
                onExportImages={montage.exportImages}
                onCancelExport={montage.cancelExport}
              />
            </aside>

            <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[360px_minmax(0,1fr)]">
              <PageManager
                pages={montage.pages}
                blanksNeeded={montage.blanksNeeded}
                pageCountIsValid={montage.pageCountIsValid}
                onAddBlankPage={montage.addBlankPage}
                onAutoAddBlankPages={montage.autoAddBlankPages}
                onMovePage={montage.movePage}
                onDeletePage={montage.deletePage}
              />
              <div className="flex flex-col gap-4">
                {montage.error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                    {montage.error}
                  </div>
                )}
                <SheetPreview
                  sheets={montage.sheets}
                  settings={montage.settings}
                  pageCountIsValid={montage.pageCountIsValid}
                />
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
