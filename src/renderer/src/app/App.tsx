import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DashboardPage } from '@/app/DashboardPage'
import { AppLayout } from '@/components/layout/AppLayout'
import { LicensePage } from '@/licensing/LicensePage'
import { ToolAccessOverlay } from '@/licensing/ToolAccessOverlay'
import { getToolAccessState } from '@/licensing/tool-access'
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
  ActiveProjectSession,
  OpenedPrinterProject,
  PrinterAppProjectResult
} from '@/types/projects'
import type { UnsavedChangesAction } from '../../../shared/project-types'

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
  const activeRouteRef = useRef(activeRoute)
  const activeProjectSessionRef = useRef<ActiveProjectSession | null>(null)
  const [openedProject, setOpenedProject] = useState<
    (OpenedPrinterProject & { instanceId: number }) | null
  >(null)
  const [pendingBookletPdfImport, setPendingBookletPdfImport] =
    useState<PendingBookletPdfImport | null>(null)
  const bookletPdfImportIdRef = useRef(0)
  const activeMeta = useMemo(() => pageMeta[activeRoute], [activeRoute])
  const { settings: performanceSettings } = usePerformanceSettings()
  const license = useLicenseState()
  const activeTool = printerTools.find((tool) => tool.route === activeRoute)
  const activeToolAccess = activeTool
    ? getToolAccessState(activeTool, license.state, license.isLoading)
    : null
  const showToolAccessOverlay = Boolean(
    activeToolAccess?.isCheckingLicense || activeToolAccess?.isLicenseLocked
  )

  useEffect(() => {
    document.documentElement.dataset.performancePreset = performanceSettings.preset
  }, [performanceSettings.preset])

  const setActiveProjectSession = useCallback((session: ActiveProjectSession | null): void => {
    activeProjectSessionRef.current = session
    void window.printerApp?.setProjectDirty(
      session?.isDirty ?? false,
      session?.projectName ?? 'Untitled Project'
    )
  }, [])

  const clearActiveProjectSession = useCallback((): void => {
    activeProjectSessionRef.current = null
    void window.printerApp?.setProjectDirty(false, 'Untitled Project')
  }, [])

  const confirmUnsavedChanges = useCallback(
    async (action: UnsavedChangesAction): Promise<boolean> => {
      const session = activeProjectSessionRef.current

      if (!session?.isDirty) {
        return true
      }

      if (!window.printerApp?.confirmUnsavedChanges) {
        return window.confirm(`Discard unsaved changes to “${session.projectName}”?`)
      }

      const result = await window.printerApp.confirmUnsavedChanges({
        action,
        projectName: session.projectName
      })

      if (result.choice === 'save') {
        return session.save()
      }

      return result.choice === 'discard'
    },
    []
  )

  const navigate = useCallback(
    async (route: AppRoute): Promise<void> => {
      if (route === activeRouteRef.current) {
        return
      }

      if (!(await confirmUnsavedChanges('navigate'))) {
        const currentHash = `#/${activeRouteRef.current}`

        if (window.location.hash !== currentHash) {
          window.location.hash = currentHash
        }
        return
      }

      clearActiveProjectSession()
      activeRouteRef.current = route
      setActiveRoute(route)
      setOpenedProject(null)
      setPendingBookletPdfImport(null)

      const nextHash = `#/${route}`
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash
      }
    },
    [clearActiveProjectSession, confirmUnsavedChanges]
  )

  useEffect(() => {
    const handleHashChange = (): void => {
      const nextRoute = getRouteFromHash()

      if (nextRoute !== activeRouteRef.current) {
        void navigate(nextRoute)
      }
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [navigate])

  useEffect(() => {
    const desktopApi = window.printerApp

    if (!desktopApi?.onSaveBeforeClose) {
      return
    }

    return desktopApi.onSaveBeforeClose(() => {
      void (async () => {
        const session = activeProjectSessionRef.current
        const saved = !session?.isDirty || (await session.save())
        await desktopApi.finishCloseAfterSave(saved)
      })()
    })
  }, [])

  const openProject = useCallback(
    async (filePath?: string | null): Promise<PrinterAppProjectResult> => {
      if (!(await confirmUnsavedChanges('open-project'))) {
        return { ok: false, canceled: true }
      }

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

      clearActiveProjectSession()
      setOpenedProject({
        filePath: result.filePath,
        project: result.project,
        instanceId: Date.now()
      })
      setPendingBookletPdfImport(null)
      activeRouteRef.current = projectRoute
      setActiveRoute(projectRoute)
      window.location.hash = `#/${projectRoute}`

      return result
    },
    [clearActiveProjectSession, confirmUnsavedChanges]
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
    activeRouteRef.current = 'booklet-montage'
    setActiveRoute('booklet-montage')
    window.location.hash = '#/booklet-montage'
  }, [])

  const consumeBookletPdfImport = useCallback((requestId: number): void => {
    setPendingBookletPdfImport((current) => (current?.id === requestId ? null : current))
  }, [])

  return (
    <AppLayout
      activeRoute={activeRoute}
      pageMeta={activeMeta}
      onNavigate={navigate}
      isDeveloperMode={license.isDeveloperMode}
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
      {activeRoute === 'booklet-montage' && !showToolAccessOverlay && (
        <BookletMontagePage
          key={openedProject?.instanceId ?? 'new-booklet'}
          onNavigate={navigate}
          onOpenProject={openProject}
          initialPdfImport={pendingBookletPdfImport}
          onInitialPdfImportConsumed={consumeBookletPdfImport}
          onProjectSessionChange={setActiveProjectSession}
          onConfirmUnsavedChanges={confirmUnsavedChanges}
          openedProject={
            openedProject?.project.metadata.tool === 'booklet-montage'
              ? (openedProject as OpenedPrinterProject<BookletProjectPayload>)
              : null
          }
        />
      )}
      {activeRoute === 'hardcover-cover' && !showToolAccessOverlay && (
        <HardcoverCoverPage onNavigate={navigate} />
      )}
      {activeRoute === 'cutter-montage' && !showToolAccessOverlay && (
        <CutterMontagePage
          key={openedProject?.instanceId ?? 'new-cutter'}
          onNavigate={navigate}
          onOpenProject={openProject}
          onProjectSessionChange={setActiveProjectSession}
          onConfirmUnsavedChanges={confirmUnsavedChanges}
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
      {showToolAccessOverlay && activeTool && activeToolAccess && (
        <ToolAccessOverlay
          toolName={activeTool.title}
          isChecking={activeToolAccess.isCheckingLicense}
          reason={activeToolAccess.licenseReason}
          onBack={() => void navigate('dashboard')}
          onManageLicense={() => void navigate('license')}
        />
      )}
    </AppLayout>
  )
}
