import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
        <Badge variant="secondary">Local workspace</Badge>
        <Avatar>
          <AvatarFallback>MT</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
