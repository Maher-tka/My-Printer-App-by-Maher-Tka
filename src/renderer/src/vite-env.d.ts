/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_UNLOCK_ALL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

import type {
  PrinterAppProjectResult,
  PrinterAppRecentProjectsResult,
  PrinterProjectFile
} from '@/types/projects'
import type { LicenseActivationResult, LicenseSnapshot } from '../../shared/licensing-types'
import type { UnsavedChangesRequest, UnsavedChangesResult } from '../../shared/project-types'
import type {
  AppHealthSnapshot,
  AutosaveEntry,
  AutosaveWriteRequest,
  DiagnosticContext,
  ExportContext,
  ExportHistoryEntry
} from '../../shared/release-types'

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

  interface Window {
    printerApp?: {
      platform: string
      storageMode: 'local-first'
      license: {
        getState: () => Promise<LicenseSnapshot>
        activateSerial: (serialKey: string) => Promise<LicenseActivationResult>
        resetLocal: () => Promise<LicenseSnapshot>
      }
      saveFile: (request: PrinterAppSaveFileRequest) => Promise<PrinterAppSaveResult>
      saveProject: (request: {
        suggestedName: string
        filePath?: string | null
        project: PrinterProjectFile
      }) => Promise<PrinterAppProjectResult>
      openProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
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
      }
    }
  }
}

export {}
