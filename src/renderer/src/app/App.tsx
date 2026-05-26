import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardPage } from '@/app/DashboardPage'
import { AppLayout } from '@/components/layout/AppLayout'
import { LicensePage } from '@/licensing/LicensePage'
import { SettingsPage } from '@/settings/SettingsPage'
import { BookletMontagePage } from '@/tools/booklet-montage/BookletMontagePage'
import { CutterMontagePage } from '@/tools/cutter-montage/CutterMontagePage'
import { HardcoverCoverPage } from '@/tools/hardcover-cover/HardcoverCoverPage'
import type { AppRoute, PageMeta } from '@/types/navigation'

const pageMeta: Record<AppRoute, PageMeta> = {
  dashboard: {
    title: 'My Printer App by Maher Tka',
    subtitle: 'Printer shop automation hub'
  },
  'booklet-montage': {
    title: 'Booklet Montage',
    subtitle: 'Local-first booklet imposition workspace'
  },
  'hardcover-cover': {
    title: 'Hardcover Cover Sheet',
    subtitle: 'Cover-sheet automation module'
  },
  'cutter-montage': {
    title: 'Cutter Montage',
    subtitle: 'Plotter and big-sheet preparation module'
  },
  license: {
    title: 'License',
    subtitle: 'Local activation and trial status'
  },
  settings: {
    title: 'Settings',
    subtitle: 'Local workspace preferences'
  }
}

const appRoutes = new Set<AppRoute>([
  'dashboard',
  'booklet-montage',
  'hardcover-cover',
  'cutter-montage',
  'license',
  'settings'
])

function getRouteFromHash(): AppRoute {
  const route = window.location.hash.replace(/^#\/?/, '')

  return appRoutes.has(route as AppRoute) ? (route as AppRoute) : 'dashboard'
}

export function App(): JSX.Element {
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => getRouteFromHash())
  const activeMeta = useMemo(() => pageMeta[activeRoute], [activeRoute])

  useEffect(() => {
    const handleHashChange = (): void => {
      setActiveRoute(getRouteFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const navigate = useCallback((route: AppRoute): void => {
    setActiveRoute(route)

    const nextHash = `#/${route}`
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash
    }
  }, [])

  return (
    <AppLayout
      activeRoute={activeRoute}
      pageMeta={activeMeta}
      onNavigate={navigate}
    >
      {activeRoute === 'dashboard' && <DashboardPage onNavigate={navigate} />}
      {activeRoute === 'booklet-montage' && (
        <BookletMontagePage onNavigate={navigate} />
      )}
      {activeRoute === 'hardcover-cover' && (
        <HardcoverCoverPage onNavigate={navigate} />
      )}
      {activeRoute === 'cutter-montage' && (
        <CutterMontagePage onNavigate={navigate} />
      )}
      {activeRoute === 'license' && <LicensePage onNavigate={navigate} />}
      {activeRoute === 'settings' && <SettingsPage onNavigate={navigate} />}
    </AppLayout>
  )
}
