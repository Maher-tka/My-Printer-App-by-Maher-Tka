import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  screen,
  type MenuItemConstructorOptions
} from 'electron'
import {
  createFastPrintChoices,
  type FastPrintChoice,
  type FastPrintDevice,
  type FastPrintSavedStock
} from '../shared/fast-print-menu.js'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile, copyFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { assertOnlineProductionAccess } from './online-account.js'
import { validateFastPrintPreset, type FastPrintPreset } from '../shared/fast-print.js'
import {
  normalizeFastPrintSelection,
  parseFastPrintSelectionManifest
} from '../shared/fast-print-batch.js'

const execFileAsync = promisify(execFile)
const switches = [
  '--fast-print',
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

function scriptPath(name: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'fast-print', name)
    : join(app.getAppPath(), 'scripts', name)
}

async function powershell(name: string, parameters: string[]): Promise<string> {
  const executable = join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  )
  const result = await execFileAsync(
    executable,
    [
      '-NoProfile',
      '-STA',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath(name),
      ...parameters
    ],
    {
      windowsHide: true,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024
    }
  )
  return result.stdout.trim()
}

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
            : 'Right-click a PDF, PNG, or JPEG file → Show more options → Fast Print. Hover over your printer, paper size, and color mode, then click a layout to print.'
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
      await runJob(normalizeFastPrintSelection(paths.map((path) => resolve(path))), preset)
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

async function showFastPrintMenu(filePaths: string[]): Promise<void> {
  const files = normalizeFastPrintSelection(filePaths)
  await validateSelection(files)
  const selectionName =
    files.length === 1 ? basename(files[0]) : `${files.length} documents selected`
  for (;;) {
    const devices = JSON.parse(
      await powershell('fast-print-menu.ps1', ['-Action', 'List'])
    ) as FastPrintDevice[]
    const profiles = JSON.parse(
      await powershell('fast-print-settings.ps1', ['-Action', 'List'])
    ) as FastPrintSavedStock[]
    const choices = createFastPrintChoices(devices, profiles)
    if (!app.isPackaged && process.env.FAST_PRINT_MENU_VERIFY) {
      await writeFile(process.env.FAST_PRINT_MENU_VERIFY, JSON.stringify(choices, null, 2))
      return
    }
    const position = screen.getCursorScreenPoint()
    const workArea = screen.getDisplayNearestPoint(position).workArea
    const owner = new BrowserWindow({
      title: 'Fast Print',
      x: workArea.x,
      y: workArea.y,
      width: workArea.width,
      height: workArea.height,
      frame: false,
      transparent: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    })
    const choice = await new Promise<FastPrintChoice | null>((resolveChoice) => {
      const convert = (item: FastPrintChoice): MenuItemConstructorOptions => ({
        label: item.label,
        enabled: item.enabled,
        ...(item.children
          ? { submenu: item.children.map(convert) }
          : { click: () => resolveChoice(item) })
      })
      const menu = Menu.buildFromTemplate([
        { label: selectionName.replaceAll('&', '&&'), enabled: false },
        { type: 'separator' },
        ...choices.map(convert)
      ])
      owner.once('closed', () => resolveChoice(null))
      owner.show()
      owner.focus()
      menu.popup({
        window: owner,
        callback: () => resolveChoice(null)
      })
    }).finally(() => {
      if (!owner.isDestroyed()) owner.destroy()
    })
    if (!choice || choice.action === 'cancel') return
    if (choice.action === 'manage') {
      await powershell('fast-print-settings.ps1', ['-Action', 'Manage'])
      continue
    }
    if (choice.action === 'refresh') continue
    if (choice.preset) await runJob(files, choice.preset)
    return
  }
}

async function runJob(filePaths: string[], preset: FastPrintPreset): Promise<void> {
  const files = normalizeFastPrintSelection(filePaths)
  await validateSelection(files)
  const jobName = files.length === 1 ? basename(files[0]) : `Fast Print - ${files.length} documents`
  const printers = JSON.parse(
    await powershell('fast-print-menu.ps1', ['-Action', 'List'])
  ) as Array<{ name: string; papers: string[]; color: boolean }>
  if (preset.profileId) {
    const profile = JSON.parse(
      await powershell('fast-print-settings.ps1', [
        '-Action',
        'Resolve',
        '-ProfileId',
        preset.profileId
      ])
    ) as { printer: string; paper: string; name: string; landscape: boolean; duplex: string }
    if (profile.printer !== preset.printer || profile.paper !== preset.paper) {
      throw new Error('This preset has changed. Refresh the printer list and choose it again.')
    }
    preset = {
      ...preset,
      landscape: profile.landscape,
      profileName: profile.name,
      duplex: ['Vertical', 'Horizontal'].includes(profile.duplex)
    }
  }
  const printer = printers.find((item) => item.name === preset.printer)
  if (!printer)
    throw new Error(
      'The selected printer is no longer installed. Use Refresh printer list in Fast Print.'
    )
  if (!printer.papers.includes(preset.paper))
    throw new Error(`This printer does not support ${preset.paper}.`)
  if (preset.color && !printer.color) throw new Error('This printer does not support color.')
  const temp = await mkdtemp(join(app.getPath('temp'), 'maher-fast-print-'))
  const sheets: string[] = []
  const window = new BrowserWindow({
    width: 490,
    height: 310,
    resizable: false,
    autoHideMenuBar: true,
    title: 'Fast Print',
    backgroundColor: '#f5f7fb',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/fast-print.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'fast-print-' + basename(temp)
    }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  let submitted = false
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
      preset
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
  ipcMain.handle('fast-print:sheet', async (event, png: string) => {
    authorize(event)
    if (
      submitted ||
      acceptingSheet ||
      typeof png !== 'string' ||
      png.length > 64 * 1024 * 1024 ||
      !png.startsWith('data:image/png;base64,')
    )
      throw new Error('Invalid prepared sheet.')
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
    } finally {
      acceptingSheet = false
    }
  })
  ipcMain.handle('fast-print:submit', async (event) => {
    await assertOnlineProductionAccess('paid-tools', 'fast-print')
    authorize(event)
    if (submitted || acceptingSheet || !sheets.length)
      throw new Error('No complete print job is ready.')
    submitted = true
    clearTimeout(watchdog)
    const manifest = join(temp, 'job.json')
    try {
      await writeFile(manifest, JSON.stringify({ name: jobName, preset, sheets }))
      const verifyFolder = !app.isPackaged && process.env.FAST_PRINT_VERIFY_DIR
      const result = await powershell('fast-print-job.ps1', [
        '-Manifest',
        manifest,
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
            sheets: sheets.map((sheet) => join(verifyFolder, basename(sheet)))
          })
        )
        await writeFile(join(verifyFolder, 'driver-settings.json'), result)
      }
      console.log('[fast-print]', result)
      return { verified: Boolean(verifyFolder) }
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
  window.on('close', (event) => {
    if (submitted && !done) event.preventDefault()
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
    10 * 60_000
  )
  try {
    await window.loadFile(join(__dirname, '../renderer/fast-print.html'))
    window.show()
    await ready
  } finally {
    clearTimeout(watchdog)
    done = true
    for (const channel of ['source', 'file', 'sheet', 'submit', 'finish'])
      ipcMain.removeHandler(`fast-print:${channel}`)
    if (!window.isDestroyed()) window.destroy()
    await currentSheetWrite.catch(() => undefined)
    await rm(temp, { recursive: true, force: true })
  }
}
