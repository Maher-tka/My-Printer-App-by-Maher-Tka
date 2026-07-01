import { Bell, ChevronDown, CircleHelp } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { PageMeta } from '@/types/navigation'

interface TopBarProps {
  pageMeta: PageMeta
  isDeveloperMode?: boolean
}

export function TopBar({ pageMeta, isDeveloperMode = false }: TopBarProps): JSX.Element {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b bg-card px-3 py-3 sm:px-4 lg:min-h-16 lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-xl font-bold tracking-normal text-foreground lg:text-2xl">
          {pageMeta.title}
        </h1>
        <p className="truncate text-sm text-muted-foreground">{pageMeta.subtitle}</p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
        {isDeveloperMode ? <Badge variant="warning">Developer Test Mode</Badge> : null}
        <Button variant="ghost" className="hidden gap-2 sm:inline-flex" type="button">
          <CircleHelp data-icon="inline-start" />
          Help
        </Button>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label="Notifications"
          className="relative"
        >
          <Bell />
          <span className="absolute right-1.5 top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            3
          </span>
        </Button>
        <Separator orientation="vertical" className="hidden h-8 sm:block" />
        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-md px-2 text-sm font-medium transition hover:bg-accent"
          aria-label="User menu"
        >
          <Avatar>
            <AvatarFallback>MT</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">Maher Tka</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
