import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { compareDriverPresets } from '../src/shared/printer-preferences.ts'

// Only hidden fixture windows and disposable settings. No driver or spooler calls.
const root = resolve(import.meta.dirname, '..'),
  output = join(root, 'output/fast-print-preset-order')
const native =
  process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-preset-order.exe')
const run = promisify(execFile),
  reports = []
await mkdir(output, { recursive: true })
const fixture = join(output, 'fixture.png')
await sharp({ create: { width: 32, height: 24, channels: 3, background: 'white' } })
  .png()
  .toFile(fixture)
for (const language of ['en', 'fr', 'ar']) {
  const folder = join(output, language),
    settings = join(folder, 'settings')
  await mkdir(folder, { recursive: true })
  await rm(join(folder, 'error.txt'), { force: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_ORDER: '1',
    FAST_PRINT_TEST_SETTINGS: settings,
    FAST_PRINT_TEST_SINGLE_CORE: '1'
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await run(native, ['--verify-audit', folder, '--language', language, '--', fixture], {
    cwd: root,
    env,
    windowsHide: true,
    timeout: 60000
  })
  const error = await readFile(join(folder, 'error.txt'), 'utf8').catch(() => '')
  assert.equal(error, '')
  const report = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(report.headless, true)
  assert.equal(report.settingsUnchanged, true)
  assert.equal(report.selectionPreserved, true)
  assert.equal(report.restartPreserved, true)
  assert.equal(report.cancelPreserved, true)
  const quote = (value) => "'" + value.replaceAll("'", "''") + "'"
  const command = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); . ${quote(join(root, 'scripts/fast-print-profiles.ps1'))}; @(Get-FastPrintProfiles -Directory ${quote(join(settings, 'profiles'))}) | Select-Object id,name,printer,sortOrder | ConvertTo-Json -Depth 4 -Compress`
  const listed = JSON.parse(
    (
      await run('powershell.exe', ['-NoProfile', '-Command', command], {
        cwd: root,
        windowsHide: true
      })
    ).stdout
  )
  assert.deepEqual(
    listed.filter((profile) => profile.printer === report.printer).map((profile) => profile.id),
    report.ids,
    'PowerShell menu/settings list differs from the native order'
  )
  assert.deepEqual(
    [...listed]
      .filter((profile) => profile.printer === report.printer)
      .reverse()
      .sort(compareDriverPresets)
      .map((profile) => profile.id),
    report.ids,
    'App and ID list sorting differs from the native order'
  )
  await writeFile(join(folder, 'listed.json'), JSON.stringify(listed, null, 2))
  const session = resolve(report.cleanupDirectory)
  assert.equal(
    dirname(session).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(session, /[\\/][a-f0-9]{32}$/)
  await rm(session, { recursive: true, force: true })
  reports.push({
    language,
    captures: report.captures,
    settingsUnchanged: true,
    restartPreserved: true,
    cancelPreserved: true,
    selectionPreserved: true,
    sharedOrder: true
  })
  console.log(
    language +
      ': move/save/cancel, independent printers, restart, rename/new preset ordering, unchanged driver data and shared menu/Settings/ID order passed'
  )
}
await writeFile(
  join(output, 'results.json'),
  JSON.stringify({ headless: true, hardwareJobs: 0, singleCore: true, reports }, null, 2)
)
