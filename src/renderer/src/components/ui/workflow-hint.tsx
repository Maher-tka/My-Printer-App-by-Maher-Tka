import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/i18n/useLanguage'

export function WorkflowHint({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): JSX.Element {
  const { t } = useLanguage()
  return (
    <p
      className={cn('flex items-start gap-2 text-xs leading-5 text-muted-foreground', className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <ArrowRight className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{typeof children === 'string' ? t(children) : children}</span>
    </p>
  )
}
