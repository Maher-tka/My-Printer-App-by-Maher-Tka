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
    <header className="flex h-20 shrink-0 items-center justify-between border-b bg-card px-8">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-2xl font-bold tracking-normal text-foreground">
          {pageMeta.title}
        </h1>
        <p className="text-sm text-muted-foreground">{pageMeta.subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        {isDeveloperMode ? <Badge variant="warning">Developer Test Mode</Badge> : null}
        <Button variant="ghost" className="gap-2" type="button">
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
        <Separator orientation="vertical" className="h-8" />
        <button
          type="button"
          className="flex h-11 items-center gap-3 rounded-md px-2 text-sm font-medium transition hover:bg-accent"
          aria-label="User menu"
        >
          <Avatar>
            <AvatarFallback>MT</AvatarFallback>
          </Avatar>
          <span>Maher Tka</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
