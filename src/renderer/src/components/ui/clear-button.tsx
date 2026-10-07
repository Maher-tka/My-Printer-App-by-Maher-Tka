import { useLanguage } from '@/i18n/useLanguage'
import { useRef } from 'react'
import { ActionButton } from './action-button'
import { buttonVariants } from './button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from './alert-dialog'

export function ClearButton({
  onClear,
  disabled = false
}: {
  onClear: () => void
  disabled?: boolean
}): JSX.Element {
  const { t } = useLanguage()
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <ActionButton ref={triggerRef} action="clear" size="sm" disabled={disabled} />
      </AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (!triggerRef.current?.disabled) return
          const fallback = triggerRef.current
            .closest('[data-tool-header]')
            ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
          if (fallback) {
            event.preventDefault()
            fallback.focus({ preventScroll: true })
          }
        }}
      >
        <AlertDialogHeader className="text-start sm:text-start">
          <AlertDialogTitle>{t('Clear workspace?')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'Remove the current artwork, pages, and canvas items? Tool settings and saved files are kept.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction asChild className={buttonVariants({ variant: 'destructive' })}>
            <ActionButton
              action="clear"
              variant="destructive"
              disabled={disabled}
              onClick={onClear}
            />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
