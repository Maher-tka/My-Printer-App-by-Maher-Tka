import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-sheet-images', randomUUID())
const run = promisify(execFile)
const electron = createRequire(import.meta.url)('electron')
const native =
  process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-sheet-selection.exe')
await mkdir(output, { recursive: true })
const files = []
for (const [i, [width, height]] of [
  [900, 500],
  [500, 900],
  [720, 480],
  [480, 720],
  [900, 600],
  [600, 900]
].entries()) {
  const file = join(output, `photo-${i}.png`)
  await sharp(
    Buffer.from(
      `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="hsl(${i * 50},60%,55%)"/><rect width="${width}" height="40" fill="red"/><text x="40" y="130" font-size="70">${i + 1} TOP</text></svg>`
    )
  )
    .png()
    .toFile(file)
  files.push(file)
}
const selection = join(output, 'selection.json')
await writeFile(selection, JSON.stringify({ version: 1, files }))
async function removeOwned(path) {
  const absolute = resolve(path)
  assert.equal(
    dirname(absolute).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(absolute, /[\\/][a-f0-9]{32}$/)
  await rm(absolute, { recursive: true, force: true })
}
const reports = []
for (const language of ['en', 'fr', 'ar']) {
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_DIRECTION: '1',
    FAST_PRINT_VERIFY_SHEET_IMAGES: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings'),
    FAST_PRINT_TEST_SINGLE_CORE: '1',
    FAST_PRINT_NONINTERACTIVE: '1'
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
      '--batch',
      selection
    ],
    { cwd: root, env, windowsHide: true, timeout: 180000 }
  )
  assert.equal(await readFile(join(folder, 'error.txt'), 'utf8').catch(() => ''), '')
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  for (const key of [
    'headless',
    'mouseSelection',
    'keyboardSelection',
    'rotationIsolated',
    'finalSheetSelection',
    'filteredSelection',
    'blankSlotsIgnored'
  ])
    assert.equal(result[key], true, key)
  assert.equal(result.reports.length, 16)
  for (const capture of result.captures) {
    const name = `${capture.dark ? 'dark' : 'light'}-${capture.width}x${capture.height}.png`
    const metadata = await sharp(join(folder, name)).metadata()
    assert.equal(metadata.width, capture.width)
    assert.equal(metadata.height, capture.height)
  }
  for (const report of result.reports) {
    assert.deepEqual(report.rotations, [0, 1, 1, 0, 0, 0])
    const request = JSON.parse(await readFile(report.request, 'utf8'))
    assert.deepEqual(request.preset.sourceRotations, report.rotations)
    if (language === 'en') {
      const worker = join(folder, report.name, 'worker')
      await run(electron, [root, '--fast-print-request', report.request], {
        cwd: root,
        windowsHide: true,
        timeout: 120000,
        env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: worker }
      })
      const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
      assert.equal(job.sheets.length, Math.ceil(files.length / report.per))
      for (let sheet = 0; sheet < job.sheets.length; sheet++) {
        const actual = await sharp(job.sheets[sheet])
          .resize(300, 300, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer()
        const expected = await sharp(join(folder, report.name, `sheet-${sheet}.png`))
          .resize(300, 300, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer()
        const difference =
          actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) /
          actual.length
        assert.ok(difference < 12, `Preview/output mismatch ${report.name}: ${difference}`)
      }
    } else await removeOwned(dirname(report.request))
  }
  await removeOwned(result.cleanupDirectory)
  reports.push({ language, folder, cases: result.reports.length })
  console.log(
    `${language}: mouse/keyboard selection, isolated rotations, final/filtered sheets, output and layouts passed`
  )
}
await writeFile(
  join(root, 'output/fast-print-sheet-images/results.json'),
  JSON.stringify({ hardwareJobs: 0, headless: true, reports }, null, 2)
)
