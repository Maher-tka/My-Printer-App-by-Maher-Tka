import { contextBridge, ipcRenderer } from 'electron'
import type {
  AccountMutationResult,
  AccountSnapshot,
  CreateAccountRequest,
  SignInRequest
} from '../shared/account-types.js'
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

async function autosaveActiveProject(): Promise<void> {
  if (!activeProjectState?.isDirty) return
  await ipcRenderer.invoke('runtime:write-autosave', {
    project: activeProjectState.project,
    originalFilePath: activeProjectState.filePath
  })
}

function getActiveExportContext(): ExportContext | undefined {
  if (!activeProjectState?.project || typeof activeProjectState.project !== 'object')
    return undefined
  const project = activeProjectState.project as {
    metadata?: { id?: string; jobName?: string; toolLabel?: string; tool?: string }
    payload?: { job?: { customerName?: string } }
  }
  return {
    toolType: project.metadata?.toolLabel ?? project.metadata?.tool,
    projectId: project.metadata?.id,
    projectName: project.metadata?.jobName,
    customerName: project.payload?.job?.customerName,
    ...activeProjectState.preflight
  }
}

contextBridge.exposeInMainWorld('printerApp', {
  platform: process.platform,
  storageMode: 'local-first',
  account: {
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
