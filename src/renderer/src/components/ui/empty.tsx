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
  return (
    <div
      className={cn(
        'grid min-h-72 place-items-center rounded-lg border border-dashed bg-muted/45 p-8',
        className
      )}
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-lg border bg-card text-primary shadow-sm">
          <Icon className="size-7" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
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
