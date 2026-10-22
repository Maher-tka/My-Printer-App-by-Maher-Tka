import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { fastPrintLayout } from '../src/shared/fast-print.ts'

const root = resolve(import.meta.dirname, '..'),
  output = join(root, 'output/fast-print-direction')
const native = process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint.exe')
const electron = createRequire(import.meta.url)('electron')
const results = []
async function removeOwned(path) {
  const absolute = resolve(path)
  assert.equal(
    dirname(absolute).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(absolute, /maher-fast-print-native[\\/][a-f0-9]{32}$/)
  await rm(absolute, { recursive: true, force: true })
}
for (const [language, appearance] of [
  ['en', 'dark'],
  ['fr', 'light'],
  ['ar', 'dark']
]) {
  if (
    process.env.FAST_PRINT_DIRECTION_LANGUAGES &&
    !JSON.parse(process.env.FAST_PRINT_DIRECTION_LANGUAGES).includes(language)
  )
    continue
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  await rm(join(folder, 'error.txt'), { force: true })
  const files = []
  for (const [i, [width, height]] of [
    [900, 500],
    [500, 900],
    [720, 480],
    [480, 720],
    [900, 600],
    [600, 900]
  ].entries()) {
    const svg = `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="hsl(${i * 50},60%,55%)"/><rect x="0" y="0" width="${width}" height="40" fill="red"/><text x="40" y="130" font-size="70">${i + 1} TOP</text></svg>`
    const path = join(folder, 'photo-' + i + '.png')
    await sharp(Buffer.from(svg)).png().toFile(path)
    files.push(path)
  }
  const selection = join(folder, 'selection.json')
  await writeFile(selection, JSON.stringify({ version: 1, files }))
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_DIRECTION: '1',
    FAST_PRINT_NONINTERACTIVE: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings')
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await new Promise((fulfill, reject) => {
    const child = spawn(
      native,
      [
        '--verify-audit',
        folder,
        '--language',
        language,
        '--appearance',
        appearance,
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
      { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    let log = ''
    child.stdout.on('data', (chunk) => (log += chunk))
    child.stderr.on('data', (chunk) => (log += chunk))
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Direction verification timed out ' + log))
    }, 180000)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      code === 0 ? fulfill() : reject(new Error('Direction exit ' + code + ': ' + log))
    })
  })
  let failure
  try {
    failure = await readFile(join(folder, 'error.txt'), 'utf8')
  } catch {}
  assert.ok(!failure, failure)
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(result.headless, true)
  assert.equal(result.manualRotationEnabled, true)
  assert.equal(result.oneUpOriginalRestored, true)
  assert.equal(result.reports.length, 30)
  for (const report of result.reports) {
    const plan = JSON.parse(await readFile(report.request, 'utf8'))
    assert.equal(plan.preset.landscape, report.landscape)
    assert.equal(plan.preset.autoOrientation, false)
    assert.equal(plan.preset.matchLayoutOrientation, report.align)
    assert.equal(report.fill, true, 'Photo-only presets should fill equal slots by default')
    if (report.name === 'manual-selected') assert.deepEqual(report.rotations, [1, 0, 0, 0, 0, 0])
    else assert.ok(report.rotations.every((turn) => turn === 0))
    const layout = fastPrintLayout(plan.preset)
    assert.equal(layout.width > layout.height, report.landscape)
    if (language === 'en') {
      const worker = join(folder, report.name, 'worker')
      await promisify(execFile)(electron, [root, '--fast-print-request', report.request], {
        cwd: root,
        windowsHide: true,
        timeout: 120000,
        env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: worker }
      })
      const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
      const driver = JSON.parse(await readFile(join(worker, 'driver-settings.json'), 'utf8'))
      assert.equal(
        driver.landscape,
        report.landscape,
        'The driver must honor portrait even for two-/six-/eight-up'
      )
      assert.equal(job.sheets.length, Math.ceil(6 / report.per))
      for (let page = 0; page < job.sheets.length; page++) {
        const actual = await sharp(job.sheets[page])
          .resize(220, 220, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer()
        const expected = await sharp(join(folder, report.name, 'sheet-' + page + '.png'))
          .resize(220, 220, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer()
        const difference =
          actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) /
          actual.length
        assert.ok(
          difference < 12,
          'Native and output rotations/layout differ: ' + report.name + ' ' + difference
        )
      }
      console.log(
        report.name + ': uniform direction, sheet override and manual rotation output passed'
      )
    } else await removeOwned(dirname(report.request))
  }
  await removeOwned(result.cleanupDirectory)
  results.push({
    language,
    appearance,
    cases: 30,
    manualRotationEnabled: true,
    oneUpOriginalRestored: true
  })
  console.log(language + ': orientation controls and photo direction checks passed')
}
await writeFile(join(output, 'results.json'), JSON.stringify({ hardwareJobs: 0, results }, null, 2))
