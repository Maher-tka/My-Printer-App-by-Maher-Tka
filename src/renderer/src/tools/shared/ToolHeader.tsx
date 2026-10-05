import { useLanguage } from '@/i18n/useLanguage'
import type { ComponentProps, ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PrintButton } from '@/print/PrintButton'
import { cn } from '@/lib/utils'
import { ActionButton } from '@/components/ui/action-button'

export function ToolHeader({
  title,
  projectName,
  onBack,
  backLabel = 'All tools',
  actions,
  exportPdf,
  print,
  className
}: {
  title: string
  projectName?: string
  onBack: () => void
  backLabel?: string
  actions?: ReactNode
  exportPdf?: { onExport: () => void; disabled?: boolean; isBusy?: boolean }
  print: Omit<ComponentProps<typeof PrintButton>, 'compact' | 'label' | 'variant'>
  className?: string
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <header
      dir="ltr"
      className={cn(
        'grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4',
        className
      )}
      data-tool-header
    >
      <div className="min-w-0 sm:row-span-2" dir="auto">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {t(backLabel)}
        </Button>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">{t(title)}</h1>
        {projectName && <p className="mt-1 text-xs text-muted-foreground">{projectName}</p>}
      </div>
      <div
        className="flex flex-col items-end justify-self-end gap-2 sm:flex-row sm:items-start"
        aria-label={t('Output actions')}
      >
        {exportPdf && (
          <div className="order-2 sm:order-none">
            <ActionButton
              action="export"
              disabled={exportPdf.disabled}
              isBusy={exportPdf.isBusy}
              busyLabel="Creating PDF…"
              onClick={exportPdf.onExport}
            />
          </div>
        )}
        <PrintButton {...print} compact label={t('Print')} />
      </div>
      {actions && (
        <div
          className="col-span-2 flex min-w-0 flex-wrap items-start justify-end gap-2 sm:col-span-1 sm:col-start-2"
          dir="auto"
        >
          {actions}
        </div>
      )}
    </header>
  )
}
