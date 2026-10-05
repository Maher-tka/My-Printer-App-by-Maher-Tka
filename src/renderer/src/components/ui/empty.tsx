import { useLanguage } from '@/i18n/useLanguage'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function Empty({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className
}: EmptyProps): JSX.Element {
  const { t } = useLanguage()

  return (
    <div
      className={cn(
        'grid min-h-48 place-items-center rounded-[var(--ui-radius-lg)] border border-dashed bg-secondary/60 p-6',
        className
      )}
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="grid size-10 place-items-center rounded-full bg-card text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{t(description)}</p>
        </div>
        {actionLabel && (
          <Button onClick={onAction} type="button">
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
