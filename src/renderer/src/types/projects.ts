export const PRINTER_PROJECT_SCHEMA = 'com.maher-tka.my-printer-app.project'
export const PRINTER_PROJECT_VERSION = 1
export const LEGACY_PRINTER_PROJECT_EXTENSION = 'mpjob'

export type ProjectToolId = 'booklet-montage' | 'cutter-montage' | 'hardcover-cover'

export const PRINTER_PROJECT_EXTENSIONS: Record<ProjectToolId, string> = {
  'booklet-montage': 'myprinter-booklet.json',
  'cutter-montage': 'myprinter-cutter.json',
  'hardcover-cover': 'myprinter-hardcover.json'
}

export type JobStatus = 'Saved' | 'Missing'

export interface ProjectMetadata {
  id: string
  jobName: string
  tool: ProjectToolId
  toolLabel: string
  createdAt: string
  updatedAt: string
  sourceCount: number
  itemCount: number
  summary: string
  price?: number
}

export interface PrinterProjectFile<TPayload = unknown> {
  schema: typeof PRINTER_PROJECT_SCHEMA
  version: typeof PRINTER_PROJECT_VERSION
  metadata: ProjectMetadata
  payload: TPayload
}

export interface RecentJob {
  id: string
  jobName: string
  tool: string
  toolId: ProjectToolId
  filePath: string
  date: string
  updatedAt: string
  status: JobStatus
  summary?: string
  price?: number
}

export interface PrinterAppProjectResult<TPayload = unknown> {
  ok: boolean
  canceled?: boolean
  filePath?: string
  project?: PrinterProjectFile<TPayload>
  recentJob?: RecentJob
  error?: string
}

export interface PrinterAppRecentProjectsResult {
  ok: boolean
  jobs?: RecentJob[]
  error?: string
}

export interface OpenedPrinterProject<TPayload = unknown> {
  filePath: string | null
  project: PrinterProjectFile<TPayload>
}

export interface ActiveProjectSession {
  isDirty: boolean
  projectName: string
  filePath: string | null
  snapshot: PrinterProjectFile
  preflight?: {
    warningsCount: number
    preflightStatus: 'passed' | 'warnings' | 'errors'
  }
  save: () => Promise<boolean>
}
