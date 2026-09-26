import {
  BookOpen,
  BriefcaseBusiness,
  History,
  Hash,
  Home,
  PenLine,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  SquareStack,
  type LucideIcon
} from 'lucide-react'
import { useState } from 'react'
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
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('printer-app.sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleSidebar = (): void => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem('printer-app.sidebar-collapsed', String(next))
    } catch {
      // Keep the session preference when persistent storage is unavailable.
    }
  }

  return (
    <aside
      className={cn(
        'relative z-20 flex w-16 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        !collapsed && 'lg:w-[224px]'
      )}
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center justify-center gap-3 border-b border-sidebar-border px-3',
          !collapsed && 'lg:justify-start lg:px-5'
        )}
      >
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-300 text-slate-900">
          <Printer className="size-5" aria-hidden="true" />
        </div>
        <div className={cn('hidden min-w-0', !collapsed && 'lg:block')}>
          <p className="truncate text-[15px] font-bold leading-tight text-white">My Printer App</p>
          <p className="mt-1 text-[11px] text-sidebar-muted">by Maher Tka</p>
        </div>
      </div>

      <nav
        aria-label="Main navigation"
        className="flex flex-1 flex-col gap-6 overflow-y-auto px-2 py-5"
      >
        <NavigationGroup
          label="Overview"
          collapsed={collapsed}
          items={overviewItems}
          activeRoute={activeRoute}
          onNavigate={onNavigate}
        />
        <NavigationGroup
          label="Production"
          collapsed={collapsed}
          items={productionItems}
          activeRoute={activeRoute}
          onNavigate={onNavigate}
        />
        <NavigationGroup
          label="Operations"
          collapsed={collapsed}
          items={operationsItems}
          activeRoute={activeRoute}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <div className={cn('mb-3 hidden items-center gap-2 px-3 py-2', !collapsed && 'lg:flex')}>
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-300" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground">Local workspace</p>
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
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <button
          type="button"
          className="mt-1 hidden h-10 w-full items-center justify-center gap-3 rounded-lg px-3 text-sidebar-muted hover:bg-white/5 hover:text-white lg:flex"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <>
              <PanelLeftClose className="size-4" />
              <span className="flex-1 text-left text-xs">Collapse sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

function NavigationGroup({
  label,
  items,
  activeRoute,
  collapsed,
  onNavigate
}: {
  label: string
  items: NavItem[]
  activeRoute: AppRoute
  collapsed: boolean
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  return (
    <section>
      <p
        className={cn(
          'mb-2 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted',
          !collapsed && 'lg:block'
        )}
      >
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <SidebarNavButton
            key={item.route}
            item={item}
            active={activeRoute === item.route}
            collapsed={collapsed}
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
  collapsed,
  onNavigate
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onNavigate: (route: AppRoute) => void
}): JSX.Element {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.route)}
      className={cn(
        'group relative flex min-h-11 w-full items-center justify-center gap-3 rounded-lg text-left transition-colors',
        !collapsed && 'lg:justify-start lg:px-3',
        active
          ? 'bg-white/10 text-white'
          : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-white'
      )}
      aria-label={item.label}
      title={`${item.label} — ${item.description}`}
      aria-current={active ? 'page' : undefined}
    >
      {active ? (
        <span className="absolute -left-2 h-5 w-0.5 rounded-r-full bg-emerald-300" />
      ) : null}
      <Icon
        className={cn(
          'size-[18px] shrink-0 transition-colors',
          active ? 'text-emerald-300' : 'text-sidebar-muted group-hover:text-white'
        )}
        aria-hidden="true"
      />
      <span className={cn('hidden min-w-0 flex-1', !collapsed && 'lg:block')}>
        <span className="block truncate text-[13px] font-medium">{item.label}</span>
      </span>
    </button>
  )
}
