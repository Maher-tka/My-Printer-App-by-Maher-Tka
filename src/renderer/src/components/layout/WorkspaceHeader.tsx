import { ArrowLeft, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface WorkspaceHeaderProps {
  title: string
  description: string
  icon: LucideIcon
  onBack: () => void
  children?: ReactNode
}

export function WorkspaceHeader({
  title,
  description,
  icon: Icon,
  onBack,
  children
}: WorkspaceHeaderProps): JSX.Element {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onBack}
          aria-label="Back to dashboard"
          title="Back to dashboard"
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <span className="hidden size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary sm:flex">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children && <div className="min-w-0 max-w-full">{children}</div>}
    </header>
  )
}
