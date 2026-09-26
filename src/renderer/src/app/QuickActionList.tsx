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
  'bg-blue-500/10 text-blue-600',
  'bg-violet-500/10 text-violet-600',
  'bg-emerald-500/10 text-emerald-600',
  'bg-amber-500/10 text-amber-600'
]

export function QuickActionList({ actions, onNavigate }: QuickActionListProps): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
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
            className="group flex min-h-[58px] items-center gap-3 rounded-lg border border-transparent p-2 text-left transition hover:border-primary/20 hover:bg-accent/60"
          >
            <div
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-xl',
                actionTones[index % actionTones.length]
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs font-semibold">{action.label}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {action.description}
              </span>
            </div>
            <ChevronRight
              className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              aria-hidden="true"
            />
          </button>
        )
      })}
    </div>
  )
}
