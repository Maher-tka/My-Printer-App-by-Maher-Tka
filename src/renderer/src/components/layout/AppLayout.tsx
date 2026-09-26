import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { CommandCenter } from '@/components/command-center/CommandCenter'
import { useEffect, useRef, useState } from 'react'
import type { AppRoute, PageMeta } from '@/types/navigation'
import type { AccountProfile } from '../../../../shared/account-types'

interface AppLayoutProps {
  activeRoute: AppRoute
  pageMeta: PageMeta
  children: React.ReactNode
  onNavigate: (route: AppRoute) => void
  isDeveloperMode?: boolean
  account?: AccountProfile | null
  onSignOut: () => void
  onOpenProject: () => void
  onOpenImageFile: () => void
}

export function AppLayout({
  activeRoute,
  pageMeta,
  children,
  onNavigate,
  account,
  onSignOut,
  onOpenProject,
  onOpenImageFile,
  isDeveloperMode = false
}: AppLayoutProps): JSX.Element {
  const [commandCenterOpen, setCommandCenterOpen] = useState(false)

  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    document.title = pageMeta.title + ' — My Printer App'
    mainRef.current?.scrollTo({ top: 0 })
  }, [activeRoute, pageMeta.title])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandCenterOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen max-w-full overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          mainRef.current?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-lg focus:bg-card focus:p-3 focus:text-foreground focus:shadow-lg"
      >
        Skip to workspace
      </a>
      <Sidebar activeRoute={activeRoute} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          pageMeta={pageMeta}
          account={account}
          onSignOut={onSignOut}
          isDeveloperMode={isDeveloperMode}
          onOpenCommandCenter={() => setCommandCenterOpen(true)}
          onOpenImageFile={onOpenImageFile}
        />
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          aria-label={pageMeta.title}
          className="app-canvas min-w-0 flex-1 overflow-auto px-3 py-4 sm:px-5 lg:px-7 lg:py-6"
        >
          <div className="relative z-[1]">{children}</div>
        </main>
      </div>
      <CommandCenter
        open={commandCenterOpen}
        activeRoute={activeRoute}
        onOpenChange={setCommandCenterOpen}
        onNavigate={onNavigate}
        onOpenProject={onOpenProject}
        onOpenImageFile={onOpenImageFile}
        isDeveloperMode={isDeveloperMode}
      />
    </div>
  )
}
