import { useLanguage } from '@/i18n/useLanguage'
import {
  BookOpen,
  Files,
  CreditCard,
  BriefcaseBusiness,
  History,
  Hash,
  Home,
  PenLine,
  Settings,
  PanelLeftOpen,
  PanelLeftClose,
  Printer,
  HeartPulse,
  ShieldCheck,
  SquareStack,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useState, type DragEvent } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AppRoute } from '@/types/navigation'
import { isFileDropTool, toolDropFormats, type FileDropTool } from '@/tools/shared/toolFileDrop'

interface SidebarProps {
  activeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
  onDropToolFiles?: (route: FileDropTool, files: File[]) => void
  fileDropBusy?: boolean
}
interface NavItem {
  route: AppRoute
  label: string
  icon: LucideIcon
}

const productionItems: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard', icon: Home },
  { route: 'card-montage', label: 'Card Montage', icon: CreditCard },
  { route: 'booklet-montage', label: 'Booklet Montage', icon: BookOpen },
  { route: 'hardcover-cover', label: 'Hardcover Cover', icon: SquareStack },
  { route: 'cutter-montage', label: 'Cutter Montage', icon: PenLine },
  { route: 'sequential-number', label: 'Sequential Number', icon: Hash },
  { route: 'pdf-tools', label: 'PDF Tools', icon: Files }
]
const operationsItems: NavItem[] = [
  { route: 'jobs', label: 'Shop Jobs', icon: BriefcaseBusiness },
  { route: 'exports', label: 'Export Center', icon: History }
]
const settingsRoutes = new Set<AppRoute>(['settings', 'license', 'app-health', 'quality-lab'])

export function Sidebar({
  activeRoute,
  onNavigate,
  onDropToolFiles,
  fileDropBusy = false
}: SidebarProps): JSX.Element {
  const { t, direction } = useLanguage()

  const [expanded, setExpanded] = useState(false)
  const [dragRoute, setDragRoute] = useState<AppRoute | null>(null)
  const [tooltipRoute, setTooltipRoute] = useState<AppRoute | null>(null)
  useEffect(() => {
    const reset = (): void => setDragRoute(null)
    window.addEventListener('drop', reset)
    window.addEventListener('dragend', reset)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('drop', reset)
      window.removeEventListener('dragend', reset)
      window.removeEventListener('blur', reset)
    }
  }, [])
  const renderItem = (item: NavItem, active = activeRoute === item.route): JSX.Element => {
    const Icon = item.icon
    const dropTool = isFileDropTool(item.route) ? item.route : null
    const acceptsDrop = Boolean(dropTool && onDropToolFiles)
    const dropHint = t(
      fileDropBusy
        ? 'Wait for the current import to finish.'
        : dropTool === 'card-montage'
          ? 'Drop one file, or two files for the front and back.'
          : 'Drop files to import'
    )
    const dragOver = (event: DragEvent<HTMLButtonElement>): void => {
      if (!Array.from(event.dataTransfer.types).includes('Files')) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = acceptsDrop && !fileDropBusy ? 'copy' : 'none'
      setDragRoute(acceptsDrop && !fileDropBusy ? item.route : null)
    }
    return (
      <Tooltip
        key={item.route}
        open={dragRoute === item.route || tooltipRoute === item.route}
        onOpenChange={(open) => setTooltipRoute(open ? item.route : null)}
      >
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onNavigate(item.route)}
            aria-label={t(item.label)}
            aria-current={active ? 'page' : undefined}
            aria-description={
              acceptsDrop && dropTool ? `${dropHint} · ${toolDropFormats[dropTool]}` : undefined
            }
            data-file-drop-tool={acceptsDrop ? dropTool : undefined}
            onDragEnter={dragOver}
            onDragOver={dragOver}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                setDragRoute(null)
            }}
            onDrop={(event) => {
              if (!Array.from(event.dataTransfer.types).includes('Files')) return
              event.preventDefault()
              event.stopPropagation()
              setDragRoute(null)
              if (dropTool && acceptsDrop && !fileDropBusy)
                onDropToolFiles?.(dropTool, Array.from(event.dataTransfer.files))
            }}
            className={cn(
              'sidebar-navigation-button group flex min-h-11 items-center gap-3 rounded-full px-3 text-left text-[13px] transition-colors ui-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              expanded ? 'w-full' : 'size-11 justify-center',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              dragRoute === item.route &&
                'bg-primary/10 text-primary ring-2 ring-inset ring-primary'
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {expanded && <span className="truncate font-medium">{t(item.label)}</span>}
          </button>
        </TooltipTrigger>
        {(!expanded || dragRoute === item.route) && (
          <TooltipContent side={direction === 'rtl' ? 'left' : 'right'} sideOffset={12}>
            {t(item.label)}
            {acceptsDrop && dropTool && (
              <span className="block text-xs">
                {dropHint} · {toolDropFormats[dropTool]}
              </span>
            )}
          </TooltipContent>
        )}
      </Tooltip>
    )
  }
  return (
    <TooltipProvider delayDuration={250}>
      <aside
        aria-label={t('Workspace navigation')}
        className={cn(
          'floating-navigation relative z-20 flex shrink-0 flex-col text-sidebar-foreground',
          expanded
            ? 'w-[var(--ui-sidebar-expanded)] px-3'
            : 'w-[var(--ui-sidebar-width)] items-center px-2'
        )}
      >
        <div
          className={cn(
            'flex h-[var(--ui-header-height)] shrink-0 items-center gap-3',
            expanded ? 'px-1' : 'justify-center'
          )}
        >
          <div
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Printer className="size-5" />
          </div>
          {expanded && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">My Printer App</p>
              <p className="text-[11px] text-muted-foreground">by Maher Tka</p>
            </div>
          )}
        </div>
        <nav
          aria-label={t('Main navigation')}
          className="floating-navigation-items flex min-h-0 w-full flex-1 flex-col items-center gap-5 overflow-y-auto py-5"
        >
          <div className={cn('flex flex-col gap-2', expanded && 'w-full')}>
            {productionItems.map((item) => renderItem(item))}
          </div>
          <div className={cn('pt-4', expanded && 'w-full')}>
            <div className="flex flex-col gap-2">
              {operationsItems.map((item) => renderItem(item))}
            </div>
          </div>
        </nav>
        <div className={cn('flex shrink-0 flex-col items-center gap-2 pb-4', expanded && 'w-full')}>
          {renderItem({ route: 'license', label: 'Account access', icon: ShieldCheck })}
          {renderItem({ route: 'app-health', label: 'App Health', icon: HeartPulse })}
          {renderItem(
            { route: 'settings', label: 'Settings', icon: Settings },
            settingsRoutes.has(activeRoute)
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={expanded ? t('Collapse navigation') : t('Expand navigation')}
                aria-expanded={expanded}
                onClick={() => setExpanded((value) => !value)}
                className={cn(
                  'flex h-10 items-center gap-3 rounded-[var(--ui-radius-md)] px-3 text-muted-foreground hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  expanded ? 'w-full' : 'w-11 justify-center'
                )}
              >
                {expanded ? (
                  <PanelLeftClose className="size-5" aria-hidden="true" />
                ) : (
                  <PanelLeftOpen className="size-5" aria-hidden="true" />
                )}
                {expanded && <span className="text-xs">{t('Collapse navigation')}</span>}
              </button>
            </TooltipTrigger>
            {!expanded && (
              <TooltipContent side={direction === 'rtl' ? 'left' : 'right'}>
                {t('Expand navigation')}
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}
