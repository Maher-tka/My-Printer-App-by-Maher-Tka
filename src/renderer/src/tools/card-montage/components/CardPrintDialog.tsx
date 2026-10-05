import { useLanguage } from '@/i18n/useLanguage'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { CardPrintSide } from '../lib/printSetup'

const inputClass =
  'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function CardPrintDialog({
  open,
  onOpenChange,
  hasFront,
  hasBack,
  side,
  copies,
  error,
  onSideChange,
  onCopiesChange,
  onContinue
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasFront: boolean
  hasBack: boolean
  side: CardPrintSide
  copies: number
  error: string | null
  onSideChange: (side: CardPrintSide) => void
  onCopiesChange: (copies: number) => void
  onContinue: () => void
}): JSX.Element {
  const { t } = useLanguage()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Print cards')}</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {t('Choose sides and copies before opening printer settings.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="grid gap-2 text-sm font-medium">
          {t('Side')}
          <select
            className={inputClass}
            value={side}
            onChange={(event) => onSideChange(event.target.value as CardPrintSide)}
          >
            <option value="front" disabled={!hasFront}>
              {t('Front only')}
            </option>
            <option value="back" disabled={!hasBack}>
              {t('Back only')}
            </option>
            <option value="both" disabled={!hasFront || !hasBack}>
              {t('Both sides')}
            </option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          {t('Copies')}
          <input
            className={inputClass}
            type="number"
            min={1}
            max={999}
            step={1}
            value={Number.isFinite(copies) ? copies : ''}
            onChange={(event) =>
              onCopiesChange(event.target.value === '' ? NaN : Number(event.target.value))
            }
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
          <Button disabled={Boolean(error)} onClick={onContinue}>
            {t('Printer settings')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
