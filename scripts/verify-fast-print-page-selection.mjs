import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { PDFDocument, rgb } from 'pdf-lib'
import { fastPrintCell, fastPrintLayout } from '../src/shared/fast-print.ts'

// Hidden native windows and verification-only worker output. Never submits a spooler job.
const root = resolve(import.meta.dirname, '..')
const nativeOnly = process.argv.includes('--native-only')
const output = join(
  root,
  'output/fast-print-page-selection',
  ...(nativeOnly ? ['native-recheck'] : [])
)
const native =
  process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-page-selection.exe')
const electron = createRequire(import.meta.url)('electron')
const run = promisify(execFile)
const colors = [
  [0.8, 0.2, 0.2],
  [0.2, 0.7, 0.2],
  [0.2, 0.3, 0.8],
  [0.7, 0.3, 0.6],
  [0.2, 0.7, 0.7]
]
await mkdir(output, { recursive: true })
const files = []
for (const [index, count] of [5, 3].entries()) {
  const doc = await PDFDocument.create()
  for (let page = 0; page < count; page++) {
    const sheet = doc.addPage(page % 2 ? [842, 595] : [595, 842])
    sheet.drawRectangle({
      x: 0,
      y: 0,
      width: sheet.getWidth(),
      height: sheet.getHeight(),
      color: rgb(...colors[page])
    })
    sheet.drawText(`FILE ${index + 1} PAGE ${page + 1}`, { x: 40, y: 60, size: 24 })
  }
  const file = join(output, `document-${index}.pdf`)
  await writeFile(file, await doc.save())
  files.push(file)
}
files.push(join(output, 'photo.png'))
await sharp({ create: { width: 600, height: 400, channels: 3, background: '#ccaa44' } })
  .png()
  .toFile(files[2])
const manifest = join(output, 'selection.json')
await writeFile(manifest, JSON.stringify({ version: 1, files }))
const summaries = []
async function cleanup(request) {
  const path = resolve(request)
  assert.equal(
    dirname(path).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(path, /[\\/][a-f0-9]{32}$/)
  await rm(path, { recursive: true, force: true })
}
for (const language of ['en', 'fr', 'ar']) {
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  await rm(join(folder, 'error.txt'), { force: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_SELECTION: '1',
    FAST_PRINT_NONINTERACTIVE: '1',
    FAST_PRINT_TEST_SINGLE_CORE: '1',
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
          pagesPerSheet: 1
        })
      ).toString('base64'),
      '--batch',
      manifest
    ],
    { cwd: root, windowsHide: true, env, timeout: 180000 }
  )
  const failure = await readFile(join(folder, 'error.txt'), 'utf8').catch(() => '')
  assert.equal(failure, '')
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(result.headless, true)
  for (const report of result.reports) {
    const plan = JSON.parse(await readFile(report.request, 'utf8'))
    assert.deepEqual(plan.preset.sourcePages, [[0, 1, 4], [1], []])
    const groups = report.merge ? [4] : [3, 1]
    const sides = groups.map((count) => Math.ceil(count / report.per))
    const simplex = sides.reduce((sum, count) => sum + count, 0)
    const duplex = simplex + sides.slice(0, -1).filter((count) => count % 2).length
    assert.equal(report.simplex.Pages, simplex)
    assert.equal(report.simplex.TotalSheets, simplex * 2)
    assert.equal(report.duplex.Pages, duplex)
    if (language === 'en' && !nativeOnly) {
      const worker = join(folder, report.name, 'worker')
      await run(electron, [root, '--fast-print-request', report.request], {
        cwd: root,
        windowsHide: true,
        timeout: 120000,
        env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: worker }
      })
      const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
      assert.equal(job.sheets.length, simplex)
      const expected = [colors[0], colors[1], colors[4], colors[1]]
      let offset = 0,
        sheet = 0
      for (const count of groups) {
        for (let first = 0; first < count; first += report.per) {
          const occupied = Math.min(report.per, count - first)
          const layout = fastPrintLayout(plan.preset)
          // One-up preserves each PDF page's own orientation.
          if (report.per > 1)
            for (let slot = 0; slot < occupied; slot++) {
              const cell = fastPrintCell(layout, slot, occupied)
              const actual = [
                ...(await sharp(job.sheets[sheet])
                  .extract({
                    left: Math.floor(cell.x + cell.width / 2),
                    top: Math.floor(cell.y + cell.height / 2),
                    width: 1,
                    height: 1
                  })
                  .removeAlpha()
                  .raw()
                  .toBuffer())
              ]
              assert.ok(
                actual.every(
                  (channel, i) =>
                    Math.abs(channel - Math.round(expected[offset + first + slot][i] * 255)) < 5
                ),
                `${report.name}: wrong page in sheet ${sheet} slot ${slot}`
              )
            }
          const actual = await sharp(job.sheets[sheet])
            .resize(180, 180, { fit: 'fill' })
            .removeAlpha()
            .raw()
            .toBuffer()
          const preview = await sharp(report.sheets[sheet])
            .resize(180, 180, { fit: 'fill' })
            .removeAlpha()
            .raw()
            .toBuffer()
          const difference =
            actual.reduce((sum, value, i) => sum + Math.abs(value - preview[i]), 0) / actual.length
          assert.ok(difference < 10, `${report.name}: preview/output differ by ${difference}`)
          sheet++
        }
        offset += count
      }
    } else await cleanup(dirname(report.request))
  }
  await cleanup(result.cleanupDirectory)
  summaries.push({ language, cases: result.reports.length, headless: true })
  console.log(
    `${language}: ranges, odd/even, invalid input, empty files, counts, themes and layouts passed`
  )
}
await writeFile(
  join(output, 'results.json'),
  JSON.stringify({ hardwareJobs: 0, singleCore: true, summaries }, null, 2)
)
