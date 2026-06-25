export type ExportStatus = 'success' | 'failed' | 'canceled'

export interface ExportContext {
  toolType?: string
  projectId?: string
  projectName?: string
  customerName?: string
  warningsCount?: number
  preflightStatus?: 'passed' | 'warnings' | 'errors'
}

export interface ExportHistoryEntry extends Required<Pick<ExportContext, 'projectName'>> {
  id: string
  toolType: string
  projectId?: string
  customerName?: string
  exportType: string
  filePath?: string
  timestamp: string
  status: ExportStatus
  warningsCount: number
  preflightStatus: 'passed' | 'warnings' | 'errors' | 'not-recorded'
  error?: string
}

export interface AppHealthSnapshot {
  appVersion: string
  electronVersion: string
  platform: string
  architecture: string
  appDataPath: string
  autosavePath: string
  cachePath: string
  isPackaged: boolean
  lastExportPath?: string
  lastError?: string
  recentErrors: Array<{ timestamp: string; message: string; area: string }>
  recentJobsCount: number
  recentExportsCount: number
  availableTools: string[]
}

export interface DiagnosticContext {
  licenseStatus: string
  licensePlan: string
  performancePreset: string
  memoryMode: string
}

export interface AutosaveEntry {
  id: string
  projectId: string
  projectName: string
  toolType: string
  createdAt: string
  filePath: string
  originalFilePath?: string
}

export interface AutosaveWriteRequest {
  project: unknown
  originalFilePath?: string | null
}
