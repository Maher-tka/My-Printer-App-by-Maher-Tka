import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccountState } from '@/account/useAccountState'
import { scheduleDailyShopBackup } from '@/backup/shopBackup'
import { AppLayout } from '@/components/layout/AppLayout'
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
import { AutosaveRecoveryBanner } from '@/projects/AutosaveRecoveryBanner'
import type { SequentialProject } from '@/tools/sequential-number/types'
import type { AppRoute, PageMeta } from '@/types/navigation'
import type {
  ActiveProjectSession,
  OpenedPrinterProject,
  PrinterAppProjectResult
} from '@/types/projects'
import type { UnsavedChangesAction } from '../../../shared/project-types'
import type { AutosaveEntry } from '../../../shared/release-types'

const SequentialNumberPage = lazy(async () => ({
  default: (await import('@/tools/sequential-number/SequentialNumberPage')).SequentialNumberPage
}))

const AUTOSAVE_INTERVAL_MS = 60_000
const AccountAccessPage = lazy(async () => ({
  default: (await import('@/account/AccountAccessPage')).AccountAccessPage
}))
const DashboardPage = lazy(async () => ({
  default: (await import('@/app/DashboardPage')).DashboardPage
}))
const LicensePage = lazy(async () => ({
  default: (await import('@/licensing/LicensePage')).LicensePage
}))
const SettingsPage = lazy(async () => ({
  default: (await import('@/settings/SettingsPage')).SettingsPage
}))
const AppHealthPage = lazy(async () => ({
  default: (await import('@/settings/AppHealthPage')).AppHealthPage
}))
const JobsPage = lazy(async () => ({
  default: (await import('@/jobs/JobsPage')).JobsPage
}))
const ExportCenterPage = lazy(async () => ({
  default: (await import('@/exports/ExportCenterPage')).ExportCenterPage
}))
const QualityLabPage = lazy(() => import('@/quality/QualityLabPage'))
const BookletMontagePage = lazy(async () => ({
  default: (await import('@/tools/booklet-montage/BookletMontagePage')).BookletMontagePage
}))
const CutterMontagePage = lazy(async () => ({
  default: (await import('@/tools/cutter-montage/CutterMontagePage')).CutterMontagePage
}))
const HardcoverCoverPage = lazy(async () => ({
  default: (await import('@/tools/hardcover-cover/HardcoverCoverPage')).HardcoverCoverPage
}))

const pageMeta: Record<AppRoute, PageMeta> = {
  'sequential-number': {
    title: 'Sequential Number',
    subtitle: 'Tickets, invoices, and cut-stack numbering'
  },
  dashboard: {
    title: 'Production Dashboard',
    subtitle: 'Your print shop at a glance'
  },
  'booklet-montage': {
    title: 'Booklet Montage',
    subtitle: 'PDF imposition and print preparation'
  },
  'hardcover-cover': {
    title: 'Hardcover Cover',
    subtitle: 'Binding cover production'
  },
  'cutter-montage': {
    title: 'Cutter Montage',
    subtitle: 'Print-and-cut sheet preparation'
  },
  jobs: {
    title: 'Shop Jobs',
    subtitle: 'Jobs, quotes, and deadlines'
  },
  exports: {
    title: 'Export Center',
    subtitle: 'Production output history'
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
    title: 'Access & Subscription',
    subtitle: 'Trial and offline subscription-key activation'
  },
  settings: {
    title: 'Settings',
    subtitle: 'Workspace preferences and management'
  }
}

const appRoutes = new Set<AppRoute>([
  'dashboard',
  'booklet-montage',
  'hardcover-cover',
  'cutter-montage',
  'sequential-number',
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

interface PendingCutterImageImport {
  id: number
  files: File[]
}

function openedImageToFile(image: PrinterAppOpenedImageFile): File {
  const bytes = image.bytes instanceof Uint8Array ? image.bytes : new Uint8Array(image.bytes)
  const copiedBytes = new Uint8Array(bytes.byteLength)
  copiedBytes.set(bytes)

  return new File([copiedBytes.buffer], image.fileName, { type: image.mimeType })
}

function ToolLoadingFallback({ label }: { label: string }): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border bg-card px-4 py-3 text-sm font-medium text-muted-foreground"
    >
      {label}
    </div>
  )
}

function AccessLoadingScreen(): JSX.Element {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary text-xl font-black text-primary-foreground shadow-lg shadow-primary/25">
          M
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-lg font-bold text-foreground">Preparing workspace access…</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Checking your local account and subscription status.
          </p>
        </div>
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    </main>
  )
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
  const [pendingCutterImageImport, setPendingCutterImageImport] =
    useState<PendingCutterImageImport | null>(null)
  const [recoveryEntry, setRecoveryEntry] = useState<AutosaveEntry | null>(null)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [recoveryIsBusy, setRecoveryIsBusy] = useState(false)
  const bookletPdfImportIdRef = useRef(0)
  const cutterImageImportIdRef = useRef(0)
  const activeMeta = useMemo(() => pageMeta[activeRoute], [activeRoute])
  const account = useAccountState()
  const { settings: performanceSettings } = usePerformanceSettings()
  const license = useLicenseState()
  const isDeveloperAccess = license.state?.statusLabel === 'Developer Test Mode'
  const hasSubscriptionAccess = license.state?.mode === 'activated'
  const hasTrialAccountAccess =
    account.state?.status === 'signed-in' &&
    license.state?.mode === 'trial' &&
    !license.state.trial.isExpired
  const isAccessLoading = account.isLoading || license.isLoading
  const hasAppAccess = isDeveloperAccess || hasSubscriptionAccess || hasTrialAccountAccess
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

  useEffect(() => {
    return scheduleDailyShopBackup()
  }, [])

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

    void runtime
      .listAutosaves()
      .then((entries) => setRecoveryEntry(entries[0] ?? null))
      .catch(() =>
        setRecoveryError('Could not check recovery files. Open App Health to inspect autosaves.')
      )

    const timer = window.setInterval(() => {
      const session = activeProjectSessionRef.current
      if (!session?.isDirty) return
      void runtime
        .writeAutosave({ project: session.snapshot, originalFilePath: session.filePath })
        .catch(() =>
          setRecoveryError('Automatic recovery could not be saved. Save your project manually.')
        )
    }, AUTOSAVE_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [])

  const confirmUnsavedChanges = useCallback(
    async (action: UnsavedChangesAction): Promise<boolean> => {
      const session = activeProjectSessionRef.current

      if (!session?.isDirty) {
        return true
      }

      if (action === 'navigate' && activeRouteRef.current === 'hardcover-cover') {
        try {
          const result = await window.printerApp?.runtime?.writeAutosave({
            project: session.snapshot,
            originalFilePath: session.filePath
          })
          if (!result?.ok) {
            setRecoveryError('Could not save Hardcover recovery before switching tools.')
          }
        } catch {
          setRecoveryError('Could not save Hardcover recovery before switching tools.')
        }
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

  const restoreAutosave = useCallback(async (): Promise<void> => {
    if (!recoveryEntry || !window.printerApp?.runtime || recoveryIsBusy) return
    setRecoveryIsBusy(true)
    setRecoveryError(null)
    try {
      if (!(await confirmUnsavedChanges('open-project'))) return
      const result = await window.printerApp.runtime.readAutosave(recoveryEntry.filePath)
      if (!result.ok || !result.project || !isPrinterProjectFile(result.project)) {
        setRecoveryError(result.error ?? 'The recovery file could not be opened.')
        return
      }
      const projectRoute = result.project.metadata.tool
      clearActiveProjectSession()
      setPendingBookletPdfImport(null)
      setPendingCutterImageImport(null)
      setOpenedProject({
        filePath: recoveryEntry.originalFilePath ?? null,
        project: result.project,
        instanceId: Date.now()
      })
      activeRouteRef.current = projectRoute
      setActiveRoute(projectRoute)
      window.location.hash = '#/' + projectRoute
      setRecoveryEntry(null)
    } catch (error) {
      setRecoveryError(
        error instanceof Error ? error.message : 'Recovery could not be opened. Please try again.'
      )
    } finally {
      setRecoveryIsBusy(false)
    }
  }, [clearActiveProjectSession, confirmUnsavedChanges, recoveryEntry, recoveryIsBusy])

  const discardAutosave = useCallback(async (): Promise<void> => {
    if (!recoveryEntry || !window.printerApp?.runtime || recoveryIsBusy) return
    setRecoveryIsBusy(true)
    setRecoveryError(null)
    try {
      const result = await window.printerApp.runtime.discardAutosave(recoveryEntry.filePath)
      if (result.ok) {
        const remaining = await window.printerApp.runtime.listAutosaves()
        setRecoveryEntry(remaining[0] ?? null)
      } else {
        setRecoveryError(result.error ?? 'The autosave could not be discarded.')
      }
    } catch (error) {
      setRecoveryError(
        error instanceof Error
          ? error.message
          : 'The autosave could not be discarded. Please try again.'
      )
    } finally {
      setRecoveryIsBusy(false)
    }
  }, [recoveryEntry, recoveryIsBusy])

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
      setPendingCutterImageImport(null)

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
      setPendingCutterImageImport(null)
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
    setPendingCutterImageImport(null)
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

  const openImageFile = useCallback(async (): Promise<void> => {
    const stayingInCutter = activeRouteRef.current === 'cutter-montage'

    if (!stayingInCutter && !(await confirmUnsavedChanges('navigate'))) {
      return
    }

    if (!window.printerApp?.openImageFile) {
      window.alert('Opening image files is only available in the desktop app.')
      return
    }

    const result = await window.printerApp.openImageFile()

    if (result.canceled) return
    if (!result.ok || !result.files?.length) {
      window.alert(result.error ?? 'The selected image could not be opened.')
      return
    }

    if (!stayingInCutter) {
      clearActiveProjectSession()
      setOpenedProject(null)
    }

    cutterImageImportIdRef.current += 1
    setPendingBookletPdfImport(null)
    setPendingCutterImageImport({
      id: cutterImageImportIdRef.current,
      files: result.files.map(openedImageToFile)
    })
    activeRouteRef.current = 'cutter-montage'
    setActiveRoute('cutter-montage')
    window.location.hash = '#/cutter-montage'
  }, [clearActiveProjectSession, confirmUnsavedChanges])

  const consumeCutterImageImport = useCallback((requestId: number): void => {
    setPendingCutterImageImport((current) => (current?.id === requestId ? null : current))
  }, [])

  const signOut = useCallback(async (): Promise<void> => {
    if (!(await confirmUnsavedChanges('navigate'))) return
    const result = await account.signOut()
    if (!result.ok) {
      setRecoveryError(result.error ?? 'Could not sign out. Please try again.')
      return
    }
    clearActiveProjectSession()
    setOpenedProject(null)
    setPendingBookletPdfImport(null)
    setPendingCutterImageImport(null)
  }, [account.signOut, clearActiveProjectSession, confirmUnsavedChanges])

  if (isAccessLoading) {
    return <AccessLoadingScreen />
  }

  if (!hasAppAccess) {
    return (
      <Suspense fallback={<AccessLoadingScreen />}>
        <AccountAccessPage
          accountState={account.state}
          accountIsSubmitting={account.isSubmitting}
          accountError={account.error}
          onCreateAccount={account.createAccount}
          onSignIn={account.signIn}
          licenseState={license.state}
          licenseIsLoading={license.isLoading}
          licenseIsActivating={license.isActivating}
          licenseError={license.error}
          onActivateSerial={license.activateSerial}
        />
      </Suspense>
    )
  }

  return (
    <AppLayout
      activeRoute={activeRoute}
      pageMeta={activeMeta}
      onNavigate={navigate}
      isDeveloperMode={license.isDeveloperMode}
      account={account.state?.profile ?? null}
      onSignOut={() => void signOut()}
      onOpenProject={() => void openProject()}
      onOpenImageFile={() => void openImageFile()}
    >
      {recoveryError && !recoveryEntry && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-foreground/20 bg-warning p-4 text-sm text-warning-foreground"
        >
          <span>{recoveryError}</span>
          <button
            type="button"
            className="font-semibold underline underline-offset-4"
            onClick={() => setRecoveryError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
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
        <Suspense fallback={<ToolLoadingFallback label="Loading Dashboard..." />}>
          <DashboardPage
            licenseState={license.state}
            isLicenseLoading={license.isLoading}
            onNavigate={navigate}
            onOpenProject={openProject}
            onImportBookletPdf={importBookletPdf}
            onOpenImageFile={() => void openImageFile()}
          />
        </Suspense>
      )}
      {activeRoute === 'booklet-montage' && !showToolAccessOverlay && (
        <Suspense fallback={<ToolLoadingFallback label="Loading Booklet Montage..." />}>
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
        </Suspense>
      )}
      {activeRoute === 'hardcover-cover' && !showToolAccessOverlay && (
        <Suspense fallback={<ToolLoadingFallback label="Loading Hardcover Cover..." />}>
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
        </Suspense>
      )}
      {activeRoute === 'cutter-montage' && !showToolAccessOverlay && (
        <Suspense fallback={<ToolLoadingFallback label="Loading Cutter Montage..." />}>
          <CutterMontagePage
            key={openedProject?.instanceId ?? 'new-cutter'}
            onNavigate={navigate}
            onOpenProject={openProject}
            initialImageImport={pendingCutterImageImport}
            onInitialImageImportConsumed={consumeCutterImageImport}
            onProjectSessionChange={setActiveProjectSession}
            onConfirmUnsavedChanges={confirmUnsavedChanges}
            openedProject={
              openedProject?.project.metadata.tool === 'cutter-montage'
                ? (openedProject as OpenedPrinterProject<CutterProjectPayload>)
                : null
            }
          />
        </Suspense>
      )}
      {activeRoute === 'sequential-number' && !showToolAccessOverlay && (
        <Suspense fallback={<ToolLoadingFallback label="Loading Sequential Number…" />}>
          <SequentialNumberPage
            key={openedProject?.instanceId ?? 'new-sequential'}
            onNavigate={navigate}
            onOpenProject={openProject}
            onProjectSessionChange={setActiveProjectSession}
            onConfirmUnsavedChanges={confirmUnsavedChanges}
            openedProject={
              openedProject?.project.metadata.tool === 'sequential-number'
                ? (openedProject as OpenedPrinterProject<SequentialProject>)
                : null
            }
          />
        </Suspense>
      )}
      {activeRoute === 'license' && (
        <Suspense fallback={<ToolLoadingFallback label="Loading Access & Subscription..." />}>
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
        </Suspense>
      )}
      {activeRoute === 'settings' && (
        <Suspense fallback={<ToolLoadingFallback label="Loading Settings..." />}>
          <SettingsPage
            licenseState={license.state}
            isDeveloperMode={license.isDeveloperMode}
            onNavigate={navigate}
          />
        </Suspense>
      )}
      {activeRoute === 'jobs' && (
        <Suspense fallback={<ToolLoadingFallback label="Loading Shop Jobs..." />}>
          <JobsPage />
        </Suspense>
      )}
      {activeRoute === 'exports' && (
        <Suspense fallback={<ToolLoadingFallback label="Loading Export Center..." />}>
          <ExportCenterPage onNavigate={navigate} />
        </Suspense>
      )}
      {activeRoute === 'app-health' && (
        <Suspense fallback={<ToolLoadingFallback label="Loading App Health..." />}>
          <AppHealthPage
            license={license.state}
            performance={performanceSettings}
            isDeveloperMode={license.isDeveloperMode}
            onResetLicense={license.resetLocal}
            onNavigate={navigate}
          />
        </Suspense>
      )}
      {activeRoute === 'quality-lab' && license.isDeveloperMode && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Quality Lab…</p>}>
          <QualityLabPage onNavigate={navigate} />
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
