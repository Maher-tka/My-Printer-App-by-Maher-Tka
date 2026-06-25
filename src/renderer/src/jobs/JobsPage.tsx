import { Clipboard, FolderOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useJobStore } from './useJobStore'
import type { JobQuote, PrinterJob, PrinterJobStatus, PrinterJobTool } from './jobTypes'

const STATUS_OPTIONS: Array<{ value: PrinterJobStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'waiting-customer-approval', label: 'Waiting customer approval' },
  { value: 'ready-to-print', label: 'Ready to print' },
  { value: 'printing', label: 'Printing' },
  { value: 'printed', label: 'Printed' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'canceled', label: 'Canceled' }
]

export function JobsPage(): JSX.Element {
  const { jobs, saveJob, deleteJob } = useJobStore()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | PrinterJobStatus>('all')
  const [draft, setDraft] = useState<PrinterJob>(() => createEmptyJob())
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return jobs.filter(
      (job) =>
        (status === 'all' || job.status === status) &&
        (!needle ||
          job.customerName.toLowerCase().includes(needle) ||
          job.jobTitle.toLowerCase().includes(needle) ||
          job.phoneNumber.toLowerCase().includes(needle))
    )
  }, [jobs, query, status])
  const quote = calculateJobQuote(draft.quote)

  const updateQuote = (key: keyof JobQuote, value: number): void => {
    const next = calculateJobQuote({ ...draft.quote, [key]: value })
    setDraft((current) => ({ ...current, quote: next }))
  }

  const saveDraft = (): void => {
    if (!draft.jobTitle.trim()) return
    saveJob({
      ...draft,
      quote,
      customerName: draft.customerName.trim(),
      jobTitle: draft.jobTitle.trim()
    })
    setDraft(createEmptyJob())
  }

  return (
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 2xl:grid-cols-[480px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>New shop job + quote</CardTitle>
          <CardDescription>
            Local-only customer, deadline, pricing, and project links.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Customer"
              value={draft.customerName}
              onChange={(customerName) => setDraft((current) => ({ ...current, customerName }))}
            />
            <TextInput
              label="Phone"
              value={draft.phoneNumber}
              onChange={(phoneNumber) => setDraft((current) => ({ ...current, phoneNumber }))}
            />
            <TextInput
              label="Job title"
              value={draft.jobTitle}
              onChange={(jobTitle) => setDraft((current) => ({ ...current, jobTitle }))}
            />
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Tool
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={draft.tool}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    tool: event.target.value as PrinterJobTool
                  }))
                }
              >
                <option value="booklet">Booklet</option>
                <option value="cutter">Cutter</option>
                <option value="hardcover">Hardcover</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Status
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as PrinterJobStatus
                  }))
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <TextInput
              label="Deadline"
              type="date"
              value={draft.deadline ?? ''}
              onChange={(deadline) => setDraft((current) => ({ ...current, deadline }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {(
              [
                ['materialCost', 'Material'],
                ['printCost', 'Print'],
                ['cuttingCost', 'Cutting'],
                ['bindingCost', 'Binding'],
                ['designFee', 'Design'],
                ['quantity', 'Quantity'],
                ['discount', 'Discount'],
                ['depositPaid', 'Deposit']
              ] as Array<[keyof JobQuote, string]>
            ).map(([key, label]) => (
              <NumberInput
                key={key}
                label={label}
                value={Number(draft.quote[key] ?? 0)}
                onChange={(value) => updateQuote(key, value)}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-md bg-muted p-3 text-sm">
            <span>
              Total <b>{quote.finalPrice.toFixed(2)}</b>
            </span>
            <span>
              Deposit <b>{quote.depositPaid.toFixed(2)}</b>
            </span>
            <span>
              Remaining <b>{quote.remainingAmount.toFixed(2)}</b>
            </span>
          </div>
          <textarea
            className="min-h-20 rounded-md border bg-background p-3 text-sm"
            placeholder="Production notes"
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveDraft} disabled={!draft.jobTitle.trim()}>
              <Plus data-icon="inline-start" />
              Save job
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(createWhatsAppQuote(draft, quote))}
            >
              <Clipboard data-icon="inline-start" />
              Copy WhatsApp quote
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shop job tracker</CardTitle>
          <CardDescription>
            {jobs.length} local job(s). Search by customer, phone, or title.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            <label className="relative min-w-64 flex-1">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
                placeholder="Search jobs"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-3">
            {filtered.length === 0 && (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No matching jobs.
              </p>
            )}
            {filtered.map((job) => (
              <article key={job.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{job.jobTitle}</h3>
                      <Badge variant={job.status === 'ready-to-print' ? 'success' : 'secondary'}>
                        {statusLabel(job.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {job.customerName || 'No customer'} · {job.phoneNumber || 'No phone'} ·{' '}
                      {job.tool}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Deadline: {job.deadline || 'Not set'} · Remaining:{' '}
                      {job.quote.remainingAmount.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDraft(structuredClone(job))}
                    >
                      <Pencil />
                      Edit
                    </Button>
                    {job.localProjectPath && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void window.printerApp?.runtime.openPath(job.localProjectPath!)
                        }
                      >
                        <FolderOpen />
                        Project
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteJob(job.id)}
                    >
                      <Trash2 />
                      Delete
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

export function calculateJobQuote(quote: JobQuote): JobQuote {
  const quantity = Math.max(1, Number(quote.quantity) || 1)
  const unitCost =
    Math.max(0, quote.materialCost) +
    Math.max(0, quote.printCost) +
    Math.max(0, quote.finishingCost ?? 0) +
    Math.max(0, quote.designCost ?? 0) +
    Math.max(0, quote.cuttingCost ?? 0) +
    Math.max(0, quote.bindingCost ?? 0) +
    Math.max(0, quote.designFee ?? 0)
  const finalPrice = Math.max(0, unitCost * quantity - Math.max(0, quote.discount))
  const depositPaid = Math.max(0, quote.depositPaid)
  return {
    ...quote,
    quantity,
    finalPrice,
    depositPaid,
    remainingAmount: Math.max(0, finalPrice - depositPaid)
  }
}

function createWhatsAppQuote(job: PrinterJob, quote: JobQuote): string {
  return [
    `Customer: ${job.customerName || '-'}`,
    `Job: ${job.jobTitle || '-'}`,
    `Quantity: ${quote.quantity}`,
    `Total: ${quote.finalPrice.toFixed(2)}`,
    `Deposit: ${quote.depositPaid.toFixed(2)}`,
    `Remaining: ${quote.remainingAmount.toFixed(2)}`,
    `Deadline: ${job.deadline || '-'}`
  ].join('\n')
}

function statusLabel(status: PrinterJobStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text'
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        className="h-10 rounded-md border bg-background px-3 text-sm"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function NumberInput({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        className="h-10 rounded-md border bg-background px-3 text-sm"
        type="number"
        min={0}
        step={label === 'Quantity' ? 1 : 0.1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
