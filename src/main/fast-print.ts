import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { nativePrintSession, parseNativePrintRequest } from '../shared/fast-print-native.js'
import { loadIdDraft, saveIdDraft } from './fast-print-id-draft.js'
import { loadReviewedPolaroid } from './fast-print-polaroid-cache.js'
import { MAX_IDS_PER_SHEET } from '../shared/fast-print-id.js'
import {
  createFastPrintChoices,
  defaultFastPrintStock,
  type FastPrintDevice,
  type FastPrintSavedStock
} from '../shared/fast-print-menu.js'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile, copyFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { runPrinterScript as powershell } from './printer-driver-runtime.js'
import { printerPreferencesStore } from './printer-preferences.js'
import { fastPrintOptionId, preferredProfile } from '../shared/printer-preferences.js'
import { assertOnlineProductionAccess } from './online-account.js'
import {
  validateFastPrintPreset,
  type FastPrintPreset,
  type FastPrintSubmitOptions
} from '../shared/fast-print.js'
import {
  normalizeFastPrintSelection,
  parseFastPrintSelectionManifest
} from '../shared/fast-print-batch.js'

const switches = [
  '--fast-print',
  '--fast-print-request',
  '--fast-print-preview',
  '--fast-print-menu',
  '--fast-print-batch',
  '--install-fast-print',
  '--install-fast-print-machine',
  '--remove-fast-print-machine',
  '--remove-fast-print',
  '--manage-fast-print'
]
// Only inspect switches before the file separator, never the selected filename.
const args = process.argv.slice(
  0,
  process.argv.indexOf('--') < 0 ? undefined : process.argv.indexOf('--')
)
export const isFastPrintCommand = switches.some((flag) => args.includes(flag))

export async function runFastPrintCommand(): Promise<void> {
  let exitCode = 0
  try {
    if (process.platform !== 'win32') throw new Error('Explorer Fast Print requires Windows.')
    if (
      args.includes('--install-fast-print-machine') ||
      args.includes('--remove-fast-print-machine')
    ) {
      const remove = args.includes('--remove-fast-print-machine')
      console.log(
        await powershell('fast-print-machine.ps1', [
          '-Action',
          remove ? 'Remove' : 'Install',
          '-Executable',
          process.execPath,
          ...(!app.isPackaged ? ['-AppPath', app.getAppPath()] : [])
        ])
      )
      // Remove earlier per-user registrations so there is exactly one Explorer entry.
      await powershell('fast-print-menu.ps1', ['-Action', 'Remove'])
    } else if (args.includes('--fast-print-request') || args.includes('--fast-print-preview')) {
      const previewOnly = args.includes('--fast-print-preview')
      if (!previewOnly) await assertOnlineProductionAccess('paid-tools', 'fast-print')
      const requestPath =
        args[args.indexOf(previewOnly ? '--fast-print-preview' : '--fast-print-request') + 1]
      if (!requestPath) throw new Error('Missing native Fast Print request.')
      const directory = nativePrintSession(requestPath, app.getPath('temp'))
      let returnedToSettings = false
      let nativeIdSession = false
      try {
        if ((await stat(requestPath)).size > 4 * 1024 * 1024)
          throw new Error('The print request is too large.')
        const request = parseNativePrintRequest(await readFile(requestPath, 'utf8'))
        nativeIdSession = request.preset.mode === 'id-card'
        if (previewOnly && !request.preset.mode?.startsWith('polaroid-'))
          throw new Error('Only Polaroid sheets use background preparation.')
        const result = await runJob(request.files, request.preset, {
          toolId: 'fast-print',
          copies: request.copies,
          profileDirectory: directory,
          preparedPolaroid: !previewOnly && request.preparedPolaroid,
          ...(previewOnly ? { previewDirectory: join(directory, 'preview') } : {})
        })
        returnedToSettings = result.returnedToSettings === true
      } catch (error) {
        if (previewOnly)
          await writeFile(
            join(directory, 'preview-error.txt'),
            error instanceof Error ? error.message : String(error)
          )
        throw error
      } finally {
        // The native ID window owns its snapshots/draft across repeated reviews,
        // including failed printer validation. It cleans them when finally closed.
        if (!previewOnly && !returnedToSettings && !nativeIdSession)
          await rm(directory, { recursive: true, force: true })
      }
    } else if (args.includes('--fast-print-batch')) {
      await assertOnlineProductionAccess('paid-tools', 'fast-print')
      const manifestPath = args[args.indexOf('--fast-print-batch') + 1]
      if (!manifestPath) throw new Error('The Explorer batch selection is missing.')
      const manifest = resolve(manifestPath)
      if ((await stat(manifest)).size > 4 * 1024 * 1024)
        throw new Error('The file selection is too large.')
      const ownedDirectory = resolve(app.getPath('temp'), 'maher-fast-print-selection')
      const isOwned =
        resolve(manifest, '..').toLowerCase() === ownedDirectory.toLowerCase() &&
        /^\{[0-9a-f-]+\}\.json$/i.test(basename(manifest))
      let files: string[]
      try {
        files = parseFastPrintSelectionManifest(await readFile(manifest, 'utf8')).map((path) =>
          resolve(path)
        )
      } finally {
        if (isOwned) await rm(manifest, { force: true })
      }
      await showFastPrintMenu(files)
    } else if (args.includes('--fast-print-menu')) {
      await assertOnlineProductionAccess('paid-tools', 'fast-print')
      const separator = process.argv.indexOf('--')
      const files = separator < 0 ? [] : process.argv.slice(separator + 1)
      await showFastPrintMenu(normalizeFastPrintSelection(files.map((path) => resolve(path))))
    } else if (args.includes('--manage-fast-print')) {
      await powershell('fast-print-settings.ps1', ['-Action', 'Manage'])
    } else if (args.includes('--install-fast-print') || args.includes('--remove-fast-print')) {
      const remove = args.includes('--remove-fast-print')
      const output = await powershell('fast-print-menu.ps1', [
        '-Action',
        remove ? 'Remove' : 'Install',
        '-Executable',
        process.execPath,
        ...(!app.isPackaged ? ['-AppPath', app.getAppPath()] : [])
      ])
      console.log(output)
      if (!args.includes('--fast-print-quiet') && !process.env.FAST_PRINT_NONINTERACTIVE) {
        await dialog.showMessageBox({
          type: 'info',
          title: 'Fast Print',
          message: output,
          detail: remove
            ? 'The Explorer menu has been removed.'
            : 'Right-click a PDF, PNG, JPEG, or GIF file → Show more options → Fast Print. Choose your printer, options, and saved presets in the Fast Print window, then click Print.'
        })
      }
    } else {
      await assertOnlineProductionAccess('paid-tools', 'fast-print')
      const index = args.indexOf('--fast-print')
      const token = args[index + 1]
      if (!token || token.length > 4096)
        throw new Error('The Fast Print preset is missing or invalid.')
      const preset = validateFastPrintPreset(
        JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
      )
      const separator = process.argv.indexOf('--')
      const paths = separator < 0 ? [] : process.argv.slice(separator + 1)
      const files = normalizeFastPrintSelection(paths.map((path) => resolve(path)))
      if (!app.isPackaged && process.env.FAST_PRINT_VERIFY_DIR) await runJob(files, preset)
      else await showFastPrintMenu(files, preset)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[fast-print]', message)
    if (!args.includes('--fast-print-quiet') && !process.env.FAST_PRINT_NONINTERACTIVE) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Fast Print could not finish',
        message,
        detail: 'If submission had already started, check the Windows print queue before retrying.'
      })
    }
    exitCode = 1
  } finally {
    app.exit(exitCode)
  }
}

async function validateSelection(files: string[]): Promise<void> {
  for (const filePath of files) {
    const file = await stat(filePath)
    if (!file.isFile() || file.size === 0 || file.size > 512 * 1024 * 1024) {
      throw new Error(`Choose a non-empty document smaller than 512 MB: ${basename(filePath)}`)
    }
  }
}

async function showFastPrintMenu(
  filePaths: string[],
  initialPreset?: FastPrintPreset
): Promise<void> {
  const files = normalizeFastPrintSelection(filePaths)
  await validateSelection(files)
  if (!app.isPackaged && process.env.FAST_PRINT_MENU_VERIFY) {
    const devices = JSON.parse(
      await powershell('fast-print-menu.ps1', ['-Action', 'List'])
    ) as FastPrintDevice[]
    const profiles = JSON.parse(
      await powershell('fast-print-settings.ps1', ['-Action', 'List'])
    ) as FastPrintSavedStock[]
    await writeFile(
      process.env.FAST_PRINT_MENU_VERIFY,
      JSON.stringify(
        createFastPrintChoices(devices, profiles, await printerPreferencesStore().read()),
        null,
        2
      )
    )
    return
  }
  const helper = app.isPackaged
    ? join(process.resourcesPath, 'fast-print', 'FastPrint.exe')
    : join(app.getAppPath(), 'out', 'native', 'FastPrint.exe')
  const directory = await mkdtemp(join(app.getPath('temp'), 'maher-fast-print-launch-'))
  try {
    const manifest = join(directory, 'selection.json')
    await writeFile(manifest, JSON.stringify({ version: 1, files }))
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    delete env.ELECTRON_RENDERER_URL
    await promisify(execFile)(
      helper,
      [
        '--app',
        process.execPath,
        ...(!app.isPackaged ? ['--app-path', app.getAppPath()] : []),
        ...(initialPreset
          ? ['--preset', Buffer.from(JSON.stringify(initialPreset)).toString('base64')]
          : []),
        '--batch',
        manifest
      ],
      { windowsHide: true, env }
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

let savedDriverJobRunning = false
export async function runSavedDriverPrint(
  filePath: string,
  preset: FastPrintPreset,
  options: { toolId?: string; copies?: number }
): Promise<{ ok: boolean; canceled?: boolean }> {
  if (savedDriverJobRunning) throw new Error('Another saved-driver print job is still running.')
  savedDriverJobRunning = true
  try {
    return await runJob([filePath], preset, options)
  } finally {
    savedDriverJobRunning = false
  }
}
async function runJob(
  filePaths: string[],
  preset: FastPrintPreset,
  jobOptions: {
    toolId?: string
    copies?: number
    profileDirectory?: string
    previewDirectory?: string
    preparedPolaroid?: boolean
  } = {
    toolId: 'fast-print'
  }
): Promise<{ ok: boolean; canceled?: boolean; returnedToSettings?: boolean }> {
  const files = normalizeFastPrintSelection(filePaths)
  await validateSelection(files)
  const canReturnToSettings = preset.mode === 'id-card' && Boolean(jobOptions.profileDirectory)
  const idDraft = canReturnToSettings
    ? await loadIdDraft(jobOptions.profileDirectory!, files)
    : undefined
  const jobName = files.length === 1 ? basename(files[0]) : `Fast Print - ${files.length} documents`
  const printers = jobOptions.previewDirectory
    ? [{ name: preset.printer, papers: ['A4'], color: true, duplex: false }]
    : (JSON.parse(await powershell('fast-print-menu.ps1', ['-Action', 'List'])) as Array<{
        name: string
        papers: string[]
        color: boolean
        duplex?: boolean
      }>)
  if (!preset.profileId) {
    const preferences = await printerPreferencesStore().read()
    const stocks = JSON.parse(
      await powershell('fast-print-settings.ps1', ['-Action', 'List'])
    ) as FastPrintSavedStock[]
    const stock = defaultFastPrintStock(stocks, preset.printer, preset.paper)
    const preferred =
      preferredProfile(preferences, preset.printer, fastPrintOptionId(preset)) ?? stock?.id
    if (preferred) preset = { ...preset, profileId: preferred }
  }
  if (preset.profileId && !jobOptions.previewDirectory) {
    const profile = JSON.parse(
      await powershell('fast-print-settings.ps1', [
        '-Action',
        'Resolve',
        '-ProfileId',
        preset.profileId,
        ...(jobOptions.profileDirectory ? ['-ProfileDirectory', jobOptions.profileDirectory] : [])
      ])
    ) as {
      printer: string
      paper: string
      name: string
      landscape: boolean
      duplex: string
      color: boolean
      paperWidthMm?: number
      paperHeightMm?: number
    }
    if (
      profile.printer !== preset.printer ||
      (preset.mode !== 'document' && profile.paper !== preset.paper)
    ) {
      throw new Error('This preset has changed. Refresh the printer list and choose it again.')
    }
    preset = {
      ...preset,
      landscape: profile.landscape,
      profileName: profile.name,
      duplex: ['Vertical', 'Horizontal'].includes(profile.duplex),
      ...(preset.mode === 'document'
        ? {
            color: profile.color,
            paperWidthMm: profile.paperWidthMm ?? (profile.paper === 'A3' ? 297 : 210),
            paperHeightMm: profile.paperHeightMm ?? (profile.paper === 'A3' ? 420 : 297)
          }
        : {})
    }
  }
  const printer = printers.find((item) => item.name === preset.printer)
  if (preset.mode === 'polaroid-8' || preset.mode === 'polaroid-9') {
    preset = { ...preset, landscape: preset.mode === 'polaroid-8', duplex: false }
  }
  if (!printer)
    throw new Error(
      'The selected printer is no longer installed. Use Refresh printer list in Fast Print.'
    )
  if (preset.mode !== 'document' && !printer.papers.includes(preset.paper))
    throw new Error(`This printer does not support ${preset.paper}.`)
  if (preset.color && !printer.color) throw new Error('This printer does not support color.')
  if (preset.mode === 'id-card' && !preset.profileId)
    preset = { ...preset, duplex: printer.duplex === true }
  if (jobOptions.previewDirectory) await mkdir(jobOptions.previewDirectory, { recursive: true })
  const reviewed = jobOptions.preparedPolaroid
    ? await loadReviewedPolaroid(
        jobOptions.profileDirectory!,
        preset.mode as 'polaroid-8' | 'polaroid-9',
        files
      )
    : undefined
  const temp = await mkdtemp(
    jobOptions.previewDirectory
      ? join(jobOptions.previewDirectory, 'render-')
      : join(app.getPath('temp'), 'maher-fast-print-')
  )
  const sheets: string[] = []
  if (reviewed) {
    try {
      for (const sheet of reviewed.sheets) {
        const destination = join(temp, basename(sheet))
        await copyFile(sheet, destination)
        sheets.push(destination)
      }
    } catch (error) {
      await rm(temp, { recursive: true, force: true })
      throw error
    }
    console.log('[polaroid-reviewed]', sheets.length)
  }
  const sheetSizes: Array<{ widthMm: number; heightMm: number }> = []
  const backgroundPreparation = Boolean(
    jobOptions.previewDirectory ||
    (!app.isPackaged &&
      process.env.FAST_PRINT_VERIFY_DIR &&
      process.env.FAST_PRINT_NONINTERACTIVE === '1')
  )
  const window = new BrowserWindow({
    width: preset.mode === 'id-card' ? 1160 : 490,
    height: preset.mode === 'id-card' ? 720 : 310,
    minWidth: preset.mode === 'id-card' ? 800 : undefined,
    minHeight: preset.mode === 'id-card' ? 600 : undefined,
    resizable: preset.mode === 'id-card',
    autoHideMenuBar: true,
    title: 'Fast Print',
    backgroundColor: '#f5f7fb',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/fast-print.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: !backgroundPreparation,
      // ID setup uses the app's saved language, theme and performance preferences.
      ...(preset.mode !== 'id-card' ? { partition: 'fast-print-' + basename(temp) } : {})
    }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  if (jobOptions.previewDirectory || (!app.isPackaged && process.env.FAST_PRINT_VERIFY_DIR)) {
    window.webContents.on('console-message', ({ message }) => {
      if (
        message.startsWith('[polaroid-progress]') ||
        (!app.isPackaged && message.startsWith('[polaroid-photo]')) ||
        message.includes('Smart photo analysis unavailable')
      )
        console.log(message)
    })
  }
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  let submitted = false
  let returnedToSettings = false
  let returningToSettings = false
  let done = false
  let acceptingSheet = false
  let preparedBytes = 0
  let currentSheetWrite: Promise<void> = Promise.resolve()
  let finish!: (value?: unknown) => void
  let fail!: (reason: Error) => void
  const ready = new Promise((resolve, reject) => {
    finish = resolve
    fail = reject
  })
  // Attach immediately so load failures cannot cause an unhandled rejection.
  void ready.catch(() => undefined)
  function authorize(event: Electron.IpcMainInvokeEvent): void {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      done
    )
      throw new Error('Fast Print session is no longer active.')
  }
  ipcMain.handle('fast-print:source', async (event) => {
    authorize(event)
    return {
      name: jobName,
      files: files.map((filePath) => ({
        name: basename(filePath),
        extension: extname(filePath).toLowerCase()
      })),
      preset,
      canReturnToSettings,
      ...(idDraft ? { idDraft } : {}),
      previewOnly: Boolean(jobOptions.previewDirectory),
      ...(reviewed ? { preparedPolaroid: { photos: reviewed.photos, sheets: sheets.length } } : {}),
      canDuplex: printer.duplex === true,
      canColor: printer.color
    }
  })
  ipcMain.handle('fast-print:file', async (event, index: number) => {
    authorize(event)
    if (!Number.isInteger(index) || index < 0 || index >= files.length || submitted)
      throw new Error('Invalid batch document.')
    const filePath = files[index]
    return {
      name: basename(filePath),
      extension: extname(filePath).toLowerCase(),
      bytes: new Uint8Array(await readFile(filePath)),
      preset
    }
  })
  ipcMain.handle(
    'fast-print:sheet',
    async (event, png: string, pageSize?: { widthMm: number; heightMm: number }) => {
      authorize(event)
      if (
        submitted ||
        acceptingSheet ||
        typeof png !== 'string' ||
        png.length > 64 * 1024 * 1024 ||
        !png.startsWith('data:image/png;base64,')
      )
        throw new Error('Invalid prepared sheet.')
      if (
        preset.mode === 'document' &&
        (!pageSize ||
          !Number.isFinite(pageSize.widthMm) ||
          !Number.isFinite(pageSize.heightMm) ||
          pageSize.widthMm <= 0 ||
          pageSize.heightMm <= 0 ||
          pageSize.widthMm > 10000 ||
          pageSize.heightMm > 10000)
      )
        throw new Error('Invalid document page size.')
      acceptingSheet = true
      try {
        const output = join(temp, `${String(sheets.length + 1).padStart(5, '0')}.png`)
        const bytes = Buffer.from(png.slice('data:image/png;base64,'.length), 'base64')
        preparedBytes += bytes.length
        if (preparedBytes > 2 * 1024 * 1024 * 1024)
          throw new Error(
            'The prepared batch exceeds 2 GB. Split this selection into smaller batches.'
          )
        currentSheetWrite = writeFile(output, bytes)
        await currentSheetWrite
        sheets.push(output)
        if (pageSize) sheetSizes.push(pageSize)
      } finally {
        acceptingSheet = false
      }
    }
  )
  ipcMain.handle('fast-print:submit', async (event, options?: FastPrintSubmitOptions) => {
    // A preview only writes composed sheets. Authorization still gates every print submission.
    if (!jobOptions.previewDirectory)
      await assertOnlineProductionAccess('paid-tools', jobOptions.toolId)
    authorize(event)
    if (submitted || acceptingSheet || !sheets.length)
      throw new Error('No complete print job is ready.')
    if (preset.mode === 'id-card') {
      if (
        sheets.length !== 2 ||
        !options ||
        typeof options.color !== 'boolean' ||
        typeof options.duplex !== 'boolean'
      )
        throw new Error('Prepare both ID sides before printing.')
      if (options.color && !printer.color) throw new Error('This printer does not support color.')
      if (options.duplex && !printer.duplex)
        throw new Error('This printer does not support automatic duplex.')
      if (
        options.idsPerSheet !== undefined &&
        (!Number.isInteger(options.idsPerSheet) ||
          options.idsPerSheet < 1 ||
          options.idsPerSheet > MAX_IDS_PER_SHEET)
      )
        throw new Error('Choose between 1 and 24 IDs per sheet.')
      const prompt = options.manualDuplexPrompt
      if (
        prompt &&
        (typeof prompt.message !== 'string' ||
          prompt.message.length > 1500 ||
          typeof prompt.title !== 'string' ||
          prompt.title.length > 100 ||
          typeof prompt.rtl !== 'boolean')
      )
        throw new Error('Invalid manual duplex prompt.')
      preset = { ...preset, color: options.color, duplex: options.duplex }
    } else if (options !== undefined) throw new Error('Invalid Fast Print options.')
    submitted = true
    clearTimeout(watchdog)
    const manifest = join(temp, 'job.json')
    try {
      await writeFile(
        manifest,
        JSON.stringify({
          name: jobName,
          preset,
          sheets,
          sheetSizes,
          copies: jobOptions.copies,
          ...(preset.mode === 'id-card' ? { idsPerSheet: options?.idsPerSheet ?? 1 } : {}),
          manualDuplexPrompt: options?.manualDuplexPrompt
        })
      )
      // Preparing a preview has no path to the Windows print script or spooler.
      if (jobOptions.previewDirectory) {
        for (const sheet of sheets)
          await copyFile(sheet, join(jobOptions.previewDirectory, basename(sheet)))
        await writeFile(
          join(jobOptions.previewDirectory, 'sheets.json'),
          JSON.stringify({
            version: 1,
            mode: preset.mode,
            sheets: sheets.map((sheet) => basename(sheet))
          })
        )
        return { verified: true }
      }
      const verifyFolder = !app.isPackaged && process.env.FAST_PRINT_VERIFY_DIR
      const result = await powershell('fast-print-job.ps1', [
        '-Manifest',
        manifest,
        ...(jobOptions.profileDirectory ? ['-ProfileDirectory', jobOptions.profileDirectory] : []),
        ...(verifyFolder ? ['-ValidateOnly'] : [])
      ])
      if (verifyFolder) {
        await mkdir(verifyFolder, { recursive: true })
        for (const sheet of sheets) await copyFile(sheet, join(verifyFolder, basename(sheet)))
        await writeFile(
          join(verifyFolder, 'job.json'),
          JSON.stringify({
            name: jobName,
            preset,
            sheets: sheets.map((sheet) => join(verifyFolder, basename(sheet))),
            sheetSizes,
            copies: jobOptions.copies,
            ...(preset.mode === 'id-card' ? { idsPerSheet: options?.idsPerSheet ?? 1 } : {})
          })
        )
        await writeFile(join(verifyFolder, 'driver-settings.json'), result)
      }
      console.log('[fast-print]', result)
      return {
        verified: Boolean(verifyFolder),
        manualBackCanceled: result === 'Front submitted; back canceled.'
      }
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  })
  ipcMain.handle('fast-print:finish', (event, error?: string) => {
    authorize(event)
    done = true
    if (error) fail(new Error(error))
    else finish()
  })
  ipcMain.handle('fast-print:back', async (event, draft: unknown) => {
    authorize(event)
    if (
      !canReturnToSettings ||
      !jobOptions.profileDirectory ||
      submitted ||
      acceptingSheet ||
      sheets.length ||
      returningToSettings
    )
      throw new Error('Cannot change printer settings during print submission.')
    returningToSettings = true
    try {
      await saveIdDraft(jobOptions.profileDirectory, files, draft)
      authorize(event)
      await writeFile(join(jobOptions.profileDirectory, 'id-returned.json'), '{"version":1}')
      returnedToSettings = true
      done = true
      finish()
    } finally {
      returningToSettings = false
    }
  })
  ipcMain.handle('fast-print:save-id', async (event, draft: unknown) => {
    authorize(event)
    if (
      !canReturnToSettings ||
      !jobOptions.profileDirectory ||
      submitted ||
      acceptingSheet ||
      sheets.length ||
      returningToSettings
    )
      throw new Error('Cannot save ID edits during print submission.')
    returningToSettings = true
    try {
      await saveIdDraft(jobOptions.profileDirectory, files, draft)
      authorize(event)
    } finally {
      returningToSettings = false
    }
  })
  window.on('close', (event) => {
    if ((submitted || returningToSettings) && !done) event.preventDefault()
    else if (!done) {
      done = true
      finish()
    }
  })
  window.webContents.on('render-process-gone', () =>
    fail(new Error('The print renderer stopped. Check the print queue before retrying.'))
  )
  const watchdog = setTimeout(
    () => fail(new Error('Fast Print preparation timed out.')),
    (preset.mode === 'id-card' ? 60 : 10) * 60_000
  )
  try {
    await window.loadFile(join(__dirname, '../renderer/fast-print.html'))
    if (!backgroundPreparation) window.show()
    await ready
    return { ok: submitted, ...(!submitted ? { canceled: true } : {}), returnedToSettings }
  } finally {
    clearTimeout(watchdog)
    done = true
    for (const channel of ['source', 'file', 'sheet', 'submit', 'finish', 'back', 'save-id'])
      ipcMain.removeHandler(`fast-print:${channel}`)
    if (!window.isDestroyed()) window.destroy()
    await currentSheetWrite.catch(() => undefined)
    await rm(temp, { recursive: true, force: true })
  }
}
