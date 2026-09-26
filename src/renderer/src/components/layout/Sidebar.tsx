import {
  BookOpen,
  BriefcaseBusiness,
  History,
  Hash,
  Home,
  PenLine,
  Settings,
  Sparkles,
  SquareStack,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppRoute } from '@/types/navigation'

interface SidebarProps {
  activeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
}

interface NavItem {
  route: AppRoute
  label: string
  description: string
  icon: LucideIcon
}

const overviewItems: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard', description: 'Shop overview', icon: Home }
]

const productionItems: NavItem[] = [
  {
    route: 'sequential-number',
    label: 'Sequential Number',
    description: 'Number tickets & invoices',
    icon: Hash
  },
  {
    route: 'booklet-montage',
    label: 'Booklet Montage',
    description: 'Impose PDFs for print',
    icon: BookOpen
  },
  {
    route: 'hardcover-cover',
    label: 'Hardcover Cover',
    description: 'Build binding covers',
    icon: SquareStack
  },
  {
    route: 'cutter-montage',
    label: 'Cutter Montage',
    description: 'Prepare print & cut',
    icon: PenLine
  }
]

const operationsItems: NavItem[] = [
  { route: 'jobs', label: 'Shop Jobs', description: 'Track production', icon: BriefcaseBusiness },
  { route: 'exports', label: 'Export Center', description: 'Recent output', icon: History }
]

const settingsRoutes = new Set<AppRoute>(['settings', 'license', 'app-health', 'quality-lab'])

export function Sidebar({ activeRoute, onNavigate }: SidebarProps): JSX.Element {
  return (
    <aside className="relative z-20 flex w-[76px] shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-sidebar xl:w-[252px]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/20 to-transparent" />

      <div className="relative flex h-[76px] items-center justify-center gap-3 border-b border-sidebar-border/80 px-3 xl:justify-start xl:px-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-base font-black text-white shadow-lg shadow-blue-950/30 ring-1 ring-white/15">
          M
        </div>
        <div className="hidden min-w-0 xl:block">
          <p className="truncate text-[15px] font-bold leading-tight text-white">My Printer App</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-sidebar-muted">
            <Sparkles className="size-3 text-blue-300" aria-hidden="true" />
            Production workspace
          </p>
        </div>
      </div>

      <nav
        aria-label="Main navigation"
        className="relative flex flex-1 flex-col gap-5 overflow-y-auto px-2 py-4 xl:px-3"
      >
        <NavigationGroup
          label="Overview"
          items={overviewItems}
          activeRoute={activeRoute}
          onNavigate={onNavigate}
        />
        <NavigationGroup
          label="Production"
          items={productionItems}
          activeRoute={activeRoute}
          onNavigate={onNavigate}
        />
        <NavigationGroup
          label="Operations"
          items={operationsItems}
          activeRoute={activeRoute}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="relative border-t border-sidebar-border/80 p-2 xl:p-3">
        <div className="mb-2 hidden items-center gap-2 rounded-lg border border-sidebar-border bg-white/5 px-3 py-2.5 xl:flex">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">Local workspace</p>
            <p className="mt-0.5 text-[10px] text-sidebar-muted">Files stay on this PC</p>
          </div>
        </div>
        <SidebarNavButton
          item={{
            route: 'settings',
            label: 'Settings',
            description: 'App preferences',
            icon: Settings
          }}
          active={settingsRoutes.has(activeRoute)}
          onNavigate={onNavigate}
        />
      </div>
    </aside>
  )
}

function NavigationGroup({
  label,
  items,
  activeRoute,
  onNavigate
}: {
  label: string
  items: NavItem[]
  activeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  return (
    <section>
      <p className="mb-2 hidden px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-muted/75 xl:block">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <SidebarNavButton
            key={item.route}
            item={item}
            active={activeRoute === item.route}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  )
}

function SidebarNavButton({
  item,
  active,
  onNavigate
}: {
  item: NavItem
  active: boolean
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.route)}
      className={cn(
        'group relative flex min-h-12 w-full items-center justify-center gap-3 rounded-xl px-0 text-left transition-colors xl:justify-start xl:px-3',
        active
          ? 'bg-white text-slate-950 shadow-lg shadow-slate-950/20'
          : 'text-sidebar-foreground/78 hover:bg-white/8 hover:text-white'
      )}
      aria-label={item.label}
      title={item.label}
      aria-current={active ? 'page' : undefined}
    >
      {active ? (
        <span className="absolute -left-2 h-7 w-1 rounded-r-full bg-blue-400 xl:-left-3" />
      ) : null}
      <Icon
        className={cn(
          'size-5 shrink-0 transition-colors',
          active ? 'text-primary' : 'text-sidebar-muted group-hover:text-white'
        )}
        aria-hidden="true"
      />
      <span className="hidden min-w-0 flex-1 xl:block">
        <span className="block truncate text-sm font-semibold">{item.label}</span>
        <span
          className={cn(
            'mt-0.5 block truncate text-[10px] font-medium',
            active ? 'text-slate-500' : 'text-sidebar-muted/80'
          )}
        >
          {item.description}
        </span>
      </span>
    </button>
  )
}
