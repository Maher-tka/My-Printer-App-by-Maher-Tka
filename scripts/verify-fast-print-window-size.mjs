import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'

// Hidden native forms and synthetic monitor work areas; no desktop input or print jobs.
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-window-size', randomUUID())
const native =
  process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-window-size.exe')
const run = promisify(execFile)
await mkdir(output, { recursive: true })
const fixture = join(output, 'photo.png')
await sharp({ create: { width: 900, height: 600, channels: 3, background: '#4979a4' } })
  .png()
  .toFile(fixture)
const reports = []
for (const language of ['en', 'fr', 'ar']) {
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_DIRECTION: '1',
    FAST_PRINT_VERIFY_WINDOW_SIZE: '1',
    FAST_PRINT_TEST_SINGLE_CORE: '1',
    FAST_PRINT_NONINTERACTIVE: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings')
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await run(
    native,
    [
      '--verify-audit',
      folder,
      '--language',
      language,
      '--preset',
      Buffer.from(
        JSON.stringify({
          printer: 'Microsoft Print to PDF',
          paper: 'A4',
          color: true,
          pagesPerSheet: 4
        })
      ).toString('base64'),
      '--',
      fixture
    ],
    { cwd: root, env, windowsHide: true, timeout: 120000 }
  )
  assert.equal(await readFile(join(folder, 'error.txt'), 'utf8').catch(() => ''), '')
  const report = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(report.headless, true)
  assert.equal(report.placementApplied, true)
  assert.ok(report.desktop.Height > report.compact.Height + 100)
  assert.ok(report.desktop.Height < report.desktopWork.Height)
  assert.ok(report.desktopPreview > report.compactPreview + 100)
  assert.ok(report.secondary.X < 0)
  assert.equal(report.captures.length, 4)
  for (const capture of report.captures) {
    const image = await sharp(
      join(folder, `${capture.dark ? 'dark' : 'light'}-${capture.name}.png`)
    ).metadata()
    assert.equal(image.width, capture.width)
    assert.equal(image.height, capture.height)
  }
  const cleanup = resolve(report.cleanupDirectory)
  assert.equal(
    dirname(cleanup).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(cleanup, /[\\/][a-f0-9]{32}$/)
  await rm(cleanup, { recursive: true, force: true })
  reports.push({ language, folder, ...report, cleanupDirectory: undefined })
  console.log(`${language}: bounded, centered initial window and larger preview passed`)
}
await writeFile(
  join(root, 'output/fast-print-window-size/results.json'),
  JSON.stringify({ headless: true, hardwareJobs: 0, singleCore: true, reports }, null, 2)
)
