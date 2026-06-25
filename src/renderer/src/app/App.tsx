import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  type CutterProjectPayload,
  type HardcoverProjectPayload
} from '@/projects/projectFiles'
import { SettingsPage } from '@/settings/SettingsPage'
import { AutosaveRecoveryBanner } from '@/projects/AutosaveRecoveryBanner'
import { AppHealthPage } from '@/settings/AppHealthPage'
import { ExportCenterPage } from '@/exports/ExportCenterPage'
import { JobsPage } from '@/jobs/JobsPage'
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
import type { AutosaveEntry } from '../../../shared/release-types'

const AUTOSAVE_INTERVAL_MS = 60_000
const QualityLabPage = lazy(() => import('@/quality/QualityLabPage'))

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
  jobs: {
    title: 'Shop Jobs',
    subtitle: 'Local customer jobs and quotes'
  },
  exports: {
    title: 'Export Center',
    subtitle: 'Local production export history'
  },
  'app-health': {
    title: 'App Health',
    subtitle: 'Release diagnostics and recovery tools'
  },
  'quality-lab': {
    title: 'Quality Lab',
    subtitle: 'Development-only release checks'
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
  'jobs',
  'exports',
  'app-health',
  'quality-lab',
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
  const [recoveryEntry, setRecoveryEntry] = useState<AutosaveEntry | null>(null)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [recoveryIsBusy, setRecoveryIsBusy] = useState(false)
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
    window.printerApp?.setActiveProjectSnapshot(
      session
        ? {
            project: session.snapshot,
            isDirty: session.isDirty,
            filePath: session.filePath,
            preflight: session.preflight
          }
        : null
    )
  }, [])

  const clearActiveProjectSession = useCallback((): void => {
    activeProjectSessionRef.current = null
    void window.printerApp?.setProjectDirty(false, 'Untitled Project')
    window.printerApp?.setActiveProjectSnapshot(null)
  }, [])

  useEffect(() => {
    const runtime = window.printerApp?.runtime
    if (!runtime) return

    void runtime.listAutosaves().then((entries) => setRecoveryEntry(entries[0] ?? null))

    const timer = window.setInterval(() => {
      const session = activeProjectSessionRef.current
      if (!session?.isDirty) return
      void runtime.writeAutosave({ project: session.snapshot, originalFilePath: session.filePath })
    }, AUTOSAVE_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [])

  const restoreAutosave = useCallback(async (): Promise<void> => {
    if (!recoveryEntry || !window.printerApp?.runtime) return
    setRecoveryIsBusy(true)
    setRecoveryError(null)
    const result = await window.printerApp.runtime.readAutosave(recoveryEntry.filePath)
    if (!result.ok || !result.project || !isPrinterProjectFile(result.project)) {
      setRecoveryError(result.error ?? 'The recovery file could not be opened.')
      setRecoveryIsBusy(false)
      return
    }
    const projectRoute = result.project.metadata.tool
    clearActiveProjectSession()
    setOpenedProject({
      filePath: recoveryEntry.originalFilePath ?? null,
      project: result.project,
      instanceId: Date.now()
    })
    activeRouteRef.current = projectRoute
    setActiveRoute(projectRoute)
    window.location.hash = `#/${projectRoute}`
    setRecoveryEntry(null)
    setRecoveryIsBusy(false)
  }, [clearActiveProjectSession, recoveryEntry])

  const discardAutosave = useCallback(async (): Promise<void> => {
    if (!recoveryEntry || !window.printerApp?.runtime) return
    setRecoveryIsBusy(true)
    const result = await window.printerApp.runtime.discardAutosave(recoveryEntry.filePath)
    if (result.ok) {
      const remaining = await window.printerApp.runtime.listAutosaves()
      setRecoveryEntry(remaining[0] ?? null)
      setRecoveryError(null)
    } else {
      setRecoveryError(result.error ?? 'The autosave could not be discarded.')
    }
    setRecoveryIsBusy(false)
  }, [recoveryEntry])

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
      {recoveryEntry && (
        <AutosaveRecoveryBanner
          entry={recoveryEntry}
          isBusy={recoveryIsBusy}
          error={recoveryError}
          onRestore={() => void restoreAutosave()}
          onDiscard={() => void discardAutosave()}
          onOpenFolder={() => void window.printerApp?.runtime.openAutosaveFolder()}
        />
      )}
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
        <HardcoverCoverPage
          key={openedProject?.instanceId ?? 'new-hardcover'}
          onNavigate={navigate}
          onOpenProject={openProject}
          onProjectSessionChange={setActiveProjectSession}
          onConfirmUnsavedChanges={confirmUnsavedChanges}
          openedProject={
            openedProject?.project.metadata.tool === 'hardcover-cover'
              ? (openedProject as OpenedPrinterProject<HardcoverProjectPayload>)
              : null
          }
        />
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
          onResetLocal={license.resetLocal}
          isDeveloperMode={license.isDeveloperMode}
          onNavigate={navigate}
        />
      )}
      {activeRoute === 'settings' && <SettingsPage onNavigate={navigate} />}
      {activeRoute === 'jobs' && <JobsPage />}
      {activeRoute === 'exports' && <ExportCenterPage onNavigate={navigate} />}
      {activeRoute === 'app-health' && (
        <AppHealthPage
          license={license.state}
          performance={performanceSettings}
          isDeveloperMode={license.isDeveloperMode}
          onResetLicense={license.resetLocal}
        />
      )}
      {activeRoute === 'quality-lab' && license.isDeveloperMode && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Quality Lab…</p>}>
          <QualityLabPage />
        </Suspense>
      )}
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
