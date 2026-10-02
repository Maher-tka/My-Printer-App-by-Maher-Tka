/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_UNLOCK_ALL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

import type {
  AccountMutationResult,
  AccountSnapshot,
  CreateAccountRequest,
  SignInRequest,
  SubmitAccessRequest,
  AdminAccessAction,
  AccessAdminSnapshot
} from '../../shared/account-types'
import type {
  PrinterAppProjectResult,
  PrinterAppRecentProjectsResult,
  PrinterProjectFile
} from '@/types/projects'
import type { LicenseActivationResult, LicenseSnapshot } from '../../shared/licensing-types'
import type { PrintPdfFileRequest, PrintPdfRequest, PrintPdfResult } from '../../shared/print-types'
import type { UnsavedChangesRequest, UnsavedChangesResult } from '../../shared/project-types'
import type {
  AppHealthSnapshot,
  AutosaveEntry,
  AutosaveWriteRequest,
  DiagnosticContext,
  ExportContext,
  ExportHistoryEntry,
  ShopBackupRendererData,
  ShopBackupResult,
  ShopRestoreResult
} from '../../shared/release-types'
import type { AppUpdateActionResult, AppUpdateSnapshot } from '../../shared/update-types'

declare global {
  interface PrinterAppFileFilter {
    name: string
    extensions: string[]
  }

  interface PrinterAppSaveFileRequest {
    suggestedName: string
    bytes: Uint8Array
    filters: PrinterAppFileFilter[]
  }

  interface PrinterAppWriteFileRequest {
    fileName: string
    bytes: Uint8Array
  }

  interface PrinterAppSaveResult {
    ok: boolean
    canceled?: boolean
    filePath?: string
    error?: string
  }

  interface PrinterAppFolderResult {
    ok: boolean
    canceled?: boolean
    folderPath?: string
    error?: string
  }

  interface PrinterAppWriteFilesResult {
    ok: boolean
    filePaths?: string[]
    error?: string
  }

  interface PrinterAppOpenedImageFile {
    fileName: string
    filePath: string
    mimeType: string
    bytes: Uint8Array | number[] | ArrayBuffer
  }

  interface PrinterAppOpenImageResult {
    ok: boolean
    canceled?: boolean
    files?: PrinterAppOpenedImageFile[]
    error?: string
  }

  interface Window {
    printerApp?: {
      platform: string
      storageMode: 'local-first'
      account: {
        verifyEmail: (request: { email: string; token: string }) => Promise<AccountMutationResult>
        sendRecovery: (email: string) => Promise<AccountMutationResult>
        completeRecovery: (request: {
          email: string
          token: string
          password: string
        }) => Promise<AccountMutationResult>
        signInGoogle: () => Promise<AccountMutationResult>
        cancelGoogle: () => Promise<void>
        requestAccess: (request: SubmitAccessRequest) => Promise<AccountMutationResult>
        adminList: () => Promise<AccessAdminSnapshot>
        adminAction: (action: AdminAccessAction) => Promise<AccountMutationResult>
        getState: () => Promise<AccountSnapshot>
        create: (request: CreateAccountRequest) => Promise<AccountMutationResult>
        signIn: (request: SignInRequest) => Promise<AccountMutationResult>
        signOut: () => Promise<AccountMutationResult>
        resetLocal: () => Promise<AccountSnapshot>
      }
      license: {
        getState: () => Promise<LicenseSnapshot>
        activateSerial: (serialKey: string) => Promise<LicenseActivationResult>
        resetLocal: () => Promise<LicenseSnapshot>
      }
      updates: {
        getState: () => Promise<AppUpdateSnapshot>
        check: () => Promise<AppUpdateActionResult>
        install: () => Promise<AppUpdateActionResult>
        onStateChanged: (callback: (state: AppUpdateSnapshot) => void) => () => void
      }
      saveFile: (request: PrinterAppSaveFileRequest) => Promise<PrinterAppSaveResult>
      printPdf: (request: PrintPdfRequest) => Promise<PrintPdfResult>
      printPdfFile: (request: PrintPdfFileRequest) => Promise<PrintPdfResult>
      saveProject: (request: {
        suggestedName: string
        filePath?: string | null
        project: PrinterProjectFile
      }) => Promise<PrinterAppProjectResult>
      openProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
      openImageFile: () => Promise<PrinterAppOpenImageResult>
      confirmUnsavedChanges: (request: UnsavedChangesRequest) => Promise<UnsavedChangesResult>
      setProjectDirty: (dirty: boolean, projectName: string) => Promise<void>
      setActiveProjectSnapshot: (
        state: {
          project: PrinterProjectFile
          isDirty: boolean
          filePath?: string | null
          preflight?: Pick<ExportContext, 'warningsCount' | 'preflightStatus'>
        } | null
      ) => void
      onSaveBeforeClose: (callback: () => void) => () => void
      finishCloseAfterSave: (saved: boolean) => Promise<void>
      listRecentProjects: () => Promise<PrinterAppRecentProjectsResult>
      selectOutputFolder: () => Promise<PrinterAppFolderResult>
      writeFilesToFolder: (
        folderPath: string,
        files: PrinterAppWriteFileRequest[]
      ) => Promise<PrinterAppWriteFilesResult>
      runtime: {
        getHealth: () => Promise<AppHealthSnapshot>
        openAppDataFolder: () => Promise<string>
        clearTemporaryCache: () => Promise<{ ok: boolean; message?: string; error?: string }>
        exportDiagnosticReport: (context: DiagnosticContext) => Promise<PrinterAppSaveResult>
        listExports: () => Promise<ExportHistoryEntry[]>
        openPath: (filePath: string) => Promise<string>
        prepareFineCutJob: (
          request: import('../../shared/finecut-handoff').FineCutHandoffRequest
        ) => Promise<import('../../shared/finecut-handoff').FineCutHandoffResult>
        openInIllustrator: (filePath: string) => Promise<{ ok: boolean; error?: string }>
        openParentFolder: (filePath: string) => Promise<void>
        writeAutosave: (
          request: AutosaveWriteRequest
        ) => Promise<{ ok: boolean; entry?: AutosaveEntry; error?: string }>
        listAutosaves: () => Promise<AutosaveEntry[]>
        readAutosave: (filePath: string) => Promise<{
          ok: boolean
          project?: PrinterProjectFile
          entry?: AutosaveEntry
          error?: string
        }>
        discardAutosave: (filePath: string) => Promise<{ ok: boolean; error?: string }>
        openAutosaveFolder: () => Promise<string>
        createQualityFixtures: (label: string) => Promise<{
          ok: boolean
          folderPath?: string
          files?: string[]
          error?: string
        }>
        createShopBackup: (data: ShopBackupRendererData) => Promise<ShopBackupResult>
        createAutomaticBackup: (data: ShopBackupRendererData) => Promise<ShopBackupResult>
        restoreShopBackup: () => Promise<ShopRestoreResult>
        openBackupFolder: () => Promise<string>
      }
    }
  }
}

export {}
