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
  onOpenJob: (jobId: string) => void
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
  onOpenJob,
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
    <div className="desktop-atmosphere" data-route={activeRoute}>
      <div
        className="application-frame flex h-full max-w-full overflow-hidden text-foreground"
        data-route={activeRoute}
      >
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
            isDashboard={activeRoute === 'dashboard'}
            onNavigate={onNavigate}
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
            className={`app-canvas min-h-0 min-w-0 flex-1 overflow-auto ${activeRoute === 'cutter-montage' ? 'p-2 lg:p-3' : 'px-4 py-4 lg:px-6 lg:py-5'}`}
          >
            <div
              className={`relative z-[1] ${activeRoute === 'cutter-montage' ? 'lg:h-full' : ''}`}
            >
              {children}
            </div>
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
          onOpenJob={onOpenJob}
        />
      </div>
    </div>
  )
}
