import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { PDFDocument, rgb } from 'pdf-lib'

// Hidden UI, isolated fixtures, and verification-only renderer; no print jobs.
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-image-copies', randomUUID())
const run = promisify(execFile)
const electron = createRequire(import.meta.url)('electron')
const native =
  process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-image-copies.exe')
await mkdir(output, { recursive: true })
const files = []
for (const [index, color] of ['#da3434', '#42a456', '#376ad2'].entries()) {
  const file = join(output, `image-${index + 1}.png`)
  await sharp(
    Buffer.from(
      `<svg width="900" height="600"><rect width="900" height="600" fill="${color}"/><rect width="900" height="65" fill="#ffdf00"/><text x="80" y="190" font-size="100">IMAGE ${index + 1}</text></svg>`
    )
  )
    .png()
    .toFile(file)
  files.push(file)
}
const pdf = await PDFDocument.create()
for (const color of [rgb(0.7, 0.3, 0.8), rgb(0.3, 0.7, 0.8)]) {
  const page = pdf.addPage([595, 842])
  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color })
  page.drawText('PDF PAGE', { x: 50, y: 750, size: 36 })
}
const pdfPath = join(output, 'two-pages.pdf')
await writeFile(pdfPath, await pdf.save())
files.push(pdfPath)
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

const results = []
for (const language of ['en', 'fr', 'ar']) {
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_DIRECTION: '1',
    FAST_PRINT_VERIFY_IMAGE_COPIES: '1',
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
    { cwd: root, env, windowsHide: true, timeout: 240000 }
  )
  assert.equal(await readFile(join(folder, 'error.txt'), 'utf8').catch(() => ''), '')
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  for (const key of [
    'headless',
    'isolatedSelection',
    'keyboardAccessible',
    'resetChecked',
    'limitChecked'
  ])
    assert.equal(result[key], true, key)
  assert.equal(result.reports.length, 3)
  for (const capture of result.captures) {
    const name = `${capture.dark ? 'dark' : 'light'}-${capture.width}x${capture.height}.png`
    const metadata = await sharp(join(folder, name)).metadata()
    assert.equal(metadata.width, capture.width)
    assert.equal(metadata.height, capture.height)
  }
  for (const report of result.reports) {
    const request = JSON.parse(await readFile(report.request, 'utf8'))
    assert.deepEqual(request.preset.sourceCopies, [1, report.copies, 1, 1])
    assert.equal(request.copies, 2)
    assert.equal(report.totals.Copies, 2)
    assert.equal(report.totals.TotalSheets, report.totals.Sheets * 2)
    if (language === 'en') {
      const worker = join(folder, report.name, 'worker')
      await run(electron, [root, '--fast-print-request', report.request], {
        cwd: root,
        windowsHide: true,
        timeout: 180000,
        env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: worker }
      })
      const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
      assert.equal(job.sheets.length, report.sheets.length)
      assert.deepEqual(job.preset.sourceCopies, [1, report.copies, 1, 1])
      assert.equal(job.copies, 2)
      for (let sheet = 0; sheet < job.sheets.length; sheet++) {
        const actual = await sharp(job.sheets[sheet])
          .resize(300, 300, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer()
        const expected = await sharp(report.sheets[sheet])
          .resize(300, 300, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer()
        const difference =
          actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) /
          actual.length
        assert.ok(
          difference < 12,
          `Preview/output mismatch ${report.name} sheet ${sheet + 1}: ${difference}`
        )
      }
    } else await removeOwned(dirname(report.request))
  }
  await removeOwned(result.cleanupDirectory)
  results.push({ language, folder, reports: result.reports.length })
  console.log(
    `${language}: selected-image duplication, dedicated sheets, mixed files, output, layouts and limits passed`
  )
}
await writeFile(
  join(root, 'output/fast-print-image-copies/results.json'),
  JSON.stringify({ hardwareJobs: 0, headless: true, results }, null, 2)
)
