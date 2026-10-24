import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'

// Hidden native fixtures exercise selection only. Never calls Submit or sends print jobs.
const root = resolve(import.meta.dirname, '..'),
  output = join(root, 'output/fast-print-preset-picker')
const runDirectory = join(output, randomUUID()),
  run = promisify(execFile),
  reports = []
const native =
  process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-preset-list.exe')
await mkdir(runDirectory, { recursive: true })
const fixture = join(runDirectory, 'photo.png')
await sharp({ create: { width: 480, height: 640, channels: 3, background: '#427db5' } })
  .png()
  .toFile(fixture)
for (const language of ['en', 'fr', 'ar']) {
  const folder = join(runDirectory, language)
  await mkdir(folder, { recursive: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_PICKER: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings'),
    FAST_PRINT_TEST_SINGLE_CORE: '1'
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
          pagesPerSheet: 1
        })
      ).toString('base64'),
      '--',
      fixture
    ],
    { cwd: root, env, windowsHide: true, timeout: 120000 }
  )
  const error = await readFile(join(folder, 'error.txt'), 'utf8').catch(() => '')
  assert.equal(error, '')
  const report = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  for (const key of [
    'headless',
    'crossPrinterSelection',
    'liveReload',
    'jobSettingsPreserved',
    'missingPrinterGuarded',
    'deletedPresetGuarded'
  ])
    assert.equal(report[key], true, key)
  assert.notEqual(report.initialPrinter, report.presetPrinter)
  for (const capture of report.captures) {
    assert.equal(capture.width, capture.requestedWidth)
    assert.equal(capture.height, capture.requestedHeight)
    const image = await sharp(
      join(
        folder,
        `${capture.dark ? 'dark' : 'light'}-${capture.requestedWidth}x${capture.requestedHeight}.png`
      )
    ).metadata()
    assert.equal(image.width, capture.requestedWidth)
    assert.equal(image.height, capture.requestedHeight)
  }
  assert.ok(report.choices.every((choice) => choice.label.includes(report.presetPrinter)))
  const session = resolve(report.cleanupDirectory)
  assert.equal(
    dirname(session).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(session, /[\\/][a-f0-9]{32}$/)
  await rm(session, { recursive: true, force: true })
  reports.push({ language, folder, ...report, cleanupDirectory: undefined })
  console.log(
    language +
      ': presets visible from Microsoft Print to PDF, correct queue/snapshot selection, preserved job settings, live refresh, missing/deleted preset guards passed'
  )
}
await writeFile(
  join(output, 'results.json'),
  JSON.stringify({ headless: true, hardwareJobs: 0, singleCore: true, reports }, null, 2)
)
