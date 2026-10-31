import { useLanguage } from '@/i18n/useLanguage'
import {
  Clipboard,
  ExternalLink,
  FolderOpen,
  Printer,
  RefreshCw,
  RotateCcw,
  Search
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createPrintedJob } from '@/jobs/printHistory'
import { useJobStore } from '@/jobs/useJobStore'
import { getPrintResultMessage, printPdfFile } from '@/print/printPdf'
import type { AppRoute } from '@/types/navigation'
import type { PrinterJobTool } from '@/jobs/jobTypes'
import type { ExportHistoryEntry } from '../../../shared/release-types'

export function ExportCenterPage({
  onNavigate
}: {
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  const { t, language } = useLanguage()

  const [entries, setEntries] = useState<ExportHistoryEntry[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const printInProgress = useRef(false)
  const { jobs, saveJob } = useJobStore()
  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return entries.filter(
      (entry) =>
        (status === 'all' || entry.status === status) &&
        (!needle ||
          [entry.projectName, entry.filePath, entry.toolType, entry.exportType].some((value) =>
            value?.toLowerCase().includes(needle)
          ))
    )
  }, [entries, query, status])
  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!window.printerApp) throw new Error('Export history is available in the desktop app.')
      setEntries(await window.printerApp.runtime.listExports())
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Export history could not be loaded. Try refreshing.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const runFileAction = async (
    action: 'open' | 'folder' | 'copy',
    filePath: string
  ): Promise<void> => {
    try {
      if (action === 'copy') {
        await navigator.clipboard.writeText(filePath)
        setMessage('File path copied.')
      } else {
        if (!window.printerApp) throw new Error('Open this file from the desktop app.')
        if (action === 'open') {
          const error = await window.printerApp.runtime.openPath(filePath)
          if (error) throw new Error(error)
        } else {
          await window.printerApp.runtime.openParentFolder(filePath)
        }
        setMessage(action === 'open' ? 'File opened.' : 'Containing folder opened.')
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'This action failed. The file may have moved or been deleted.'
      )
    }
  }
  useEffect(() => {
    void load()
  }, [load])

  const printExport = useCallback(
    async (entry: ExportHistoryEntry): Promise<void> => {
      if (!entry.filePath || !isPdfPath(entry.filePath) || printInProgress.current) return
      printInProgress.current = true
      setPrintingId(entry.id)
      try {
        setMessage(
          t('Opening print dialog for {file}…').replace(
            '{file}',
            isolate(getFileName(entry.filePath))
          )
        )
        const result = await printPdfFile({
          filePath: entry.filePath,
          toolId: toolRoute(entry.toolType),
          suggestedName: getFileName(entry.filePath),
          jobTitle: entry.projectName,
          silent: false
        })
        setMessage(
          result.ok
            ? t('Sent {file} to the printer.').replace(
                '{file}',
                isolate(result.pdfName ?? getFileName(entry.filePath))
              )
            : t(getPrintResultMessage(result, getFileName(entry.filePath)))
        )

        if (!result.ok) return

        const tool = exportToolToJobTool(entry.toolType)
        const existingJob = entry.projectId
          ? jobs.find((job) => job.id === entry.projectId)
          : undefined
        saveJob(
          createPrintedJob({
            existingJob,
            projectId: entry.projectId,
            tool,
            jobName: entry.projectName,
            pdfName: result.pdfName ?? getFileName(entry.filePath),
            pdfPath: entry.filePath,
            printerName: result.printerName
          })
        )
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Printing failed. Please try again.')
      } finally {
        printInProgress.current = false
        setPrintingId(null)
      }
    },
    [jobs, saveJob, t]
  )

  return (
    <div className="workspace-shell mx-auto max-w-[1400px]">
      <Card className="ui-glass-surface overflow-hidden">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-4 border-b bg-muted/25">
          <CardTitle>{t('Export Center')}</CardTitle>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw data-icon="inline-start" />
            {loading ? t('Refreshing…') : t('Refresh')}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t('Search exports')}</span>
              <Search
                className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground rtl:left-auto rtl:right-3"
                aria-hidden="true"
              />
              <Input
                type="search"
                className="ps-9 pe-3"
                placeholder={t('Search project, file, or tool')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              aria-label={t('Status')}
              className="h-[var(--ui-control-standard)] rounded-[var(--ui-radius-md)] border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">{t('All statuses')}</option>
              <option value="success">{t('Successful')}</option>
              <option value="failed">{t('Failed')}</option>
              <option value="canceled">{t('Canceled')}</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {loading
              ? t('Loading export history…')
              : t('{shown} of {total} exports')
                  .replace('{shown}', isolate(String(filteredEntries.length)))
                  .replace('{total}', isolate(String(entries.length)))}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('Local export history. Customer artwork is never copied into this log.')}
          </p>
          {message && (
            <p
              role="status"
              className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            >
              <bdi dir="auto">{t(message)}</bdi>
            </p>
          )}
          {!loading && filteredEntries.length === 0 && (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              <p>
                {t(
                  entries.length === 0
                    ? 'No exports yet. Export a project from Booklet, Cutter, or Hardcover to see it here.'
                    : 'No exports match your search or status filter.'
                )}
              </p>
              {entries.length > 0 && (
                <Button
                  variant="ghost"
                  className="mt-3"
                  onClick={() => {
                    setQuery('')
                    setStatus('all')
                  }}
                >
                  {t('Clear filters')}
                </Button>
              )}
            </div>
          )}
          <div className="divide-y divide-border">
            {filteredEntries.map((entry) => (
              <article key={entry.id} className="py-4 first:pt-1 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">
                        <bdi dir="auto">{entry.projectName}</bdi>
                      </h3>
                      <Badge
                        variant={
                          entry.status === 'success'
                            ? 'success'
                            : entry.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {t(
                          entry.status === 'success'
                            ? 'Successful'
                            : entry.status === 'failed'
                              ? 'Failed'
                              : 'Canceled'
                        )}
                      </Badge>
                      <Badge variant="outline">{entry.exportType}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        <bdi dir="auto">{t(entry.toolType)}</bdi>
                      </span>
                      <span>
                        <bdi dir="auto">{new Date(entry.timestamp).toLocaleString(language)}</bdi>
                      </span>
                      <span>
                        {t(
                          entry.warningsCount === 1 ? '{count} warning' : '{count} warnings'
                        ).replace('{count}', isolate(String(entry.warningsCount)))}
                      </span>
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      {entry.filePath ? (
                        <bdi dir="ltr">{entry.filePath}</bdi>
                      ) : (
                        <bdi dir="auto">{t(entry.error ?? 'No path recorded')}</bdi>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.filePath && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void runFileAction('open', entry.filePath!)}
                        >
                          <ExternalLink />
                          {t('Open File')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void runFileAction('folder', entry.filePath!)}
                        >
                          <FolderOpen />
                          {t('Open Folder')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void runFileAction('copy', entry.filePath!)}
                        >
                          <Clipboard />
                          {t('Copy Path')}
                        </Button>
                        {isPdfPath(entry.filePath) && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={printingId !== null}
                            onClick={() => void printExport(entry)}
                          >
                            <Printer />
                            {printingId === entry.id ? t('Printing…') : t('Print')}
                          </Button>
                        )}
                      </>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigate(toolRoute(entry.toolType))}
                    >
                      <RotateCcw />
                      {t('Open tool')}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function toolRoute(tool: string): AppRoute {
  const value = tool.toLowerCase()
  if (value.includes('card')) return 'card-montage'
  if (value.includes('cutter')) return 'cutter-montage'
  if (value.includes('sequential')) return 'sequential-number'
  if (value.includes('hardcover')) return 'hardcover-cover'
  return 'booklet-montage'
}

function exportToolToJobTool(tool: string): PrinterJobTool {
  const value = tool.toLowerCase()
  if (value.includes('cutter')) return 'cutter'
  if (value.includes('sequential')) return 'sequential'
  if (value.includes('hardcover')) return 'hardcover'
  return 'booklet'
}

function isPdfPath(filePath: string): boolean {
  return filePath.trim().toLowerCase().endsWith('.pdf')
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || 'export.pdf'
}

function isolate(value: string): string {
  return `\u2068${value}\u2069`
}
