import { ChevronDown, ChevronRight, FileImage, LogOut, Search, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/appearance/ThemeToggle'
import type { AppRoute, PageMeta } from '@/types/navigation'
import type { AccountProfile } from '../../../../shared/account-types'

interface TopBarProps {
  pageMeta: PageMeta
  isDeveloperMode?: boolean
  account?: AccountProfile | null
  onSignOut: () => void
  onOpenCommandCenter: () => void
  onOpenImageFile: () => void
  isDashboard?: boolean
  onNavigate?: (route: AppRoute) => void
}

export function TopBar({
  pageMeta,
  isDeveloperMode = false,
  account,
  onSignOut,
  onOpenCommandCenter,
  onOpenImageFile,
  isDashboard = false,
  onNavigate
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
    <header
      className={
        isDashboard
          ? 'dashboard-topbar relative z-10 flex shrink-0 items-center justify-between gap-3 px-4 lg:px-6'
          : 'relative z-10 flex h-[var(--ui-header-height)] shrink-0 items-center justify-between gap-3 px-4 lg:px-6'
      }
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            {!isDashboard && (
              <span className="hidden text-xs text-muted-foreground md:inline">Workspace</span>
            )}
            <ChevronRight
              className={isDashboard ? 'hidden' : 'hidden size-3 text-muted-foreground/60 md:block'}
              aria-hidden="true"
            />
            <h1
              className={
                isDashboard
                  ? 'dashboard-brand-name'
                  : 'truncate text-base font-semibold tracking-[-0.015em] text-foreground'
              }
            >
              {isDashboard ? 'My Printer App' : pageMeta.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenCommandCenter}
          className={
            isDashboard
              ? 'dashboard-header-icon'
              : 'hidden h-9 w-60 items-center gap-2 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-card/70 px-3 text-left text-xs text-muted-foreground transition-colors hover:bg-card lg:flex'
          }
          aria-label="Quick open"
          title="Quick open (Ctrl+K)"
        >
          <Search className="size-4" aria-hidden="true" />
          <span className={isDashboard ? 'sr-only' : 'flex-1'}>Find anything…</span>
          <kbd
            className={
              isDashboard
                ? 'sr-only'
                : 'rounded border bg-background px-1.5 py-0.5 font-sans text-[9px] font-medium text-muted-foreground'
            }
          >
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
          className={isDashboard ? 'hidden' : 'lg:hidden'}
        >
          <Search className="size-4" />
        </Button>
        {isDashboard && onNavigate && (
          <button
            type="button"
            className="dashboard-header-icon"
            onClick={() => onNavigate('settings')}
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="size-4" aria-hidden="true" />
          </button>
        )}
        <ThemeToggle dashboard={isDashboard} />
        <Button
          aria-label="Import artwork"
          title="Import artwork into Cutter Montage"
          variant="outline"
          type="button"
          onClick={onOpenImageFile}
          className={
            isDashboard ? 'dashboard-header-icon border-0 p-0' : 'rounded-lg px-3.5 text-xs'
          }
        >
          <FileImage className="size-4" aria-hidden="true" />
          <span className={isDashboard ? 'sr-only' : 'hidden sm:inline'}>Import artwork</span>
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
            className={
              isDashboard
                ? 'dashboard-account-button'
                : 'ml-1 flex h-10 items-center gap-2 rounded-lg border border-transparent px-1.5 text-sm font-medium transition hover:border-border hover:bg-accent/60'
            }
            ref={accountButtonRef}
            aria-expanded={accountMenuOpen}
            aria-controls={accountMenuOpen ? 'account-details' : undefined}
            aria-label="Account menu"
            onClick={() => setAccountMenuOpen((open) => !open)}
          >
            <Avatar className="size-8 border border-primary/10">
              <AvatarFallback className="bg-secondary text-xs text-primary">
                {accountInitials}
              </AvatarFallback>
            </Avatar>
            <span className={isDashboard ? 'sr-only' : 'hidden max-w-36 truncate 2xl:inline'}>
              {accountLabel}
            </span>
            <ChevronDown
              className={isDashboard ? 'hidden' : 'size-3.5 text-muted-foreground'}
              aria-hidden="true"
            />
          </button>
          {accountMenuOpen ? (
            <div
              id="account-details"
              className="absolute right-0 top-12 z-30 w-72 rounded-2xl border bg-card p-3 shadow-elevated"
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
