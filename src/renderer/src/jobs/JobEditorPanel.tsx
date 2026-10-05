import { useLanguage } from '@/i18n/useLanguage'
import { Clipboard, PencilLine, Plus, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import type { ShopCustomer } from '@/customers/customerTypes'
import { JOB_STATUS_OPTIONS } from './jobWorkflow'
import type { JobQuote, PrinterJob, PrinterJobStatus, PrinterJobTool } from './jobTypes'

const NEW_CUSTOMER_VALUE = '__new_customer__'

interface JobEditorPanelProps {
  draft: PrinterJob
  quote: JobQuote
  customers: ShopCustomer[]
  isEditing: boolean
  message: string | null
  onDraftChange: (draft: PrinterJob) => void
  onQuoteChange: (key: keyof JobQuote, value: number) => void
  onSave: () => void
  onCancelEdit: () => void
  onCopyQuote: () => void
}

export function JobEditorPanel({
  draft,
  quote,
  customers,
  isEditing,
  message,
  onDraftChange,
  onQuoteChange,
  onSave,
  onCancelEdit,
  onCopyQuote
}: JobEditorPanelProps): JSX.Element {
  const { t } = useLanguage()

  const updateDraft = <Key extends keyof PrinterJob>(key: Key, value: PrinterJob[Key]): void => {
    onDraftChange({ ...draft, [key]: value })
  }

  const selectCustomer = (customerId: string): void => {
    const customer = customers.find((item) => item.id === customerId)
    onDraftChange({
      ...draft,
      customerId: customer?.id,
      customerName: customer?.name ?? '',
      phoneNumber: customer?.phone ?? ''
    })
  }

  return (
    <Card className="h-fit overflow-hidden">
      <CardHeader className="border-b bg-muted/25">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg border bg-card text-primary shadow-sm">
            {isEditing ? (
              <PencilLine className="size-5" aria-hidden="true" />
            ) : (
              <Plus className="size-5" aria-hidden="true" />
            )}
          </div>
          <div>
            <CardTitle>{isEditing ? 'Edit shop job' : 'Create shop job'}</CardTitle>
            <CardDescription className="mt-1.5">
              Customer, deadline, pricing, and production details are saved locally.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 p-5">
        <FieldSet className="gap-4">
          <FieldLegend>{t('Customer and production')}</FieldLegend>
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field className="gap-2 sm:col-span-2">
              <FieldLabel htmlFor="job-saved-customer">{t('Saved customer')}</FieldLabel>
              <Select value={draft.customerId ?? NEW_CUSTOMER_VALUE} onValueChange={selectCustomer}>
                <SelectTrigger id="job-saved-customer">
                  <SelectValue placeholder={t('Choose a saved customer')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_CUSTOMER_VALUE}>
                    {t('New or unlinked customer')}
                  </SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.phone ? ` — ${customer.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <TextField
              id="job-customer"
              label={t('Customer name')}
              value={draft.customerName}
              autoComplete="name"
              onChange={(value) => updateDraft('customerName', value)}
            />
            <TextField
              id="job-phone"
              label={t('Phone number')}
              value={draft.phoneNumber}
              type="tel"
              autoComplete="tel"
              onChange={(value) => updateDraft('phoneNumber', value)}
            />
            <TextField
              id="job-title"
              label={t('Job title (required)')}
              required
              value={draft.jobTitle}
              className="sm:col-span-2"
              placeholder={t('Example: 200 wedding invitations')}
              onChange={(value) => updateDraft('jobTitle', value)}
            />

            <Field className="gap-2">
              <FieldLabel htmlFor="job-tool">{t('Production tool')}</FieldLabel>
              <Select
                value={draft.tool}
                onValueChange={(value) => updateDraft('tool', value as PrinterJobTool)}
              >
                <SelectTrigger id="job-tool">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="booklet">{t('Booklet')}</SelectItem>
                  <SelectItem value="cutter">{t('Cutter')}</SelectItem>
                  <SelectItem value="hardcover">{t('Hardcover')}</SelectItem>
                  <SelectItem value="sequential">{t('Sequential Number')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field className="gap-2">
              <FieldLabel htmlFor="job-status">{t('Status')}</FieldLabel>
              <Select
                value={draft.status}
                onValueChange={(value) => updateDraft('status', value as PrinterJobStatus)}
              >
                <SelectTrigger id="job-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <TextField
              id="job-deadline"
              label={t('Deadline')}
              type="date"
              value={draft.deadline ?? ''}
              onChange={(value) => updateDraft('deadline', value || undefined)}
            />
            <TextField
              id="job-project-path"
              label={t('Linked project path')}
              value={draft.localProjectPath ?? ''}
              placeholder={t('Optional local project file')}
              onChange={(value) => updateDraft('localProjectPath', value || undefined)}
            />
          </FieldGroup>
        </FieldSet>

        <Separator />

        <FieldSet className="gap-4">
          <div className="flex items-center justify-between gap-3">
            <FieldLegend className="mb-0">{t('Quote and payment')}</FieldLegend>
            <ReceiptText className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-xs text-muted-foreground">
            Costs and fees are per item. Discount and deposit apply to the whole order.
          </p>
          <FieldGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ['materialCost', 'Material'],
                ['printCost', 'Print'],
                ['finishingCost', 'Finishing'],
                ['designCost', 'Design cost'],
                ['cuttingCost', 'Cutting'],
                ['bindingCost', 'Binding'],
                ['designFee', 'Design fee'],
                ['quantity', 'Quantity'],
                ['discount', 'Discount'],
                ['depositPaid', 'Deposit']
              ] as Array<[keyof JobQuote, string]>
            ).map(([key, label]) => (
              <NumberField
                key={key}
                id={`job-quote-${key}`}
                label={t(label)}
                value={Number(draft.quote[key] ?? 0)}
                step={key === 'quantity' ? 1 : 0.01}
                min={key === 'quantity' ? 1 : 0}
                onChange={(value) => onQuoteChange(key, value)}
              />
            ))}
          </FieldGroup>
        </FieldSet>

        <div className="grid grid-cols-3 overflow-hidden rounded-lg border bg-muted/25">
          <QuoteMetric label={t('Total')} value={quote.finalPrice} />
          <QuoteMetric label={t('Deposit')} value={quote.depositPaid} className="border-x" />
          <QuoteMetric label={t('Remaining')} value={quote.remainingAmount} emphasized />
        </div>

        <Field className="gap-2">
          <FieldLabel htmlFor="job-notes">{t('Production notes')}</FieldLabel>
          <Textarea
            id="job-notes"
            className="min-h-24 resize-y"
            placeholder={t('Finishing, delivery, or customer instructions')}
            value={draft.notes}
            onChange={(event) => updateDraft('notes', event.target.value)}
          />
        </Field>

        <div className="flex flex-wrap gap-2 border-t pt-5">
          <Button type="button" onClick={onSave} disabled={!draft.jobTitle.trim()}>
            <Plus aria-hidden="true" />
            {isEditing ? 'Update job' : 'Save job'}
          </Button>
          {isEditing ? (
            <Button type="button" variant="outline" onClick={onCancelEdit}>
              {t('Cancel editing')}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onCopyQuote}>
            <Clipboard aria-hidden="true" />
            {t('Copy quote')}
          </Button>
        </div>

        {message ? (
          <p
            aria-live="polite"
            className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          >
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  className,
  ...inputProps
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
} & Omit<React.ComponentProps<typeof Input>, 'id' | 'value' | 'onChange'>): JSX.Element {
  const { t } = useLanguage()

  return (
    <Field className={`gap-2 ${className ?? ''}`}>
      <FieldLabel htmlFor={id}>{t(label)}</FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
    </Field>
  )
}

function NumberField({
  id,
  label,
  value,
  step,
  min,
  onChange
}: {
  id: string
  label: string
  value: number
  step: number
  min: number
  onChange: (value: number) => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id}>{t(label)}</FieldLabel>
      <Input
        id={id}
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  )
}

function QuoteMetric({
  label,
  value,
  emphasized = false,
  className = ''
}: {
  label: string
  value: number
  emphasized?: boolean
  className?: string
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <div className={`min-w-0 px-3 py-3 text-center ${className}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {t(label)}
      </p>
      <p className={`mt-1 truncate text-sm font-bold ${emphasized ? 'text-primary' : ''}`}>
        {value.toFixed(2)}
      </p>
    </div>
  )
}
