import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-last-settings', randomUUID())
const native =
  process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-last-settings.exe')
const run = promisify(execFile)
await mkdir(output, { recursive: true })
const photo = join(output, 'New photo.jpg')
await sharp({ create: { width: 800, height: 500, channels: 3, background: '#4377bb' } })
  .jpeg()
  .toFile(photo)
const document = await PDFDocument.create()
for (let index = 0; index < 2; index++) {
  const page = document.addPage([595, 842])
  page.drawRectangle({
    x: 20,
    y: 20,
    width: 555,
    height: 802,
    color: rgb(0.2, 0.4 + index * 0.2, 0.7)
  })
  page.drawText(`NEW FILE PAGE ${index + 1}`, { x: 40, y: 750, size: 24 })
}
const pdf = join(output, 'Other file.pdf')
await writeFile(pdf, await document.save())
const reports = []
for (const [language, appearance] of [
  ['en', 'light'],
  ['fr', 'dark'],
  ['ar', 'dark']
]) {
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_LAST_SETTINGS: '1',
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
      '--appearance',
      appearance,
      '--',
      photo,
      pdf
    ],
    { cwd: root, env, windowsHide: true, timeout: 180000 }
  )
  assert.equal(await readFile(join(folder, 'error.txt'), 'utf8').catch(() => ''), '')
  const report = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  for (const key of [
    'headless',
    'cancelRestored',
    'submitRestored',
    'namedPresetRestored',
    'fullDriverBytesPreserved',
    'newFilesReset',
    'newJobCopiesReset',
    'currentJobCopiesPreserved',
    'legacyCopiesIgnored',
    'idCompletionRestored',
    'changedDriverRejected',
    'removedPresetRejected',
    'editedPresetRejected',
    'corruptDataRejected'
  ])
    assert.equal(report[key], true, key)
  reports.push({ language, appearance, ...report })
  console.log(
    `${language}: new jobs reset copies, current-job copies survive printer changes, and saved driver settings remain intact (${report.privateDriverBytes} private driver bytes).`
  )
}
await writeFile(join(output, 'results.json'), JSON.stringify({ hardwareJobs: 0, reports }, null, 2))
console.log(`Evidence: ${output}`)
