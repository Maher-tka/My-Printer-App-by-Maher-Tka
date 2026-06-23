/// <reference types="vite/client" />

import type {
  PrinterAppProjectResult,
  PrinterAppRecentProjectsResult,
  PrinterProjectFile
} from '@/types/projects'
import type {
  LicenseActivationResult,
  LicenseSnapshot
} from '../../shared/licensing-types'

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
      }
      saveFile: (request: PrinterAppSaveFileRequest) => Promise<PrinterAppSaveResult>
      saveProject: (request: {
        suggestedName: string
        filePath?: string | null
        project: PrinterProjectFile
      }) => Promise<PrinterAppProjectResult>
      openProject: (filePath?: string | null) => Promise<PrinterAppProjectResult>
      listRecentProjects: () => Promise<PrinterAppRecentProjectsResult>
      selectOutputFolder: () => Promise<PrinterAppFolderResult>
      writeFilesToFolder: (
        folderPath: string,
        files: PrinterAppWriteFileRequest[]
      ) => Promise<PrinterAppWriteFilesResult>
    }
  }
}

export {}
