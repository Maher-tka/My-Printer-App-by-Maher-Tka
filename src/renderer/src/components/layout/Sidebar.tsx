import {
  BookOpen,
  Activity,
  BriefcaseBusiness,
  ContactRound,
  Home,
  PenLine,
  FlaskConical,
  History,
  Settings,
  ShieldCheck,
  SquareStack
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { AppRoute } from '@/types/navigation'

interface SidebarProps {
  activeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
  isDeveloperMode?: boolean
}

const navItems = [
  { route: 'dashboard' as const, label: 'Dashboard', icon: Home },
  { route: 'booklet-montage' as const, label: 'Booklet Montage', icon: BookOpen },
  {
    route: 'hardcover-cover' as const,
    label: 'Hardcover Cover Sheet',
    icon: SquareStack
  },
  { route: 'cutter-montage' as const, label: 'Cutter Montage', icon: PenLine },
  { route: 'jobs' as const, label: 'Shop Jobs', icon: BriefcaseBusiness },
  { route: 'exports' as const, label: 'Export Center', icon: History },
  { route: 'app-health' as const, label: 'App Health', icon: Activity },
  { route: 'license' as const, label: 'License', icon: ShieldCheck },
  { route: 'settings' as const, label: 'Settings', icon: Settings }
]

export function Sidebar({
  activeRoute,
  onNavigate,
  isDeveloperMode = false
}: SidebarProps): JSX.Element {
  const visibleNavItems = isDeveloperMode
    ? [...navItems, { route: 'quality-lab' as const, label: 'Quality Lab', icon: FlaskConical }]
    : navItems
  return (
    <aside className="flex w-[72px] shrink-0 flex-col bg-sidebar text-sidebar-foreground shadow-sidebar xl:w-[248px] 2xl:w-[264px]">
      <div className="flex h-16 items-center justify-center gap-3 px-3 xl:h-20 xl:justify-start xl:px-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-base font-black text-primary-foreground shadow-lg shadow-primary/25 xl:size-11">
          M
        </div>
        <div className="hidden min-w-0 flex-col gap-0.5 xl:flex">
          <p className="truncate text-lg font-bold leading-tight">My Printer App</p>
          <p className="text-sm text-sidebar-muted">by Maher Tka</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 px-2 xl:px-3">
        {visibleNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activeRoute === item.route

          return (
            <button
              key={item.route}
              type="button"
              onClick={() => onNavigate(item.route)}
              className={cn(
                'relative flex h-11 w-full items-center justify-center gap-3 rounded-md px-0 text-left text-sm font-semibold transition xl:justify-start xl:px-3',
                isActive
                  ? 'bg-sidebar-active text-white shadow-md shadow-primary/20'
                  : 'text-sidebar-foreground/82 hover:bg-white/8 hover:text-white'
              )}
              title={item.label}
            >
              {isActive && (
                <span className="absolute -left-2 h-full w-1 rounded-r-full bg-primary xl:-left-3" />
              )}
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="hidden truncate xl:block">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="hidden flex-col gap-4 px-4 pb-5 xl:flex">
        <Separator className="bg-sidebar-border" />
        <div className="rounded-md border border-sidebar-border bg-white/5 p-3">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/25 text-white">
              <ContactRound className="size-5" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="font-semibold text-white">Shop workspace</p>
              <p className="text-xs leading-5 text-sidebar-muted">
                Local files, print exports, and production checks stay on this PC.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-xs text-sidebar-muted">
          <span>© 2026 My Printer App</span>
          <span>Local-first desktop workspace</span>
        </div>
      </div>
    </aside>
  )
}
