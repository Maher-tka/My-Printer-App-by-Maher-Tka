import { AlertTriangle, CheckCircle2, FileText, FolderOpen, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { PrinterAppProjectResult, RecentJob } from '@/types/projects'

interface RecentJobsTableProps {
  onOpenProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
}

export function RecentJobsTable({ onOpenProject }: RecentJobsTableProps): JSX.Element {
  const [jobs, setJobs] = useState<RecentJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadRecentJobs = useCallback(async (): Promise<void> => {
    if (!window.printerApp?.listRecentProjects) {
      setJobs([])
      setError('Recent projects are only available in the desktop app.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    const result = await window.printerApp.listRecentProjects()

    if (result.ok) {
      setJobs(result.jobs ?? [])
    } else {
      setError(result.error ?? 'Could not load recent projects.')
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    void loadRecentJobs()
  }, [loadRecentJobs])

  const openRecentJob = async (job: RecentJob): Promise<void> => {
    setOpeningPath(job.filePath)
    setError(null)
    const result = await onOpenProject(job.filePath)

    if (!result.ok && !result.canceled) {
      setError(result.error ?? 'Could not open that project.')
      await loadRecentJobs()
    }

    setOpeningPath(null)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
          <CardTitle>Recent Jobs</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => void loadRecentJobs()}
          disabled={isLoading}
        >
          <RefreshCw className={isLoading ? 'animate-spin' : undefined} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        {error && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && jobs.length === 0 ? (
          <div className="grid min-h-48 place-items-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
            <div>
              <FolderOpen className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="font-medium">No saved jobs yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Saved booklet and cutter projects will appear here.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Name</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Last Saved</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const isMissing = job.status === 'Missing'
                const StatusIcon = isMissing ? AlertTriangle : CheckCircle2

                return (
                  <TableRow key={job.filePath} title={job.summary}>
                    <TableCell>
                      <div className="max-w-64">
                        <p className="truncate font-medium">{job.jobName}</p>
                        <p className="truncate text-xs text-muted-foreground" title={job.filePath}>
                          {job.filePath}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{job.tool}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatProjectDate(job.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isMissing ? 'warning' : 'success'} className="gap-1.5">
                        <StatusIcon className="size-3.5" aria-hidden="true" />
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => void openRecentJob(job)}
                        disabled={openingPath !== null}
                      >
                        <FolderOpen />
                        {openingPath === job.filePath ? 'Opening' : 'Open'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function formatProjectDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}
