import {
  BookOpen,
  Hash,
  FolderOpen,
  Pencil,
  PenLine,
  Search,
  SearchX,
  SquareStack,
  Trash2
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { getDeadlineState, JOB_STATUS_OPTIONS, statusLabel } from './jobWorkflow'
import type { PrinterJob, PrinterJobStatus, PrinterJobTool } from './jobTypes'

const toolIcons: Record<PrinterJobTool, ComponentType<{ className?: string }>> = {
  booklet: BookOpen,
  cutter: PenLine,
  hardcover: SquareStack,
  sequential: Hash
}

interface JobListProps {
  jobs: PrinterJob[]
  query: string
  status: 'all' | PrinterJobStatus
  onQueryChange: (query: string) => void
  onStatusChange: (status: 'all' | PrinterJobStatus) => void
  onEdit: (job: PrinterJob) => void
  onDelete: (job: PrinterJob) => void
}

export function JobList({
  jobs,
  query,
  status,
  onQueryChange,
  onStatusChange,
  onEdit,
  onDelete
}: JobListProps): JSX.Element {
  const [pendingDelete, setPendingDelete] = useState<PrinterJob | null>(null)

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search jobs</span>
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by job, customer, or phone"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <Select value={status} onValueChange={(value) => onStatusChange(value as typeof status)}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filter jobs by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {JOB_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(query || status !== 'all') && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onQueryChange('')
              onStatusChange('all')
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      <p className="mb-3 text-xs text-muted-foreground" role="status">
        {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} shown
      </p>

      {jobs.length === 0 ? (
        <Empty
          icon={SearchX}
          title={query || status !== 'all' ? 'No matching jobs' : 'Your job list is ready'}
          description="Try another search or status filter. New jobs will appear here after you save them."
          className="min-h-64"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <JobListItem
              key={job.id}
              job={job}
              onEdit={onEdit}
              onDelete={() => setPendingDelete(job)}
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this shop job?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.jobTitle}” will be removed from the local job tracker. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep job</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete)
                setPendingDelete(null)
              }}
            >
              Delete job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function JobListItem({
  job,
  onEdit,
  onDelete
}: {
  job: PrinterJob
  onEdit: (job: PrinterJob) => void
  onDelete: () => void
}): JSX.Element {
  const [openError, setOpenError] = useState<string | null>(null)
  const deadline = getDeadlineState(job)
  const ToolIcon = toolIcons[job.tool]

  return (
    <article className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/35 hover:bg-accent/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <ToolIcon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold">{job.jobTitle}</h3>
              <Badge variant={job.status === 'ready-to-print' ? 'success' : 'secondary'}>
                {statusLabel(job.status)}
              </Badge>
              {deadline === 'overdue' ? <Badge variant="destructive">Overdue</Badge> : null}
              {deadline === 'today' ? <Badge variant="warning">Due today</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {job.customerName || 'No customer'} · {job.phoneNumber || 'No phone'}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Deadline: {job.deadline || 'Not set'}</span>
              <span>{job.exportPaths.length} exports</span>
              <span className="font-semibold text-foreground">
                Balance: {job.quote.remainingAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(job)}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
          {job.localProjectPath ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  if (!window.printerApp)
                    throw new Error('Open linked projects from the desktop app.')
                  const error = await window.printerApp.runtime.openPath(job.localProjectPath!)
                  setOpenError(error || null)
                } catch (error) {
                  setOpenError(
                    error instanceof Error
                      ? error.message
                      : 'The linked project could not be opened.'
                  )
                }
              }}
            >
              <FolderOpen aria-hidden="true" />
              Project
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>
      {openError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {openError}
        </p>
      )}
    </article>
  )
}
