import { prepareFineCutJob } from './finecut-handoff.js'
import { importEpsArtwork } from './eps-import.js'
import { exportIllustratorPdf, exportIllustratorPdfBatch } from './illustrator-pdf-export.js'
import { assertOnlineProductionAccess } from './online-account.js'
import { writeJsonAtomically } from './atomic-json.js'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell,
  type OpenDialogOptions
} from 'electron'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import type {
  AppHealthSnapshot,
  AutosaveEntry,
  AutosaveWriteRequest,
  DiagnosticContext,
  ExportContext,
  ExportHistoryEntry,
  ExportStatus,
  ShopBackupRendererData,
  ShopBackupResult,
  ShopRestoreResult
} from '../shared/release-types.js'
import {
  MAX_SHOP_BACKUP_BYTES,
  MAX_SHOP_BACKUP_PROJECTS,
  SHOP_BACKUP_SCHEMA,
  SHOP_BACKUP_VERSION,
  isShopBackupEnvelope,
  sanitizeShopBackupRendererData,
  type ShopBackupEnvelope,
  type ShopBackupProject
} from '../shared/shop-backup-validation.js'

import {
  mergeRestoredExportHistory,
  remapRestoredProjectPaths
} from '../shared/shop-backup-restore.js'

const MAX_EXPORT_HISTORY = 200
const MAX_RECENT_ERRORS = 30
const MAX_AUTOSAVES = 3
const LARGE_AUTOSAVE_WARNING_BYTES = 25 * 1024 * 1024
const MAX_AUTOSAVE_METADATA_BYTES = 256 * 1024
const EXPORT_HISTORY_FILE = 'export-history.json'
const AUTOSAVE_FOLDER = 'autosaves'
const AUTOSAVE_FILE_EXTENSION = '.myprinter-autosave.json'
const AUTOSAVE_METADATA_EXTENSION = '.meta.json'
const SHOP_BACKUP_FOLDER = 'backups'

const recentErrors: AppHealthSnapshot['recentErrors'] = []
const reportedAutosaveIssues = new Set<string>()

export function registerReleaseRuntimeHandlers(): void {
  ipcMain.handle('runtime:import-eps-artwork', async (_event, request: unknown) => {
    await assertOnlineProductionAccess('paid-tools', 'card-montage')
    return importEpsArtwork(request, app.getPath('temp'))
  })
  ipcMain.handle('runtime:export-illustrator-pdf-batch', async (event, request: unknown) => {
    await assertOnlineProductionAccess('batch-exports', 'cutter-montage')
    return exportIllustratorPdfBatch(request, BrowserWindow.fromWebContents(event.sender))
  })
  ipcMain.handle('runtime:export-illustrator-pdf', async (event, request: unknown) => {
    await assertOnlineProductionAccess('paid-tools', 'cutter-montage')
    return exportIllustratorPdf(request, BrowserWindow.fromWebContents(event.sender))
  })
  ipcMain.handle('runtime:prepare-finecut-job', async (_event, request: unknown) => {
    await assertOnlineProductionAccess('paid-tools', 'cutter-montage')
    return prepareFineCutJob(request)
  })
  ipcMain.handle('runtime:get-health', getAppHealthSnapshot)
  ipcMain.handle('runtime:open-app-data', () => shell.openPath(app.getPath('userData')))
  ipcMain.handle('runtime:clear-cache', clearTemporaryCache)
  ipcMain.handle('runtime:export-diagnostics', async (event, context: DiagnosticContext) =>
    exportDiagnosticReport(BrowserWindow.fromWebContents(event.sender), context)
  )
  ipcMain.handle('runtime:list-exports', readExportHistory)
  ipcMain.handle('runtime:open-path', async (_event, filePath: string) => shell.openPath(filePath))
  ipcMain.handle('runtime:open-in-illustrator', async (_event, filePath: string) =>
    assertOnlineProductionAccess('paid-tools', 'cutter-montage').then(() =>
      openInIllustrator(filePath)
    )
  )
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
  ipcMain.handle('runtime:create-shop-backup', (event, rendererData: ShopBackupRendererData) =>
    createShopBackup(BrowserWindow.fromWebContents(event.sender), rendererData, false)
  )
  ipcMain.handle('runtime:create-auto-backup', (_event, rendererData: ShopBackupRendererData) =>
    createShopBackup(null, rendererData, true)
  )
  ipcMain.handle('runtime:restore-shop-backup', (event) =>
    restoreShopBackup(BrowserWindow.fromWebContents(event.sender))
  )
  ipcMain.handle('runtime:open-backups', openShopBackupFolder)
}

async function openInIllustrator(filePath: string): Promise<{ ok: boolean; error?: string }> {
  if (extname(filePath).toLowerCase() !== '.svg') {
    return { ok: false, error: 'FineCut handoff requires an SVG file.' }
  }

  try {
    await stat(filePath)
    const illustratorPath =
      'C:\\Program Files\\Adobe\\Adobe Illustrator 2026\\Support Files\\Contents\\Windows\\Illustrator.exe'
    await stat(illustratorPath)
    const child = spawn(illustratorPath, [filePath], {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Adobe Illustrator 2026 could not be opened.'
    }
  }
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
      .map((entry) => removeAutosaveFiles(entry.filePath))
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
    availableTools: ['Booklet Montage', 'Cutter Montage', 'Hardcover Cover', 'Sequential Number']
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

async function createShopBackup(
  owner: BrowserWindow | null,
  rendererData: ShopBackupRendererData,
  automatic: boolean
): Promise<ShopBackupResult> {
  try {
    const backup = await buildShopBackup(rendererData)
    let filePath: string

    if (automatic) {
      const folder = getShopBackupPath()
      await mkdir(folder, { recursive: true })
      filePath = join(
        folder,
        `my-printer-auto-${backup.createdAt.slice(0, 10)}.myprinter-backup.json`
      )
      try {
        await stat(filePath)
        return { ok: true, filePath, projectCount: backup.projects.length }
      } catch (error) {
        if (!isNodeError(error) || error.code !== 'ENOENT') throw error
      }
    } else {
      const options = {
        title: 'Back up My Printer App shop data',
        defaultPath: `my-printer-shop-backup-${backup.createdAt.slice(0, 10)}.myprinter-backup.json`,
        filters: [{ name: 'My Printer App backup', extensions: ['json'] }]
      }
      const result = owner
        ? await dialog.showSaveDialog(owner, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return { ok: false, canceled: true }
      filePath = result.filePath
    }

    await writeJson(filePath, backup)
    return { ok: true, filePath, projectCount: backup.projects.length }
  } catch (error) {
    recordAppError(automatic ? 'auto-backup' : 'shop-backup', error)
    return { ok: false, error: getErrorMessage(error) }
  }
}

async function buildShopBackup(rendererData: ShopBackupRendererData): Promise<ShopBackupEnvelope> {
  const safeRendererData = sanitizeShopBackupRendererData(rendererData)
  const recentProjects = await readJsonArray<{ filePath?: unknown }>(
    join(app.getPath('userData'), 'recent-projects.json')
  )
  const projects: ShopBackupProject[] = []

  const linkedProjects = safeRendererData.jobs.flatMap((job) => {
    const path = (job as { localProjectPath?: unknown }).localProjectPath
    return typeof path === 'string' && path.trim() ? [{ filePath: path }] : []
  })
  const projectEntries = [...linkedProjects, ...recentProjects].filter(
    (entry, index, all) => all.findIndex((other) => other.filePath === entry.filePath) === index
  )
  for (const entry of projectEntries.slice(0, MAX_SHOP_BACKUP_PROJECTS)) {
    if (typeof entry.filePath !== 'string' || !entry.filePath.trim()) continue
    try {
      const project = await readJsonRecord(entry.filePath)
      if (!isProjectEnvelope(project)) continue
      projects.push({
        originalPath: entry.filePath,
        fileName: basename(entry.filePath),
        project
      })
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        recordAppError('backup-project-read', error)
      }
    }
  }

  return {
    schema: SHOP_BACKUP_SCHEMA,
    version: SHOP_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    rendererData: safeRendererData,
    projects,
    exportHistory: await readExportHistory()
  }
}

async function restoreShopBackup(owner: BrowserWindow | null): Promise<ShopRestoreResult> {
  try {
    const openOptions: OpenDialogOptions = {
      title: 'Choose a My Printer App backup',
      properties: ['openFile'],
      filters: [{ name: 'My Printer App backup', extensions: ['json'] }]
    }
    const selected = owner
      ? await dialog.showOpenDialog(owner, openOptions)
      : await dialog.showOpenDialog(openOptions)
    if (selected.canceled || !selected.filePaths[0]) return { ok: false, canceled: true }

    const backupStats = await stat(selected.filePaths[0])
    if (backupStats.size <= 0 || backupStats.size > MAX_SHOP_BACKUP_BYTES) {
      throw new Error(`Backup must be between 1 byte and ${formatBytes(MAX_SHOP_BACKUP_BYTES)}.`)
    }

    const candidate: unknown = JSON.parse(await readFile(selected.filePaths[0], 'utf8'))
    if (!isShopBackupEnvelope(candidate)) {
      throw new Error('This file is not a supported My Printer App shop backup.')
    }

    const destinationOptions: OpenDialogOptions = {
      title: 'Choose a folder for restored project files',
      properties: ['openDirectory', 'createDirectory']
    }
    const destination = owner
      ? await dialog.showOpenDialog(owner, destinationOptions)
      : await dialog.showOpenDialog(destinationOptions)
    if (destination.canceled || !destination.filePaths[0]) return { ok: false, canceled: true }

    const restoredProjectPaths: string[] = []
    const restoredPathMap = new Map<string, string>()
    const recentPath = join(app.getPath('userData'), 'recent-projects.json')
    const existingRecent = await readJsonArray<{ filePath?: unknown; metadata?: unknown }>(
      recentPath
    )
    const existingExports = await readExportHistory()
    const restoredRecentEntries: Array<{ filePath: string; metadata: unknown }> = []
    try {
      for (const backedUpProject of candidate.projects) {
        const targetPath = await getAvailableRestorePath(
          destination.filePaths[0],
          backedUpProject.fileName
        )
        await writeJson(targetPath, backedUpProject.project)
        restoredProjectPaths.push(targetPath)
        restoredPathMap.set(backedUpProject.originalPath, targetPath)
        restoredRecentEntries.push({
          filePath: targetPath,
          metadata: backedUpProject.project.metadata
        })
      }

      await writeJson(
        recentPath,
        [...restoredRecentEntries, ...existingRecent]
          .filter(
            (entry, index, all) =>
              typeof entry.filePath === 'string' &&
              all.findIndex((other) => other.filePath === entry.filePath) === index
          )
          .slice(0, 20)
      )
      await writeJson(
        getExportHistoryPath(),
        mergeRestoredExportHistory(candidate.exportHistory, existingExports, MAX_EXPORT_HISTORY)
      )
    } catch (error) {
      const rollback = await Promise.allSettled([
        writeJson(recentPath, existingRecent),
        writeJson(getExportHistoryPath(), existingExports),
        ...restoredProjectPaths.map((filePath) => rm(filePath, { force: true }))
      ])
      for (const result of rollback) {
        if (result.status === 'rejected') recordAppError('shop-restore-rollback', result.reason)
      }
      throw error
    }

    return {
      ok: true,
      filePath: selected.filePaths[0],
      projectCount: restoredProjectPaths.length,
      restoredProjectPaths,
      rendererData: remapRestoredProjectPaths(candidate.rendererData, restoredPathMap),
      createdAt: candidate.createdAt
    }
  } catch (error) {
    recordAppError('shop-restore', error)
    return { ok: false, error: getErrorMessage(error) }
  }
}

async function getAvailableRestorePath(folder: string, requestedName: string): Promise<string> {
  const safeName = basename(requestedName) || 'restored-project.myprinter-project.json'
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const name = suffix === 0 ? safeName : `restored-${suffix + 1}-${safeName}`
    const candidate = join(folder, name)
    try {
      await stat(candidate)
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return candidate
      throw error
    }
  }
  throw new Error('Could not find an available filename for a restored project.')
}

async function openShopBackupFolder(): Promise<string> {
  await mkdir(getShopBackupPath(), { recursive: true })
  return shell.openPath(getShopBackupPath())
}

function getShopBackupPath(): string {
  return join(app.getPath('userData'), SHOP_BACKUP_FOLDER)
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
    try {
      await writeJson(getAutosaveMetadataPath(filePath), { autosave: entry })
    } catch (error) {
      recordAutosaveIssue('autosave-metadata-write', filePath, error)
    }
    await listProjectAutosaves()
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
        .filter((name) => name.endsWith(AUTOSAVE_FILE_EXTENSION))
        .map((name) => readAutosaveEntrySummary(join(folder, name)))
    )
    const sortedEntries = entries
      .filter((entry): entry is AutosaveEntry => Boolean(entry))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    // Enforce the global limit on reads too, so existing recovery backlogs are trimmed.
    await Promise.all(
      sortedEntries.slice(MAX_AUTOSAVES).map(async (entry) => {
        try {
          await removeAutosaveFiles(entry.filePath)
        } catch (error) {
          recordAutosaveIssue('autosave-prune', entry.filePath, error)
        }
      })
    )
    return sortedEntries.slice(0, MAX_AUTOSAVES)
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
    if (!isProjectEnvelope(value.project)) {
      throw new Error('This autosave is damaged or unsupported.')
    }
    const fallbackEntry = await readAutosaveEntrySummary(filePath)
    const entry = isAutosaveEntry(value.autosave) ? { ...value.autosave, filePath } : fallbackEntry

    return { ok: true, project: value.project, ...(entry ? { entry } : {}) }
  } catch (error) {
    recordAutosaveIssue('autosave-read', filePath, error)
    return { ok: false, error: getErrorMessage(error) }
  }
}

async function discardProjectAutosave(filePath: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (dirname(filePath).toLowerCase() !== getAutosavePath().toLowerCase()) {
      throw new Error('Only files inside the autosave folder can be discarded.')
    }
    await removeAutosaveFiles(filePath)
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
  await writeJsonAtomically(filePath, value)
}

async function readAutosaveEntrySummary(filePath: string): Promise<AutosaveEntry | null> {
  const metadataEntry = await readAutosaveMetadataEntry(filePath)

  if (metadataEntry) {
    return metadataEntry
  }

  try {
    const stats = await stat(filePath)
    if (stats.size >= LARGE_AUTOSAVE_WARNING_BYTES) {
      recordAutosaveIssue(
        'autosave-summary',
        filePath,
        new Error(
          `Large autosave (${formatBytes(stats.size)}) has no readable metadata sidecar; using a filename fallback so startup can continue.`
        )
      )
    }
    return createFallbackAutosaveEntry(filePath, stats.mtime)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return null
    recordAutosaveIssue('autosave-summary', filePath, error)
    return null
  }
}

async function readAutosaveMetadataEntry(filePath: string): Promise<AutosaveEntry | null> {
  const metadataPath = getAutosaveMetadataPath(filePath)
  try {
    const metadataStats = await stat(metadataPath)
    if (metadataStats.size > MAX_AUTOSAVE_METADATA_BYTES) {
      recordAutosaveIssue(
        'autosave-metadata',
        filePath,
        new Error(
          `Autosave metadata sidecar is too large (${formatBytes(metadataStats.size)} at ${metadataPath}); using the autosave file details instead.`
        )
      )
      return null
    }

    const value = await readJsonRecord(metadataPath)
    const entry = isAutosaveEntry(value.autosave) ? value.autosave : value

    if (isAutosaveEntry(entry)) {
      return { ...entry, filePath }
    }

    recordAutosaveIssue(
      'autosave-metadata',
      filePath,
      new Error(
        `Autosave metadata sidecar is damaged or unsupported at ${metadataPath}; using the autosave file details instead.`
      )
    )
    return null
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null
    }

    recordAutosaveIssue('autosave-metadata', filePath, error, { metadataPath })
    return null
  }
}

function createFallbackAutosaveEntry(filePath: string, modifiedAt: Date): AutosaveEntry {
  const fileName = filePath.split(/[\\/]/).pop() ?? 'autosave'
  const parsed = parseAutosaveFileName(fileName)

  return {
    id: parsed.id,
    projectId: parsed.projectId,
    projectName: 'Recovered unsaved project',
    toolType: 'unknown',
    createdAt: parsed.createdAt ?? modifiedAt.toISOString(),
    filePath
  }
}

function parseAutosaveFileName(fileName: string): {
  id: string
  projectId: string
  createdAt?: string
} {
  const baseName = fileName.endsWith(AUTOSAVE_FILE_EXTENSION)
    ? fileName.slice(0, -AUTOSAVE_FILE_EXTENSION.length)
    : fileName
  const match = /^(.*)-(\d+)$/.exec(baseName)
  const timestamp = match ? Number(match[2]) : NaN
  const createdAt = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
  const projectId = match?.[1] || baseName || 'unknown-project'

  return {
    id: baseName || randomUUID(),
    projectId,
    createdAt
  }
}

async function removeAutosaveFiles(filePath: string): Promise<void> {
  await Promise.all([
    rm(filePath, { force: true }),
    rm(getAutosaveMetadataPath(filePath), { force: true })
  ])
}

function recordAutosaveIssue(
  area: string,
  filePath: string,
  error: unknown,
  details?: unknown
): void {
  const cause = getErrorMessage(error)
  const message = `Autosave issue in ${filePath}: ${cause}`
  const key = `${area}:${message}`

  if (reportedAutosaveIssues.has(key)) {
    return
  }

  if (reportedAutosaveIssues.size > MAX_RECENT_ERRORS * 4) {
    reportedAutosaveIssues.clear()
  }
  reportedAutosaveIssues.add(key)

  if (details === undefined) {
    console.error(`[runtime:${area}] ${message}`)
  } else {
    console.error(`[runtime:${area}] ${message}`, details)
  }

  recordAppError(area, new Error(message))
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

function getAutosaveMetadataPath(filePath: string): string {
  return `${filePath}${AUTOSAVE_METADATA_EXTENSION}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
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
