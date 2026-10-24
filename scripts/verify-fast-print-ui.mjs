import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-ui', randomUUID())
const run = promisify(execFile)
const native =
  process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-ui-performance.exe')
await mkdir(output, { recursive: true })
const doc = await PDFDocument.create()
for (let page = 0; page < 2; page++) {
  const sheet = doc.addPage([595, 842])
  sheet.drawRectangle({
    x: 0,
    y: 0,
    width: 595,
    height: 842,
    color: rgb(0.2, page ? 0.7 : 0.35, 0.65)
  })
  sheet.drawText(`PAGE ${page + 1} TOP`, { x: 40, y: 760, size: 32 })
}
const pdf = join(output, 'Two pages — ملف — document.pdf')
await writeFile(pdf, await doc.save())
const photo = join(output, 'Landscape photo.jpg')
await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#b99147' } })
  .jpeg()
  .toFile(photo)
const selection = join(output, 'selection.json')
await writeFile(selection, JSON.stringify({ version: 1, files: [pdf, photo] }))
const reports = []
for (const language of ['en', 'fr', 'ar']) {
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_DIRECTION: '1',
    FAST_PRINT_VERIFY_UI: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings'),
    FAST_PRINT_NONINTERACTIVE: '1',
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
          pagesPerSheet: 4,
          combineFiles: true
        })
      ).toString('base64'),
      '--batch',
      selection
    ],
    { cwd: root, env, windowsHide: true, timeout: 120000 }
  )
  assert.equal(await readFile(join(folder, 'error.txt'), 'utf8').catch(() => ''), '')
  const report = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(report.headless, true)
  assert.equal(report.pdfCacheBounded, true)
  assert.ok(report.selectionReuses >= 8)
  assert.equal(report.captures.length, 8)
  for (const capture of report.captures) {
    const metadata = await sharp(
      join(folder, `${capture.dark ? 'dark' : 'light'}-${capture.width}x${capture.height}.png`)
    ).metadata()
    assert.equal(metadata.width, capture.width)
    assert.equal(metadata.height, capture.height)
  }
  reports.push({ language, folder, ...report })
  console.log(
    language +
      ': grouped controls, wrapped toolbar, range editor, instant selection and bounded PDF cache passed'
  )
}
await writeFile(
  join(root, 'output/fast-print-ui/results.json'),
  JSON.stringify({ headless: true, hardwareJobs: 0, singleCore: true, reports }, null, 2)
)
