import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DashboardPage } from '@/app/DashboardPage'
import { AppLayout } from '@/components/layout/AppLayout'
import { LicensePage } from '@/licensing/LicensePage'
import { routeRequiresPaidAccess } from '@/licensing/tool-access'
import { useLicenseState } from '@/licensing/useLicenseState'
import { printerTools } from '@/lib/app-data'
import { usePerformanceSettings } from '@/performance/usePerformanceSettings'
import {
  isPrinterProjectFile,
  type BookletProjectPayload,
  type CutterProjectPayload
} from '@/projects/projectFiles'
import { SettingsPage } from '@/settings/SettingsPage'
import { BookletMontagePage } from '@/tools/booklet-montage/BookletMontagePage'
import { CutterMontagePage } from '@/tools/cutter-montage/CutterMontagePage'
import { HardcoverCoverPage } from '@/tools/hardcover-cover/HardcoverCoverPage'
import type { AppRoute, PageMeta } from '@/types/navigation'
import type {
  OpenedPrinterProject,
  PrinterAppProjectResult
} from '@/types/projects'

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

interface PendingBookletPdfImport {
  id: number
  files: File[]
}

function getRouteFromHash(): AppRoute {
  const route = window.location.hash.replace(/^#\/?/, '')

  return appRoutes.has(route as AppRoute) ? (route as AppRoute) : 'dashboard'
}

export function App(): JSX.Element {
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => getRouteFromHash())
  const [openedProject, setOpenedProject] = useState<
    (OpenedPrinterProject & { instanceId: number }) | null
  >(null)
  const [pendingBookletPdfImport, setPendingBookletPdfImport] =
    useState<PendingBookletPdfImport | null>(null)
  const bookletPdfImportIdRef = useRef(0)
  const activeMeta = useMemo(() => pageMeta[activeRoute], [activeRoute])
  const { settings: performanceSettings } = usePerformanceSettings()
  const license = useLicenseState()

  useEffect(() => {
    const handleHashChange = (): void => {
      setActiveRoute(getRouteFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.performancePreset = performanceSettings.preset
  }, [performanceSettings.preset])

  const navigate = useCallback(
    (route: AppRoute): void => {
      const nextRoute =
        routeRequiresPaidAccess(route, printerTools) &&
        !license.isLoading &&
        !license.state?.canUsePaidTools
          ? 'license'
          : route

      setActiveRoute(nextRoute)
      setOpenedProject(null)
      setPendingBookletPdfImport(null)

      const nextHash = `#/${nextRoute}`
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash
      }
    },
    [license.isLoading, license.state?.canUsePaidTools]
  )

  const openProject = useCallback(
    async (filePath?: string | null): Promise<PrinterAppProjectResult> => {
      if (!window.printerApp?.openProject) {
        return {
          ok: false,
          error: 'Project opening is only available in the desktop app.'
        }
      }

      const result = await window.printerApp.openProject(filePath)

      if (
        !result.ok ||
        !result.filePath ||
        !result.project ||
        !isPrinterProjectFile(result.project)
      ) {
        return result.ok
          ? { ok: false, error: 'The selected file is not a supported project.' }
          : result
      }

      const projectRoute = result.project.metadata.tool
      const nextRoute =
        routeRequiresPaidAccess(projectRoute, printerTools) &&
        !license.isLoading &&
        !license.state?.canUsePaidTools
          ? 'license'
          : projectRoute

      setOpenedProject({
        filePath: result.filePath,
        project: result.project,
        instanceId: Date.now()
      })
      setPendingBookletPdfImport(null)
      setActiveRoute(nextRoute)
      window.location.hash = `#/${nextRoute}`

      return result
    },
    [license.isLoading, license.state?.canUsePaidTools]
  )

  const importBookletPdf = useCallback((files: File[]): void => {
    if (files.length === 0) {
      return
    }

    bookletPdfImportIdRef.current += 1
    setOpenedProject(null)
    setPendingBookletPdfImport({
      id: bookletPdfImportIdRef.current,
      files
    })
    setActiveRoute('booklet-montage')
    window.location.hash = '#/booklet-montage'
  }, [])

  const consumeBookletPdfImport = useCallback((requestId: number): void => {
    setPendingBookletPdfImport((current) =>
      current?.id === requestId ? null : current
    )
  }, [])

  useEffect(() => {
    if (
      !license.isLoading &&
      routeRequiresPaidAccess(activeRoute, printerTools) &&
      !license.state?.canUsePaidTools
    ) {
      navigate('license')
    }
  }, [
    activeRoute,
    license.isLoading,
    license.state?.canUsePaidTools,
    navigate
  ])

  return (
    <AppLayout
      activeRoute={activeRoute}
      pageMeta={activeMeta}
      onNavigate={navigate}
    >
      {activeRoute === 'dashboard' && (
        <DashboardPage
          licenseState={license.state}
          isLicenseLoading={license.isLoading}
          licenseError={license.error}
          onNavigate={navigate}
          onOpenProject={openProject}
          onImportBookletPdf={importBookletPdf}
        />
      )}
      {activeRoute === 'booklet-montage' && (
        <BookletMontagePage
          key={openedProject?.instanceId ?? 'new-booklet'}
          onNavigate={navigate}
          onOpenProject={openProject}
          initialPdfImport={pendingBookletPdfImport}
          onInitialPdfImportConsumed={consumeBookletPdfImport}
          openedProject={
            openedProject?.project.metadata.tool === 'booklet-montage'
              ? (openedProject as OpenedPrinterProject<BookletProjectPayload>)
              : null
          }
        />
      )}
      {activeRoute === 'hardcover-cover' && (
        <HardcoverCoverPage onNavigate={navigate} />
      )}
      {activeRoute === 'cutter-montage' && (
        <CutterMontagePage
          key={openedProject?.instanceId ?? 'new-cutter'}
          onNavigate={navigate}
          onOpenProject={openProject}
          openedProject={
            openedProject?.project.metadata.tool === 'cutter-montage'
              ? (openedProject as OpenedPrinterProject<CutterProjectPayload>)
              : null
          }
        />
      )}
      {activeRoute === 'license' && (
        <LicensePage
          licenseState={license.state}
          isLoading={license.isLoading}
          isActivating={license.isActivating}
          error={license.error}
          activationMessage={license.activationMessage}
          onActivateSerial={license.activateSerial}
          onRefresh={license.refresh}
          onNavigate={navigate}
        />
      )}
      {activeRoute === 'settings' && <SettingsPage onNavigate={navigate} />}
    </AppLayout>
  )
}
