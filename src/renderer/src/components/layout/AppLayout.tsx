import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import type { AppRoute, PageMeta } from '@/types/navigation'

interface AppLayoutProps {
  activeRoute: AppRoute
  pageMeta: PageMeta
  children: React.ReactNode
  onNavigate: (route: AppRoute) => void
  isDeveloperMode?: boolean
}

export function AppLayout({
  activeRoute,
  pageMeta,
  children,
  onNavigate,
  isDeveloperMode = false
}: AppLayoutProps): JSX.Element {
  return (
    <div className="flex min-h-screen max-w-full overflow-hidden bg-background text-foreground">
      <Sidebar
        activeRoute={activeRoute}
        onNavigate={onNavigate}
        isDeveloperMode={isDeveloperMode}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar pageMeta={pageMeta} isDeveloperMode={isDeveloperMode} />
        <main className="min-w-0 flex-1 overflow-auto px-3 py-3 sm:px-4 lg:px-6 lg:py-5">
          {children}
        </main>
      </div>
    </div>
  )
}
