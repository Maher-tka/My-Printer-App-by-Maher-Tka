import { LoaderCircle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintButton({
  label,
  disabled,
  isBusy,
  onPrint
}: {
  label: string
  disabled?: boolean
  isBusy?: boolean
  onPrint: () => void
}): JSX.Element {
  const isAvailable = Boolean(window.printerApp?.printPdf)
  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
      <Button
        type="button"
        onClick={onPrint}
        disabled={disabled || isBusy || !isAvailable}
        aria-busy={isBusy}
      >
        {isBusy ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Printer data-icon="inline-start" />
        )}
        {isBusy ? 'Preparing print�' : label}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        {isAvailable
          ? 'Printing opens your printer driver dialog. Check paper size, duplex, and scale before printing.'
          : 'Printing is available in the desktop app. Export a PDF to print from this browser.'}
      </p>
    </div>
  )
}
