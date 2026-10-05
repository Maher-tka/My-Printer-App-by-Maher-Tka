import { contextBridge, ipcRenderer } from 'electron'
import type {
  AccountMutationResult,
  AccountSnapshot,
  CreateAccountRequest,
  SignInRequest,
  SubmitAccessRequest,
  AdminAccessAction,
  AccessAdminSnapshot
} from '../shared/account-types.js'
import type { SubscriptionPlanRecord } from '../shared/account-types.js'
import { SUBSCRIPTION_TOOLS } from '../shared/subscription-tools.js'
import type { LicenseActivationResult, LicenseSnapshot } from '../shared/licensing-types.js'
import type { PrintPdfFileRequest, PrintPdfRequest, PrintPdfResult } from '../shared/print-types.js'
import type { UnsavedChangesRequest, UnsavedChangesResult } from '../shared/project-types.js'
import type {
  ExportContext,
  ShopBackupRendererData,
  ShopBackupResult,
  ShopRestoreResult
} from '../shared/release-types.js'
import type { AppUpdateActionResult, AppUpdateSnapshot } from '../shared/update-types.js'

let activeProjectState: {
  project: unknown
  isDirty: boolean
  filePath?: string | null
  preflight?: Pick<ExportContext, 'warningsCount' | 'preflightStatus'>
} | null = null
let activeToolId: string | undefined

async function autosaveActiveProject(): Promise<void> {
  if (!activeProjectState?.isDirty) return
  await ipcRenderer.invoke('runtime:write-autosave', {
    project: activeProjectState.project,
    originalFilePath: activeProjectState.filePath
  })
}

function getActiveExportContext(): ExportContext | undefined {
  if (!activeProjectState?.project || typeof activeProjectState.project !== 'object')
    return activeToolId ? { toolId: activeToolId, toolType: activeToolId } : undefined
  const project = activeProjectState.project as {
    metadata?: { id?: string; jobName?: string; toolLabel?: string; tool?: string }
    payload?: { job?: { customerName?: string } }
  }
  return {
    toolId: activeToolId ?? project.metadata?.tool,
    toolType: project.metadata?.toolLabel ?? project.metadata?.tool,
    projectId: project.metadata?.id,
    projectName: project.metadata?.jobName,
    customerName: project.payload?.job?.customerName,
    ...activeProjectState.preflight
  }
}

contextBridge.exposeInMainWorld('printerApp', {
  setActiveTool: (route: string): void => {
    activeToolId = SUBSCRIPTION_TOOLS.find((tool) => tool.id === route)?.id
  },
  platform: process.platform,
  storageMode: 'local-first',
  account: {
    adminPlan: (plan: SubscriptionPlanRecord): Promise<AccountMutationResult> =>
      ipcRenderer.invoke('account:admin-plan', plan),
    verifyEmail: (request: { email: string; token: string }): Promise<AccountMutationResult> =>
      ipcRenderer.invoke('account:verify-email', request),
    sendRecovery: (email: string): Promise<AccountMutationResult> =>
      ipcRenderer.invoke('account:send-recovery', email),
    completeRecovery: (request: {
      email: string
      token: string
      password: string
    }): Promise<AccountMutationResult> => ipcRenderer.invoke('account:complete-recovery', request),
    signInGoogle: (): Promise<AccountMutationResult> => ipcRenderer.invoke('account:google'),
    cancelGoogle: (): Promise<void> => ipcRenderer.invoke('account:cancel-google'),
    requestAccess: (request: SubmitAccessRequest): Promise<AccountMutationResult> =>
      ipcRenderer.invoke('account:request-access', request),
    adminList: (): Promise<AccessAdminSnapshot> => ipcRenderer.invoke('account:admin-list'),
    adminAction: (action: AdminAccessAction): Promise<AccountMutationResult> =>
      ipcRenderer.invoke('account:admin-action', action),
    getState: (): Promise<AccountSnapshot> => ipcRenderer.invoke('account:get-state'),
    create: (request: CreateAccountRequest): Promise<AccountMutationResult> =>
      ipcRenderer.invoke('account:create', request),
    signIn: (request: SignInRequest): Promise<AccountMutationResult> =>
      ipcRenderer.invoke('account:sign-in', request),
    signOut: (): Promise<AccountMutationResult> => ipcRenderer.invoke('account:sign-out'),
    resetLocal: (): Promise<AccountSnapshot> => ipcRenderer.invoke('account:reset-local')
  },
  license: {
    getState: (): Promise<LicenseSnapshot> => ipcRenderer.invoke('license:get-state'),
    activateSerial: (serialKey: string): Promise<LicenseActivationResult> =>
      ipcRenderer.invoke('license:activate-serial', serialKey),
    resetLocal: (): Promise<LicenseSnapshot> => ipcRenderer.invoke('license:reset-local')
  },
  updates: {
    getState: (): Promise<AppUpdateSnapshot> => ipcRenderer.invoke('updates:get-state'),
    check: (): Promise<AppUpdateActionResult> => ipcRenderer.invoke('updates:check'),
    install: (): Promise<AppUpdateActionResult> => ipcRenderer.invoke('updates:install'),
    onStateChanged: (callback: (state: AppUpdateSnapshot) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: AppUpdateSnapshot): void =>
        callback(state)
      ipcRenderer.on('updates:state-changed', listener)

      return () => ipcRenderer.removeListener('updates:state-changed', listener)
    }
  },
  saveFile: async (request: {
    suggestedName: string
    bytes: Uint8Array
    filters: Array<{ name: string; extensions: string[] }>
  }) => {
    await autosaveActiveProject()
    return ipcRenderer.invoke('booklet:save-file', request, getActiveExportContext())
  },
  printPdf: async (request: PrintPdfRequest): Promise<PrintPdfResult> => {
    await autosaveActiveProject()
    return ipcRenderer.invoke('print:pdf', request, getActiveExportContext())
  },
  printPdfFile: (request: PrintPdfFileRequest): Promise<PrintPdfResult> =>
    ipcRenderer.invoke('print:pdf-file', request, getActiveExportContext()),
  saveProject: (request: { suggestedName: string; filePath?: string | null; project: unknown }) =>
    ipcRenderer.invoke('projects:save', request),
  openProject: (filePath?: string | null) => ipcRenderer.invoke('projects:open', filePath ?? null),
  openImageFile: () => ipcRenderer.invoke('files:open-image'),
  confirmUnsavedChanges: (request: UnsavedChangesRequest): Promise<UnsavedChangesResult> =>
    ipcRenderer.invoke('projects:confirm-unsaved', request),
  setProjectDirty: (dirty: boolean, projectName: string): Promise<void> =>
    ipcRenderer.invoke('projects:set-dirty', { dirty, projectName }),
  setActiveProjectSnapshot: (state: typeof activeProjectState): void => {
    activeProjectState = state
  },
  onSaveBeforeClose: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('projects:request-save-before-close', listener)

    return () => ipcRenderer.removeListener('projects:request-save-before-close', listener)
  },
  finishCloseAfterSave: (saved: boolean): Promise<void> =>
    ipcRenderer.invoke('projects:close-after-save', saved),
  listRecentProjects: () => ipcRenderer.invoke('projects:list-recent'),
  selectOutputFolder: () => ipcRenderer.invoke('booklet:select-output-folder'),
  writeFilesToFolder: async (
    folderPath: string,
    files: Array<{ fileName: string; bytes: Uint8Array }>
  ) => {
    await autosaveActiveProject()
    return ipcRenderer.invoke(
      'booklet:write-files-to-folder',
      folderPath,
      files,
      getActiveExportContext()
    )
  },
  runtime: {
    importEpsArtwork: (
      request: import('../shared/eps-import.js').EpsImportRequest
    ): Promise<import('../shared/eps-import.js').EpsImportResult> =>
      ipcRenderer.invoke('runtime:import-eps-artwork', request),
    exportIllustratorPdfBatch: (
      request: import('../shared/illustrator-pdf-export.js').IllustratorPdfBatchRequest
    ): Promise<import('../shared/illustrator-pdf-export.js').IllustratorPdfBatchResult> =>
      ipcRenderer.invoke('runtime:export-illustrator-pdf-batch', request),
    exportIllustratorPdf: (
      request: import('../shared/illustrator-pdf-export.js').IllustratorPdfExportRequest
    ): Promise<import('../shared/illustrator-pdf-export.js').IllustratorPdfExportResult> =>
      ipcRenderer.invoke('runtime:export-illustrator-pdf', request),
    getHealth: () => ipcRenderer.invoke('runtime:get-health'),
    openAppDataFolder: () => ipcRenderer.invoke('runtime:open-app-data'),
    clearTemporaryCache: () => ipcRenderer.invoke('runtime:clear-cache'),
    exportDiagnosticReport: (context: unknown) =>
      ipcRenderer.invoke('runtime:export-diagnostics', context),
    listExports: () => ipcRenderer.invoke('runtime:list-exports'),
    openPath: (filePath: string) => ipcRenderer.invoke('runtime:open-path', filePath),
    prepareFineCutJob: (
      request: import('../shared/finecut-handoff.js').FineCutHandoffRequest
    ): Promise<import('../shared/finecut-handoff.js').FineCutHandoffResult> =>
      ipcRenderer.invoke('runtime:prepare-finecut-job', request),
    openInIllustrator: (filePath: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('runtime:open-in-illustrator', filePath),
    openParentFolder: (filePath: string) =>
      ipcRenderer.invoke('runtime:open-parent-folder', filePath),
    writeAutosave: (request: unknown) => ipcRenderer.invoke('runtime:write-autosave', request),
    listAutosaves: () => ipcRenderer.invoke('runtime:list-autosaves'),
    readAutosave: (filePath: string) => ipcRenderer.invoke('runtime:read-autosave', filePath),
    discardAutosave: (filePath: string) => ipcRenderer.invoke('runtime:discard-autosave', filePath),
    openAutosaveFolder: () => ipcRenderer.invoke('runtime:open-autosaves'),
    createQualityFixtures: (label: string) =>
      ipcRenderer.invoke('runtime:create-quality-fixtures', label),
    createShopBackup: (data: ShopBackupRendererData): Promise<ShopBackupResult> =>
      ipcRenderer.invoke('runtime:create-shop-backup', data),
    createAutomaticBackup: (data: ShopBackupRendererData): Promise<ShopBackupResult> =>
      ipcRenderer.invoke('runtime:create-auto-backup', data),
    restoreShopBackup: (): Promise<ShopRestoreResult> =>
      ipcRenderer.invoke('runtime:restore-shop-backup'),
    openBackupFolder: (): Promise<string> => ipcRenderer.invoke('runtime:open-backups')
  }
})
