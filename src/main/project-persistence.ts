import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  UnsavedChangesAction,
  UnsavedChangesChoice,
  UnsavedChangesRequest,
  UnsavedChangesResult
} from '../shared/project-types.js'
import { clearProjectAutosaves, recordAppError } from './release-runtime.js'

const PROJECT_SCHEMA = 'com.maher-tka.my-printer-app.project'
const PROJECT_VERSION = 1
const LEGACY_PROJECT_EXTENSION = 'mpjob'
const MAX_RECENT_PROJECTS = 20
const APP_TITLE = 'My Printer App by Maher Tka'

interface ProjectWindowState {
  allowClose: boolean
  dirty: boolean
  projectName: string
  promptOpen: boolean
}

const projectWindowStates = new WeakMap<BrowserWindow, ProjectWindowState>()

type ProjectToolId = 'booklet-montage' | 'cutter-montage' | 'hardcover-cover'

const PROJECT_EXTENSIONS: Record<ProjectToolId, string> = {
  'booklet-montage': 'myprinter-booklet.json',
  'cutter-montage': 'myprinter-cutter.json',
  'hardcover-cover': 'myprinter-hardcover.json'
}
const ACCEPTED_PROJECT_EXTENSIONS = [...Object.values(PROJECT_EXTENSIONS), LEGACY_PROJECT_EXTENSION]

interface ProjectMetadata {
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

interface ProjectFile {
  schema: typeof PROJECT_SCHEMA
  version: typeof PROJECT_VERSION
  metadata: ProjectMetadata
  payload: Record<string, unknown>
}

interface SaveProjectRequest {
  suggestedName: string
  filePath?: string | null
  project: unknown
}

interface RecentProjectEntry {
  filePath: string
  metadata: ProjectMetadata
}

interface RecentJob {
  id: string
  jobName: string
  tool: string
  toolId: ProjectToolId
  filePath: string
  date: string
  updatedAt: string
  status: 'Saved' | 'Missing'
  summary?: string
  price?: number
}

export function registerProjectHandlers(): void {
  ipcMain.handle(
    'projects:confirm-unsaved',
    async (event, request: UnsavedChangesRequest): Promise<UnsavedChangesResult> => {
      const owner = BrowserWindow.fromWebContents(event.sender)
      const choice = await showUnsavedChangesDialog(
        owner,
        request?.projectName || 'Untitled Project',
        request?.action || 'navigate'
      )

      return { choice }
    }
  )

  ipcMain.handle(
    'projects:set-dirty',
    (event, request: { dirty?: boolean; projectName?: string }): void => {
      const owner = BrowserWindow.fromWebContents(event.sender)

      if (!owner) {
        return
      }

      const state = getProjectWindowState(owner)
      state.dirty = Boolean(request?.dirty)
      state.projectName = request?.projectName?.trim() || 'Untitled Project'
      updateWindowEditedState(owner, state)
    }
  )

  ipcMain.handle('projects:close-after-save', (event, saved: boolean): void => {
    const owner = BrowserWindow.fromWebContents(event.sender)

    if (!owner) {
      return
    }

    const state = getProjectWindowState(owner)
    state.promptOpen = false

    if (!saved) {
      return
    }

    state.dirty = false
    state.allowClose = true
    updateWindowEditedState(owner, state)
    owner.close()
  })

  ipcMain.handle('projects:save', async (event, request: SaveProjectRequest) => {
    try {
      if (!isProjectFile(request?.project)) {
        throw new Error('This project data is not a valid My Printer App job.')
      }

      let filePath = request.filePath?.trim() || null

      if (!filePath) {
        const owner = BrowserWindow.fromWebContents(event.sender)
        const options = {
          title: 'Save My Printer App job',
          defaultPath: ensureProjectExtension(
            request.suggestedName || 'Untitled Project',
            request.project.metadata.tool
          ),
          filters: [projectFileFilter]
        }
        const result = owner
          ? await dialog.showSaveDialog(owner, options)
          : await dialog.showSaveDialog(options)

        if (result.canceled || !result.filePath) {
          return { ok: false, canceled: true }
        }

        filePath = result.filePath
      }

      filePath = ensureProjectExtension(filePath, request.project.metadata.tool)
      await writeFile(filePath, `${JSON.stringify(request.project, null, 2)}\n`, 'utf8')
      await rememberProject(filePath, request.project.metadata)
      await clearProjectAutosaves(request.project.metadata.id)

      return {
        ok: true,
        filePath,
        project: request.project,
        recentJob: toRecentJob(filePath, request.project.metadata, 'Saved')
      }
    } catch (error) {
      recordAppError('project-save', error)
      return { ok: false, error: getErrorMessage(error) }
    }
  })

  ipcMain.handle('projects:open', async (event, requestedPath: string | null) => {
    try {
      let filePath = requestedPath?.trim() || null

      if (!filePath) {
        const owner = BrowserWindow.fromWebContents(event.sender)
        const options: OpenDialogOptions = {
          title: 'Open My Printer App job',
          properties: ['openFile'],
          filters: [projectFileFilter]
        }
        const result = owner
          ? await dialog.showOpenDialog(owner, options)
          : await dialog.showOpenDialog(options)

        if (result.canceled || result.filePaths.length === 0) {
          return { ok: false, canceled: true }
        }

        filePath = result.filePaths[0]
      }

      if (!hasAcceptedProjectExtension(filePath)) {
        throw new Error('Choose a My Printer App project file.')
      }

      const project = parseProjectFile(await readFile(filePath, 'utf8'))
      await rememberProject(filePath, project.metadata)

      return {
        ok: true,
        filePath,
        project,
        recentJob: toRecentJob(filePath, project.metadata, 'Saved')
      }
    } catch (error) {
      recordAppError('project-open', error)
      return { ok: false, error: getErrorMessage(error) }
    }
  })

  ipcMain.handle('projects:list-recent', async () => {
    try {
      const entries = await readRecentProjects()
      const jobs = await Promise.all(
        entries.map(async (entry) =>
          toRecentJob(
            entry.filePath,
            entry.metadata,
            (await fileExists(entry.filePath)) ? 'Saved' : 'Missing'
          )
        )
      )

      return { ok: true, jobs }
    } catch (error) {
      recordAppError('project-list', error)
      return { ok: false, error: getErrorMessage(error) }
    }
  })
}

export function attachProjectWindowProtection(window: BrowserWindow): void {
  projectWindowStates.set(window, {
    allowClose: false,
    dirty: false,
    projectName: 'Untitled Project',
    promptOpen: false
  })

  window.on('close', (event) => {
    const state = getProjectWindowState(window)

    if (state.allowClose || !state.dirty) {
      return
    }

    event.preventDefault()

    if (state.promptOpen) {
      return
    }

    state.promptOpen = true
    void showUnsavedChangesDialog(window, state.projectName, 'close-window').then((choice) => {
      if (window.isDestroyed()) {
        return
      }

      if (choice === 'discard') {
        state.dirty = false
        state.allowClose = true
        state.promptOpen = false
        updateWindowEditedState(window, state)
        window.close()
        return
      }

      if (choice === 'save') {
        window.webContents.send('projects:request-save-before-close')
        return
      }

      state.promptOpen = false
    })
  })
}

function getProjectWindowState(window: BrowserWindow): ProjectWindowState {
  const existing = projectWindowStates.get(window)

  if (existing) {
    return existing
  }

  const state: ProjectWindowState = {
    allowClose: false,
    dirty: false,
    projectName: 'Untitled Project',
    promptOpen: false
  }
  projectWindowStates.set(window, state)

  return state
}

async function showUnsavedChangesDialog(
  owner: BrowserWindow | null,
  projectName: string,
  action: UnsavedChangesAction
): Promise<UnsavedChangesChoice> {
  const options = {
    type: 'warning' as const,
    buttons: ['Save', 'Discard Changes', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    title: 'Unsaved changes',
    message: `Save changes to “${projectName}”?`,
    detail: getUnsavedChangesDetail(action)
  }
  const result = owner
    ? await dialog.showMessageBox(owner, options)
    : await dialog.showMessageBox(options)

  return (['save', 'discard', 'cancel'] as const)[result.response] ?? 'cancel'
}

function getUnsavedChangesDetail(action: UnsavedChangesAction): string {
  switch (action) {
    case 'open-project':
      return 'Your changes will be lost if you open another project without saving.'
    case 'new-project':
      return 'Your changes will be lost if you start a new project without saving.'
    case 'import-pdf':
      return 'Importing this PDF starts a new booklet project. Your current changes will be lost if you continue without saving.'
    case 'close-window':
      return 'Your changes will be lost if you close the app without saving.'
    default:
      return 'Your changes will be lost if you leave this project without saving.'
  }
}

function updateWindowEditedState(window: BrowserWindow, state: ProjectWindowState): void {
  window.setDocumentEdited(state.dirty)
  window.setTitle(`${state.dirty ? '* ' : ''}${APP_TITLE}`)
}

const projectFileFilter = {
  name: 'My Printer App Jobs',
  extensions: ACCEPTED_PROJECT_EXTENSIONS
}

function parseProjectFile(contents: string): ProjectFile {
  let parsed: unknown

  try {
    parsed = JSON.parse(contents)
  } catch {
    throw new Error('This file is not valid JSON and cannot be opened as a project.')
  }

  if (!isProjectFile(parsed)) {
    throw new Error('This file is not a supported My Printer App project.')
  }

  return parsed
}

function isProjectFile(value: unknown): value is ProjectFile {
  if (!isRecord(value) || !isRecord(value.metadata) || !isRecord(value.payload)) {
    return false
  }

  const metadata = value.metadata
  const tool = metadata.tool
  const commonPayloadIsValid =
    value.schema === PROJECT_SCHEMA &&
    value.version === PROJECT_VERSION &&
    (tool === 'booklet-montage' || tool === 'cutter-montage' || tool === 'hardcover-cover') &&
    isNonEmptyString(metadata.id) &&
    isNonEmptyString(metadata.jobName) &&
    isNonEmptyString(metadata.toolLabel) &&
    isNonEmptyString(metadata.createdAt) &&
    isNonEmptyString(metadata.updatedAt) &&
    typeof metadata.sourceCount === 'number' &&
    typeof metadata.itemCount === 'number' &&
    typeof metadata.summary === 'string' &&
    (metadata.price === undefined || typeof metadata.price === 'number')

  if (!commonPayloadIsValid) {
    return false
  }

  if (tool === 'booklet-montage') {
    return (
      isRecord(value.payload.settings) &&
      isRecord(value.payload.sheetBoardState) &&
      Array.isArray(value.payload.sources) &&
      Array.isArray(value.payload.pages)
    )
  }

  if (tool === 'hardcover-cover') {
    return (
      isRecord(value.payload.setup) &&
      isRecord(value.payload.content) &&
      isRecord(value.payload.template) &&
      Array.isArray(value.payload.batchStudents) &&
      isRecord(value.payload.exportSettings) &&
      isRecord(value.payload.job)
    )
  }

  return (
    typeof value.payload.mode === 'string' &&
    isRecord(value.payload.sheet) &&
    Array.isArray(value.payload.sources) &&
    Array.isArray(value.payload.pieces) &&
    Array.isArray(value.payload.placedPieces) &&
    isRecord(value.payload.layers) &&
    isRecord(value.payload.exportSettings)
  )
}

async function rememberProject(filePath: string, metadata: ProjectMetadata): Promise<void> {
  const entries = await readRecentProjects()
  const normalizedPath = filePath.toLowerCase()
  const nextEntries = [
    { filePath, metadata },
    ...entries.filter((entry) => entry.filePath.toLowerCase() !== normalizedPath)
  ].slice(0, MAX_RECENT_PROJECTS)

  await writeFile(getRecentProjectsPath(), JSON.stringify(nextEntries, null, 2), 'utf8')
}

async function readRecentProjects(): Promise<RecentProjectEntry[]> {
  try {
    const value: unknown = JSON.parse(await readFile(getRecentProjectsPath(), 'utf8'))

    if (!Array.isArray(value)) {
      return []
    }

    return value.filter(isRecentProjectEntry).slice(0, MAX_RECENT_PROJECTS)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return []
    }

    if (error instanceof SyntaxError) {
      return []
    }

    throw error
  }
}

function isRecentProjectEntry(value: unknown): value is RecentProjectEntry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.filePath) &&
    isRecord(value.metadata) &&
    (value.metadata.tool === 'booklet-montage' ||
      value.metadata.tool === 'cutter-montage' ||
      value.metadata.tool === 'hardcover-cover') &&
    isNonEmptyString(value.metadata.id) &&
    isNonEmptyString(value.metadata.jobName) &&
    isNonEmptyString(value.metadata.toolLabel) &&
    isNonEmptyString(value.metadata.createdAt) &&
    isNonEmptyString(value.metadata.updatedAt) &&
    typeof value.metadata.sourceCount === 'number' &&
    typeof value.metadata.itemCount === 'number' &&
    typeof value.metadata.summary === 'string' &&
    (value.metadata.price === undefined || typeof value.metadata.price === 'number')
  )
}

function toRecentJob(
  filePath: string,
  metadata: ProjectMetadata,
  status: RecentJob['status']
): RecentJob {
  return {
    id: metadata.id,
    jobName: metadata.jobName,
    tool: metadata.toolLabel,
    toolId: metadata.tool,
    filePath,
    date: metadata.updatedAt,
    updatedAt: metadata.updatedAt,
    status,
    summary: metadata.summary,
    price: metadata.price
  }
}

function getRecentProjectsPath(): string {
  return join(app.getPath('userData'), 'recent-projects.json')
}

function ensureProjectExtension(filePath: string, tool: ProjectToolId): string {
  return hasAcceptedProjectExtension(filePath)
    ? filePath
    : `${filePath}.${PROJECT_EXTENSIONS[tool]}`
}

function hasAcceptedProjectExtension(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase()
  return ACCEPTED_PROJECT_EXTENSIONS.some((extension) => lowerPath.endsWith(`.${extension}`))
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong with the project file.'
}
