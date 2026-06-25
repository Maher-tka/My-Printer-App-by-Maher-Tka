import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AppHealthSnapshot,
  AutosaveEntry,
  AutosaveWriteRequest,
  DiagnosticContext,
  ExportContext,
  ExportHistoryEntry,
  ExportStatus
} from '../shared/release-types.js'

const MAX_EXPORT_HISTORY = 200
const MAX_RECENT_ERRORS = 30
const MAX_AUTOSAVES_PER_PROJECT = 5
const EXPORT_HISTORY_FILE = 'export-history.json'
const AUTOSAVE_FOLDER = 'autosaves'

const recentErrors: AppHealthSnapshot['recentErrors'] = []

export function registerReleaseRuntimeHandlers(): void {
  ipcMain.handle('runtime:get-health', getAppHealthSnapshot)
  ipcMain.handle('runtime:open-app-data', () => shell.openPath(app.getPath('userData')))
  ipcMain.handle('runtime:clear-cache', clearTemporaryCache)
  ipcMain.handle('runtime:export-diagnostics', async (event, context: DiagnosticContext) =>
    exportDiagnosticReport(BrowserWindow.fromWebContents(event.sender), context)
  )
  ipcMain.handle('runtime:list-exports', readExportHistory)
  ipcMain.handle('runtime:open-path', async (_event, filePath: string) => shell.openPath(filePath))
  ipcMain.handle('runtime:open-parent-folder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })
  ipcMain.handle('runtime:write-autosave', (_event, request: AutosaveWriteRequest) =>
    writeProjectAutosave(request)
  )
  ipcMain.handle('runtime:list-autosaves', listProjectAutosaves)
  ipcMain.handle('runtime:read-autosave', (_event, filePath: string) =>
    readProjectAutosave(filePath)
  )
  ipcMain.handle('runtime:discard-autosave', (_event, filePath: string) =>
    discardProjectAutosave(filePath)
  )
  ipcMain.handle('runtime:open-autosaves', openAutosaveFolder)
  ipcMain.handle('runtime:create-quality-fixtures', (_event, label: string) =>
    createQualityFixtures(label)
  )
}

export function recordAppError(area: string, error: unknown): void {
  recentErrors.unshift({
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    area
  })
  recentErrors.splice(MAX_RECENT_ERRORS)
}

export async function recordExportResult(input: {
  status: ExportStatus
  context?: ExportContext
  suggestedName: string
  filePath?: string
  error?: unknown
}): Promise<void> {
  const extension = extname(input.filePath ?? input.suggestedName)
    .replace('.', '')
    .toUpperCase()
  const entry: ExportHistoryEntry = {
    id: randomUUID(),
    toolType: input.context?.toolType ?? 'Unknown tool',
    projectId: input.context?.projectId,
    projectName: input.context?.projectName?.trim() || 'Untitled Project',
    customerName: input.context?.customerName,
    exportType: extension || 'FILE',
    filePath: input.filePath,
    timestamp: new Date().toISOString(),
    status: input.status,
    warningsCount: input.context?.warningsCount ?? 0,
    preflightStatus: input.context?.preflightStatus ?? 'not-recorded',
    ...(input.error
      ? { error: input.error instanceof Error ? input.error.message : String(input.error) }
      : {})
  }

  if (input.error) recordAppError('export', input.error)

  const current = await readExportHistory()
  await writeJson(getExportHistoryPath(), [entry, ...current].slice(0, MAX_EXPORT_HISTORY))
}

export async function clearProjectAutosaves(projectId: string): Promise<void> {
  const entries = await listProjectAutosaves()
  await Promise.all(
    entries
      .filter((entry) => entry.projectId === projectId)
      .map((entry) => rm(entry.filePath, { force: true }))
  )
}

async function getAppHealthSnapshot(): Promise<AppHealthSnapshot> {
  const [exports, recentJobsCount] = await Promise.all([readExportHistory(), readRecentJobsCount()])
  const lastSuccessfulExport = exports.find((entry) => entry.status === 'success' && entry.filePath)

  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    architecture: process.arch,
    appDataPath: app.getPath('userData'),
    autosavePath: getAutosavePath(),
    cachePath: app.getPath('sessionData'),
    isPackaged: app.isPackaged,
    lastExportPath: lastSuccessfulExport?.filePath,
    lastError: recentErrors[0]?.message,
    recentErrors: [...recentErrors],
    recentJobsCount,
    recentExportsCount: exports.length,
    availableTools: ['Booklet Montage', 'Cutter Montage', 'Hardcover Cover']
  }
}

async function clearTemporaryCache(): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    await session.defaultSession.clearCache()
    const tempFolder = join(app.getPath('userData'), 'temp')
    await rm(tempFolder, { recursive: true, force: true })
    await mkdir(tempFolder, { recursive: true })
    return { ok: true, message: 'Temporary cache cleared.' }
  } catch (error) {
    recordAppError('cache', error)
    return { ok: false, error: getErrorMessage(error) }
  }
}

async function exportDiagnosticReport(
  owner: BrowserWindow | null,
  context: DiagnosticContext
): Promise<{ ok: boolean; canceled?: boolean; filePath?: string; error?: string }> {
  try {
    const health = await getAppHealthSnapshot()
    const exports = await readExportHistory()
    const report = {
      generatedAt: new Date().toISOString(),
      app: {
        version: health.appVersion,
        electronVersion: health.electronVersion,
        platform: health.platform,
        architecture: health.architecture,
        packaged: health.isPackaged
      },
      localPaths: {
        appData: health.appDataPath,
        autosaves: health.autosavePath,
        cache: health.cachePath
      },
      license: { status: context.licenseStatus, plan: context.licensePlan },
      performance: { preset: context.performancePreset, memoryMode: context.memoryMode },
      recentErrors: health.recentErrors,
      recentJobsCount: health.recentJobsCount,
      recentExports: exports.slice(0, 25).map(({ id: _id, ...entry }) => entry)
    }
    const options = {
      title: 'Export diagnostic report',
      defaultPath: `my-printer-app-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON report', extensions: ['json'] }]
    }
    const result = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }
    await writeFile(result.filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    return { ok: true, filePath: result.filePath }
  } catch (error) {
    recordAppError('diagnostics', error)
    return { ok: false, error: getErrorMessage(error) }
  }
}

async function readExportHistory(): Promise<ExportHistoryEntry[]> {
  return readJsonArray<ExportHistoryEntry>(getExportHistoryPath())
}

async function writeProjectAutosave(
  request: AutosaveWriteRequest
): Promise<{ ok: boolean; entry?: AutosaveEntry; error?: string }> {
  try {
    if (!isProjectEnvelope(request?.project)) {
      throw new Error('Autosave requires a valid project snapshot.')
    }
    const project = request.project
    const createdAt = new Date().toISOString()
    const safeProjectId = safeSegment(project.metadata.id)
    const folder = getAutosavePath()
    const filePath = join(folder, `${safeProjectId}-${Date.now()}.myprinter-autosave.json`)
    const entry: AutosaveEntry = {
      id: randomUUID(),
      projectId: project.metadata.id,
      projectName: project.metadata.jobName,
      toolType: project.metadata.tool,
      createdAt,
      filePath,
      ...(request.originalFilePath ? { originalFilePath: request.originalFilePath } : {})
    }
    await mkdir(folder, { recursive: true })
    await writeJson(filePath, { autosave: entry, project })
    await pruneProjectAutosaves(project.metadata.id)
    return { ok: true, entry }
  } catch (error) {
    recordAppError('autosave', error)
    return { ok: false, error: getErrorMessage(error) }
  }
}

async function listProjectAutosaves(): Promise<AutosaveEntry[]> {
  const folder = getAutosavePath()
  try {
    const names = await readdir(folder)
    const entries = await Promise.all(
      names
        .filter((name) => name.endsWith('.myprinter-autosave.json'))
        .map(async (name) => {
          const filePath = join(folder, name)
          const value = await readJsonRecord(filePath)
          return isAutosaveEntry(value.autosave) ? { ...value.autosave, filePath } : null
        })
    )
    return entries
      .filter((entry): entry is AutosaveEntry => Boolean(entry))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return []
    recordAppError('autosave-list', error)
    return []
  }
}

async function readProjectAutosave(
  filePath: string
): Promise<{ ok: boolean; project?: unknown; entry?: AutosaveEntry; error?: string }> {
  try {
    const value = await readJsonRecord(filePath)
    if (!isProjectEnvelope(value.project) || !isAutosaveEntry(value.autosave)) {
      throw new Error('This autosave is damaged or unsupported.')
    }
    return { ok: true, project: value.project, entry: { ...value.autosave, filePath } }
  } catch (error) {
    recordAppError('autosave-read', error)
    return { ok: false, error: getErrorMessage(error) }
  }
}

async function discardProjectAutosave(filePath: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (dirname(filePath).toLowerCase() !== getAutosavePath().toLowerCase()) {
      throw new Error('Only files inside the autosave folder can be discarded.')
    }
    await rm(filePath, { force: true })
    return { ok: true }
  } catch (error) {
    recordAppError('autosave-discard', error)
    return { ok: false, error: getErrorMessage(error) }
  }
}

async function openAutosaveFolder(): Promise<string> {
  await mkdir(getAutosavePath(), { recursive: true })
  return shell.openPath(getAutosavePath())
}

async function pruneProjectAutosaves(projectId: string): Promise<void> {
  const entries = (await listProjectAutosaves()).filter((entry) => entry.projectId === projectId)
  await Promise.all(
    entries.slice(MAX_AUTOSAVES_PER_PROJECT).map((entry) => rm(entry.filePath, { force: true }))
  )
}

async function createQualityFixtures(
  label: string
): Promise<{ ok: boolean; folderPath?: string; files?: string[]; error?: string }> {
  if (app.isPackaged) {
    return { ok: false, error: 'Quality Lab is only available in development mode.' }
  }
  try {
    const folderPath = join(app.getPath('temp'), 'My Printer App Quality Lab')
    await mkdir(folderPath, { recursive: true })
    const safeLabel = safeSegment(label || 'test')
    const filePath = join(folderPath, `${safeLabel}-${Date.now()}.json`)
    await writeJson(filePath, {
      test: label,
      generatedAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: process.platform,
      note: 'Synthetic Quality Lab fixture. No customer artwork is included.'
    })
    return { ok: true, folderPath, files: [filePath] }
  } catch (error) {
    recordAppError('quality-lab', error)
    return { ok: false, error: getErrorMessage(error) }
  }
}

async function readRecentJobsCount(): Promise<number> {
  const entries = await readJsonArray<unknown>(
    join(app.getPath('userData'), 'recent-projects.json')
  )
  return entries.length
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const value: unknown = JSON.parse(await readFile(filePath, 'utf8'))
    return Array.isArray(value) ? (value as T[]) : []
  } catch (error) {
    if ((isNodeError(error) && error.code === 'ENOENT') || error instanceof SyntaxError) return []
    throw error
  }
}

async function readJsonRecord(filePath: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await readFile(filePath, 'utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a JSON object.')
  }
  return value as Record<string, unknown>
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function isProjectEnvelope(
  value: unknown
): value is { metadata: { id: string; jobName: string; tool: string } } {
  if (!value || typeof value !== 'object' || !('metadata' in value)) return false
  const metadata = (value as { metadata?: unknown }).metadata
  return Boolean(
    metadata &&
    typeof metadata === 'object' &&
    typeof (metadata as { id?: unknown }).id === 'string' &&
    typeof (metadata as { jobName?: unknown }).jobName === 'string' &&
    typeof (metadata as { tool?: unknown }).tool === 'string'
  )
}

function isAutosaveEntry(value: unknown): value is AutosaveEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<AutosaveEntry>
  return Boolean(
    entry.id && entry.projectId && entry.projectName && entry.toolType && entry.createdAt
  )
}

function getExportHistoryPath(): string {
  return join(app.getPath('userData'), EXPORT_HISTORY_FILE)
}

function getAutosavePath(): string {
  return join(app.getPath('userData'), AUTOSAVE_FOLDER)
}

function safeSegment(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'project'
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The local runtime operation failed.'
}
