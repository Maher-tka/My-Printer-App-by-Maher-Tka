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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  const { t } = useLanguage()

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
        setMessage(`Opening print dialog for ${getFileName(entry.filePath)}...`)
        const result = await printPdfFile({
          filePath: entry.filePath,
          toolId: toolRoute(entry.toolType),
          suggestedName: getFileName(entry.filePath),
          jobTitle: entry.projectName,
          silent: false
        })
        setMessage(getPrintResultMessage(result, getFileName(entry.filePath)))

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
    [jobs, saveJob]
  )

  return (
    <div className="workspace-shell mx-auto max-w-[1400px]">
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-start justify-between gap-4 border-b bg-muted/25">
          <div>
            <CardTitle>{t('Export Center')}</CardTitle>
            <CardDescription>
              {t('Local export history. Customer artwork is never copied into this log.')}
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw data-icon="inline-start" />
            {loading ? 'Refreshing…' : t('Refresh')}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t('Search exports')}</span>
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                type="search"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
                placeholder={t('Search project, file, or tool')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              aria-label="Filter exports by status"
              className="h-10 rounded-md border bg-background px-3 text-sm"
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
              ? 'Loading export history…'
              : `${filteredEntries.length} of ${entries.length} exports`}
          </p>
          {message && (
            <p
              role="status"
              className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            >
              {message}
            </p>
          )}
          {!loading && filteredEntries.length === 0 && (
            <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              {entries.length === 0
                ? 'No exports yet. Export a project from Booklet, Cutter, or Hardcover to see it here.'
                : 'No exports match your search or status filter.'}
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
            </p>
          )}
          {filteredEntries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-xl border bg-muted/15 p-4 transition-colors hover:bg-accent/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{entry.projectName}</h3>
                    <Badge
                      variant={
                        entry.status === 'success'
                          ? 'success'
                          : entry.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {entry.status}
                    </Badge>
                    <Badge variant="outline">{entry.exportType}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.toolType} · {new Date(entry.timestamp).toLocaleString()} ·{' '}
                    {entry.warningsCount} warning(s)
                  </p>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    {entry.filePath ?? entry.error ?? 'No path recorded'}
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
                          {printingId === entry.id ? 'Printing…' : t('Print')}
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
