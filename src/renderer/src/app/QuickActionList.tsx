import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppRoute } from '@/types/navigation'

interface QuickAction {
  label: string
  description: string
  icon: LucideIcon
  route?: AppRoute
  onClick?: () => void
}

interface QuickActionListProps {
  actions: QuickAction[]
  onNavigate: (route: AppRoute) => void
}

const actionTones = [
  'bg-primary/10 text-primary',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700'
]

export function QuickActionList({
  actions,
  onNavigate
}: QuickActionListProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {actions.map((action, index) => {
        const Icon = action.icon

        return (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              if (action.onClick) {
                action.onClick()
              } else if (action.route) {
                onNavigate(action.route)
              }
            }}
            className="flex min-h-[88px] items-center gap-4 rounded-lg border bg-card p-3 text-left transition hover:bg-accent"
          >
            <div
              className={cn(
                'grid size-16 shrink-0 place-items-center rounded-lg',
                actionTones[index]
              )}
            >
              <Icon className="size-8" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-semibold">{action.label}</span>
              <span className="text-sm text-muted-foreground">
                {action.description}
              </span>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
