/// <reference types="vite/client" />

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
      saveFile: (request: PrinterAppSaveFileRequest) => Promise<PrinterAppSaveResult>
      selectOutputFolder: () => Promise<PrinterAppFolderResult>
      writeFilesToFolder: (
        folderPath: string,
        files: PrinterAppWriteFileRequest[]
      ) => Promise<PrinterAppWriteFilesResult>
    }
  }
}

export {}
