import { LoaderCircle, Printer } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'

export function PrintButton({
  label,
  disabled,
  isBusy,
  onPrint,
  compact = false
}: {
  label: string
  disabled?: boolean
  isBusy?: boolean
  onPrint: () => void
  compact?: boolean
}): JSX.Element {
  const isAvailable = Boolean(window.printerApp?.printPdf)
  const descriptionId = useId()
  const description = isAvailable
    ? 'Printing opens your printer driver dialog. Check paper size, duplex, and scale before printing.'
    : 'Printing is available in the desktop app. Export a PDF to print from this browser.'
  return (
    <div
      className={
        compact
          ? 'inline-flex'
          : 'rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-secondary/70 p-3'
      }
      title={description}
    >
      <Button
        type="button"
        onClick={onPrint}
        disabled={disabled || isBusy || !isAvailable}
        aria-busy={isBusy}
        aria-describedby={descriptionId}
      >
        {isBusy ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Printer data-icon="inline-start" />
        )}
        {isBusy ? 'Preparing print…' : label}
      </Button>
      <p id={descriptionId} className={compact ? 'sr-only' : 'mt-2 text-xs text-muted-foreground'}>
        {description}
      </p>
    </div>
  )
}
