import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { PDFDocument, rgb } from 'pdf-lib'
import { fastPrintPageTurns } from '../src/shared/fast-print.ts'

// Hidden native UI and verification-only production renderer. No hardware jobs.
const root = resolve(import.meta.dirname, '..')
const nativeOnly = process.argv.includes('--native-only')
const output = join(root, 'output/fast-print-page-rotation', randomUUID())
const run = promisify(execFile)
const native =
  process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-page-rotation.exe')
const electron = createRequire(import.meta.url)('electron')
await mkdir(output, { recursive: true })
const files = []
for (let file = 0; file < 2; file++) {
  const doc = await PDFDocument.create()
  for (let page = 0; page < 2; page++) {
    const sheet = doc.addPage([595, 842])
    sheet.drawRectangle({
      x: 0,
      y: 0,
      width: 595,
      height: 842,
      color: rgb(file ? 0.25 : 0.8, page ? 0.7 : 0.25, 0.3)
    })
    sheet.drawRectangle({ x: 0, y: 802, width: 595, height: 40, color: rgb(1, 0, 0) })
    sheet.drawText(`FILE ${file + 1} PAGE ${page + 1} TOP`, { x: 30, y: 750, size: 26 })
  }
  const path = join(output, `document-${file}.pdf`)
  await writeFile(path, await doc.save())
  files.push(path)
}
const photo = join(output, 'photo.png')
await sharp(
  Buffer.from(
    '<svg width="800" height="500"><rect width="800" height="500" fill="#4488cc"/><rect width="800" height="40" fill="red"/><text x="40" y="100" font-size="40">PHOTO TOP</text></svg>'
  )
)
  .png()
  .toFile(photo)
files.splice(1, 0, photo)
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
    FAST_PRINT_VERIFY_PAGE_ROTATION: '1',
    FAST_PRINT_NONINTERACTIVE: '1',
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
      '--batch',
      selection
    ],
    { cwd: root, env, windowsHide: true, timeout: 120000 }
  )
  assert.equal(await readFile(join(folder, 'error.txt'), 'utf8').catch(() => ''), '')
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  for (const key of [
    'headless',
    'pageRotationIsolated',
    'selectionRetained',
    'filtersUseOriginalPages',
    'globalRotationResetsOverrides'
  ])
    assert.equal(result[key], true, key)
  for (const report of result.reports) {
    const request = JSON.parse(await readFile(report.request, 'utf8'))
    assert.equal(fastPrintPageTurns(request.preset, 0, 1), 1)
    assert.equal(fastPrintPageTurns(request.preset, 0, 0), report.per === 1 ? 0 : 2)
    assert.equal(fastPrintPageTurns(request.preset, 1, 0), 0)
    assert.equal(fastPrintPageTurns(request.preset, 2, 0), 0)
    assert.equal(fastPrintPageTurns(request.preset, 2, 1), 0)
    if (language === 'en' && !nativeOnly) {
      const worker = join(folder, report.name, 'worker')
      await run(electron, [root, '--fast-print-request', report.request], {
        cwd: root,
        env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: worker },
        windowsHide: true,
        timeout: 120000
      })
      const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
      assert.equal(job.sheets.length, report.sheets.length)
      for (let page = 0; page < job.sheets.length; page++) {
        const actual = await sharp(job.sheets[page])
          .resize(300, 300, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer()
        const expected = await sharp(report.sheets[page])
          .resize(300, 300, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer()
        const difference =
          actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) /
          actual.length
        assert.ok(
          difference < 12,
          `Page orientation differs between preview/output: ${report.name} sheet ${page} (${difference})`
        )
      }
      console.log(report.name + ': page-specific preview and print proofs match')
    } else await removeOwned(dirname(report.request))
  }
  for (const theme of ['light', 'dark'])
    for (const [width, height] of [
      [1366, 768],
      [1920, 1080]
    ]) {
      const metadata = await sharp(join(folder, `${theme}-${width}x${height}.png`)).metadata()
      assert.equal(metadata.width, width)
      assert.equal(metadata.height, height)
    }
  await removeOwned(result.cleanupDirectory)
  reports.push({ language, folder, cases: result.reports.length })
  console.log(
    language + ': independent page rotation, selection, filtering and global reset passed'
  )
}
await writeFile(
  join(root, `output/fast-print-page-rotation/${nativeOnly ? 'native-results' : 'results'}.json`),
  JSON.stringify({ hardwareJobs: 0, headless: true, reports }, null, 2)
)
