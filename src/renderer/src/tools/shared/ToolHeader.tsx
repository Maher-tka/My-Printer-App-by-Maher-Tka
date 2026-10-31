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
  backDisabled = false,
  backLabel = 'All tools',
  actions,
  exportPdf,
  output,
  print,
  className
}: {
  title: string
  projectName?: string
  onBack: () => void
  backDisabled?: boolean
  backLabel?: string
  actions?: ReactNode
  exportPdf?: { onExport: () => void; disabled?: boolean; isBusy?: boolean }
  output?: ReactNode
  print?: Omit<ComponentProps<typeof PrintButton>, 'compact' | 'label' | 'variant'>
  className?: string
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <header
      className={cn(
        'ui-glass-surface grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-[var(--ui-radius-lg)] border p-4',
        className
      )}
      data-tool-header
    >
      <div className="min-w-0 sm:row-span-2" dir="auto">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={backDisabled}>
          <ArrowLeft aria-hidden="true" />
          {t(backLabel)}
        </Button>
        <h1 className="mt-1 min-w-0 break-words text-lg font-semibold tracking-tight">
          {t(title)}
        </h1>
        {projectName && (
          <p className="mt-1 break-words text-xs text-muted-foreground">{projectName}</p>
        )}
      </div>
      <div
        className="flex min-w-0 max-w-full flex-col items-end justify-self-end gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-end"
        role="group"
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
        {output}
        {print && <PrintButton {...print} compact label={t('Print')} />}
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
