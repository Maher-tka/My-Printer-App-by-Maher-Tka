import { ChevronDown, FileImage, LogOut, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { PageMeta } from '@/types/navigation'
import type { AccountProfile } from '../../../../shared/account-types'

interface TopBarProps {
  pageMeta: PageMeta
  isDeveloperMode?: boolean
  account?: AccountProfile | null
  onSignOut: () => void
  onOpenCommandCenter: () => void
  onOpenImageFile: () => void
}

export function TopBar({
  pageMeta,
  isDeveloperMode = false,
  account,
  onSignOut,
  onOpenCommandCenter,
  onOpenImageFile
}: TopBarProps): JSX.Element {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!accountMenuOpen) return
    const dismiss = (event: PointerEvent): void => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false)
    }
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false)
        accountButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [accountMenuOpen])
  const accountLabel =
    account?.displayName ?? (isDeveloperMode ? 'Developer mode' : 'Subscription access')
  const accountInitials = getInitials(account?.displayName ?? 'SA')

  return (
    <header className="relative z-10 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 py-2 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
              {pageMeta.title}
            </h1>
          </div>
          <p className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">
            {pageMeta.subtitle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenCommandCenter}
          className="hidden h-9 items-center gap-2 rounded-lg border bg-background/70 px-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent lg:flex"
          aria-label="Quick open"
          title="Quick open (Ctrl+K)"
        >
          <Search className="size-4" aria-hidden="true" />
          <span className="mr-4 flex-1">Find a tool or action</span>
          <kbd className="rounded-md border bg-card px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground">
            Ctrl K
          </kbd>
        </button>
        <Button
          variant="outline"
          size="icon"
          type="button"
          onClick={onOpenCommandCenter}
          aria-label="Quick open"
          title="Quick open (Ctrl+K)"
          className="lg:hidden"
        >
          <Search className="size-4" />
        </Button>
        <Button
          aria-label="Import artwork"
          title="Import artwork into Cutter Montage"
          variant="outline"
          type="button"
          onClick={onOpenImageFile}
          className="h-9 rounded-lg"
        >
          <FileImage className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Import artwork</span>
        </Button>

        <div
          className="relative"
          ref={accountMenuRef}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setAccountMenuOpen(false)
          }}
        >
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-lg border border-transparent px-1.5 text-sm font-medium transition-colors hover:border-border hover:bg-accent/60"
            ref={accountButtonRef}
            aria-expanded={accountMenuOpen}
            aria-controls={accountMenuOpen ? 'account-details' : undefined}
            aria-label="Account menu"
            onClick={() => setAccountMenuOpen((open) => !open)}
          >
            <Avatar className="size-8">
              <AvatarFallback>{accountInitials}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-36 truncate 2xl:inline">{accountLabel}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </button>
          {accountMenuOpen ? (
            <div
              id="account-details"
              className="absolute right-0 top-12 z-30 w-72 rounded-2xl border bg-card p-3 shadow-2xl shadow-slate-950/15"
            >
              <div className="flex items-center gap-3 border-b px-1 pb-3">
                <Avatar>
                  <AvatarFallback>{accountInitials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{accountLabel}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {account?.email ?? 'Local subscription workspace'}
                  </p>
                </div>
              </div>
              {account ? (
                <Button
                  className="mt-2 w-full justify-start rounded-lg"
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    onSignOut()
                  }}
                >
                  <LogOut aria-hidden="true" />
                  Sign out
                </Button>
              ) : (
                <p className="px-2 pt-3 text-xs leading-5 text-muted-foreground">
                  This computer is unlocked by the current local subscription.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function getInitials(value: string): string {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return initials || 'SA'
}
