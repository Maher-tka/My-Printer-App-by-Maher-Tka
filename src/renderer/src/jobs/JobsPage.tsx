import { useLanguage } from '@/i18n/useLanguage'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { CustomerDatabase } from '@/customers/CustomerDatabase'
import { findCustomerJobs } from '@/assistant/taskMatching'
import { useCustomerStore } from '@/customers/useCustomerStore'
import { calculateJobQuote } from './jobQuote'
export { calculateJobQuote } from './jobQuote'
import { JobBoard } from './JobBoard'
import { JobCalendar } from './JobCalendar'
import { JobEditorPanel } from './JobEditorPanel'
import { JobList } from './JobList'
import { JobsWorkspaceHeader, type JobsView } from './JobsWorkspaceHeader'
import { getDeadlineState, statusLabel } from './jobWorkflow'
import { useJobStore } from './useJobStore'
import type { JobOpenRequest, JobQuote, PrinterJob, PrinterJobStatus } from './jobTypes'

export function JobsPage({ openRequest }: { openRequest?: JobOpenRequest | null }): JSX.Element {
  const { t } = useLanguage()

  const { jobs, saveJob, deleteJob } = useJobStore()
  const { customers, saveCustomer } = useCustomerStore()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | PrinterJobStatus>('all')
  const [view, setView] = useState<JobsView>('board')
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [draft, setDraft] = useState<PrinterJob>(() => createEmptyJob())
  const draftBaseline = useRef(draft)
  const handledOpenRequest = useRef<JobOpenRequest | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingJob, setPendingJob] = useState<PrinterJob | null>(null)
  const deferredQuery = useDeferredValue(query)
  const isEditing = jobs.some((job) => job.id === draft.id)

  const openJobDetails = useCallback((job: PrinterJob): void => {
    const next = structuredClone(job)
    draftBaseline.current = next
    setDraft(next)
    setView((current) => (current === 'customers' ? 'board' : current))
    setMessage(`Editing ${job.jobTitle}.`)
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      editorRef.current?.focus({ preventScroll: true })
    })
  }, [])

  useEffect(() => {
    if (!openRequest || handledOpenRequest.current === openRequest) return
    handledOpenRequest.current = openRequest
    const job = jobs.find((item) => item.id === openRequest.jobId)
    if (!job) {
      setMessage('This job is no longer available. It may have been deleted.')
      return
    }
    setView((current) => (current === 'customers' ? 'board' : current))
    if (job.id === draft.id) return
    if (JSON.stringify(draft) !== JSON.stringify(draftBaseline.current)) {
      setPendingJob(job)
    } else {
      openJobDetails(job)
    }
  }, [openRequest, jobs, draft, openJobDetails])

  const resetDraft = (): void => {
    const next = createEmptyJob()
    draftBaseline.current = next
    setDraft(next)
  }

  const filteredJobs = useMemo(() => {
    const matching = deferredQuery.trim() ? findCustomerJobs(jobs, deferredQuery) : jobs
    return matching.filter((job) => status === 'all' || job.status === status)
  }, [deferredQuery, jobs, status])

  const quote = calculateJobQuote(draft.quote)
  const overdueCount = jobs.filter((job) => getDeadlineState(job) === 'overdue').length
  const dueTodayCount = jobs.filter((job) => getDeadlineState(job) === 'today').length

  const updateQuote = (key: keyof JobQuote, value: number): void => {
    setDraft((current) => ({
      ...current,
      quote: calculateJobQuote({ ...current.quote, [key]: value })
    }))
  }

  const saveDraft = (): void => {
    if (!draft.jobTitle.trim()) return

    const now = new Date().toISOString()
    let customerId = draft.customerId

    if (draft.customerName.trim()) {
      const existing =
        customers.find((customer) => customer.id === customerId) ??
        customers.find(
          (customer) =>
            Boolean(draft.phoneNumber.trim()) && customer.phone === draft.phoneNumber.trim()
        )
      customerId = existing?.id ?? `customer-${crypto.randomUUID()}`
      saveCustomer({
        id: customerId,
        name: draft.customerName.trim(),
        phone: draft.phoneNumber.trim(),
        email: existing?.email,
        company: existing?.company,
        address: existing?.address,
        notes: existing?.notes,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      })
    } else {
      customerId = undefined
    }

    const nextTitle = draft.jobTitle.trim()
    saveJob({
      ...draft,
      customerId,
      quote,
      customerName: draft.customerName.trim(),
      phoneNumber: draft.phoneNumber.trim(),
      jobTitle: nextTitle
    })
    resetDraft()
    setMessage(isEditing ? `Updated ${nextTitle}.` : `Saved ${nextTitle}.`)
  }

  const editJob = (job: PrinterJob): void => {
    if (job.id === draft.id) return
    if (JSON.stringify(draft) !== JSON.stringify(draftBaseline.current)) {
      setPendingJob(job)
    } else {
      openJobDetails(job)
    }
  }

  const changeStatus = (job: PrinterJob, nextStatus: PrinterJobStatus): void => {
    saveJob({ ...job, status: nextStatus })
    setDraft((current) => (current.id === job.id ? { ...current, status: nextStatus } : current))
    if (draftBaseline.current.id === job.id)
      draftBaseline.current = { ...draftBaseline.current, status: nextStatus }
    setMessage(`${job.jobTitle} moved to ${statusLabel(nextStatus)}.`)
  }

  const removeJob = (job: PrinterJob): void => {
    deleteJob(job.id)
    if (draft.id === job.id) resetDraft()
    setMessage(`Deleted ${job.jobTitle}.`)
  }

  const cancelEditing = (): void => {
    resetDraft()
    setMessage('Editing canceled.')
  }

  const header = (
    <JobsWorkspaceHeader
      view={view}
      onViewChange={setView}
      jobCount={jobs.length}
      overdueCount={overdueCount}
      dueTodayCount={dueTodayCount}
    />
  )

  if (view === 'customers') {
    return (
      <div className="workspace-shell mx-auto flex max-w-[1500px] flex-col gap-5">
        {header}
        <Card>
          <CardHeader className="border-b bg-muted/25">
            <CardTitle>{t('Customer database')}</CardTitle>
            <CardDescription>
              {t(
                'Customer details, order history, and outstanding balances stay on this computer.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <CustomerDatabase jobs={jobs} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="workspace-shell mx-auto flex max-w-[1600px] flex-col gap-5">
      {header}
      <AlertDialog
        open={Boolean(pendingJob)}
        onOpenChange={(open) => {
          if (!open) setPendingJob(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keep your unsaved job details?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Opening “{pendingJob?.jobTitle}” will discard those changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Keep editing')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const job = jobs.find((item) => item.id === pendingJob?.id)
                if (job) openJobDetails(job)
                else setMessage('This job is no longer available. Your draft has been kept.')
              }}
            >
              Discard and open job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[460px_minmax(0,1fr)]">
        <div
          ref={editorRef}
          tabIndex={-1}
          aria-label="Job details"
          className="min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <JobEditorPanel
            draft={draft}
            quote={quote}
            customers={customers}
            isEditing={isEditing}
            message={message}
            onDraftChange={setDraft}
            onQuoteChange={updateQuote}
            onSave={saveDraft}
            onCancelEdit={cancelEditing}
            onCopyQuote={() => void copyQuote(draft, quote, setMessage)}
          />
        </div>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b bg-muted/25">
            <CardTitle>
              {view === 'board'
                ? 'Production board'
                : view === 'calendar'
                  ? 'Deadline calendar'
                  : 'Shop job list'}
            </CardTitle>
            <CardDescription>
              {jobs.length} local jobs · {overdueCount} overdue · {dueTodayCount} due today
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {view === 'board' ? (
              <JobBoard jobs={jobs} onEdit={editJob} onStatusChange={changeStatus} />
            ) : view === 'calendar' ? (
              <JobCalendar
                jobs={jobs}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                onEdit={editJob}
              />
            ) : (
              <JobList
                jobs={filteredJobs}
                query={query}
                status={status}
                onQueryChange={setQuery}
                onStatusChange={setStatus}
                onEdit={editJob}
                onDelete={removeJob}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function createEmptyJob(): PrinterJob {
  const now = new Date().toISOString()
  return {
    id: `job-${crypto.randomUUID()}`,
    tool: 'booklet',
    customerName: '',
    phoneNumber: '',
    jobTitle: '',
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    notes: '',
    exportPaths: [],
    quote: calculateJobQuote({
      materialCost: 0,
      printCost: 0,
      finishingCost: 0,
      designCost: 0,
      cuttingCost: 0,
      bindingCost: 0,
      designFee: 0,
      quantity: 1,
      discount: 0,
      finalPrice: 0,
      depositPaid: 0,
      remainingAmount: 0
    })
  }
}

async function copyQuote(
  job: PrinterJob,
  quote: JobQuote,
  setMessage: (message: string) => void
): Promise<void> {
  const text = [
    `Customer: ${job.customerName || '-'}`,
    `Job: ${job.jobTitle || '-'}`,
    `Quantity: ${quote.quantity}`,
    `Total: ${quote.finalPrice.toFixed(2)}`,
    `Deposit: ${quote.depositPaid.toFixed(2)}`,
    `Remaining: ${quote.remainingAmount.toFixed(2)}`,
    `Deadline: ${job.deadline || '-'}`
  ].join('\n')

  try {
    await navigator.clipboard.writeText(text)
    setMessage('Quote copied and ready to paste into WhatsApp.')
  } catch {
    setMessage('The quote could not be copied. Please retry.')
  }
}
