import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-preview-performance', randomUUID())
const run = promisify(execFile)
await mkdir(output, { recursive: true })
const files = []
for (let index = 0; index < 6; index++) {
  const width = index % 2 ? 4000 : 6000,
    height = index % 2 ? 6000 : 4000
  const file = join(output, `large-${index}.jpg`)
  await sharp(
    Buffer.from(
      `<svg width="${width}" height="${height}"><defs><pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="hsl(${index * 50},60%,50%)"/><circle cx="40" cy="40" r="25" fill="white"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`
    )
  )
    .jpeg({ quality: 92 })
    .withMetadata({ orientation: index === 4 ? 6 : 1 })
    .toFile(file)
  files.push(file)
}
const selection = join(output, 'selection.json')
await writeFile(selection, JSON.stringify({ version: 1, files }))
const reports = {}
for (const [name, filename] of [
  ['before', 'FastPrint-ui-baseline.exe'],
  ['after', 'FastPrint-ui-performance.exe']
]) {
  const folder = join(output, name)
  await mkdir(folder, { recursive: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_PERFORMANCE: '1',
    FAST_PRINT_NONINTERACTIVE: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings'),
    FAST_PRINT_TEST_SINGLE_CORE: '1'
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await run(
    join(root, 'out/native', filename),
    [
      '--verify-audit',
      folder,
      '--language',
      'en',
      '--appearance',
      'dark',
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
  const report = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(report.headless, true)
  assert.equal(report.photoDecodeOffUi, true)
  assert.equal(report.states.length, 16)
  assert.ok(
    report.states.every((state) => state.compositions === 0),
    'Unchanged previews were recomposed'
  )
  reports[name] = {
    folder,
    ...report,
    warmMs: report.states.reduce((sum, state) => sum + state.warmMs, 0)
  }
  console.log(
    name +
      ': ' +
      JSON.stringify({
        coldMs: report.coldMs,
        warmMs: reports[name].warmMs,
        maxUiPauseMs: report.maxUiPauseMs,
        workingMiB: report.workingMiB,
        selectionMs: report.selectionMs
      })
  )
}
assert.equal(reports.after.selectionCompositions, 0)
assert.equal(reports.after.selectionReady, true)
assert.ok(reports.after.selectionReuses >= 200)
assert.ok(
  reports.after.warmMs < reports.before.warmMs / 3,
  'Cached refresh did not improve sufficiently'
)
await writeFile(
  join(root, 'output/fast-print-preview-performance/results.json'),
  JSON.stringify({ hardwareJobs: 0, headless: true, singleCore: true, reports }, null, 2)
)
