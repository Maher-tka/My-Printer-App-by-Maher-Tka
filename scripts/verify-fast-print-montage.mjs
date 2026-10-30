import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import sharp from 'sharp'

// Hidden native windows + the real Electron renderer. ValidateOnly prevents spooler jobs.
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-montage', randomUUID())
const run = promisify(execFile)
const electron = createRequire(import.meta.url)('electron')
const native = join(root, 'out/native/FastPrint-montage.exe')
await mkdir(output, { recursive: true })
const pdf = await PDFDocument.create()
for (let index = 0; index < 11; index++) {
  const page = pdf.addPage([(55 * 72) / 25.4, (85 * 72) / 25.4])
  page.drawRectangle({
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
    color: rgb(0.12, 0.45 + index * 0.025, 0.7)
  })
  page.drawText('Badge ' + (index + 1), { x: 8, y: page.getHeight() - 24, size: 14 })
  if (index === 10) page.setRotation(degrees(90))
}
// Prefix fixtures to preserve their intended indices under Explorer filename sorting.
const pdfFile = join(output, '01-badges.pdf')
await writeFile(pdfFile, await pdf.save())
const image = join(output, '02-badge-300dpi.png')
await sharp({ create: { width: 650, height: 1004, channels: 3, background: '#40a890' } })
  .withMetadata({ density: 300 })
  .png()
  .toFile(image)
const jpeg = join(output, '03-badge-exif.jpg')
// Stored as landscape; EXIF makes this a portrait badge, at 254 DPI.
await sharp({ create: { width: 850, height: 550, channels: 3, background: '#f4bb52' } })
  .withMetadata({ density: 254, orientation: 6 })
  .jpeg()
  .toFile(jpeg)
const noDpi = join(output, '04-badge-without-dpi.png')
await sharp({ create: { width: 96, height: 64, channels: 3, background: '#ac5890' } })
  .png()
  .toFile(noDpi)
// Sharp writes a valid 25.4 DPI pHYs chunk by default. Remove it to exercise missing metadata.
const tagged = await readFile(noDpi),
  chunks = [tagged.subarray(0, 8)]
for (let offset = 8; offset + 12 <= tagged.length; ) {
  const end = offset + 12 + tagged.readUInt32BE(offset)
  if (tagged.toString('ascii', offset + 4, offset + 8) !== 'pHYs')
    chunks.push(tagged.subarray(offset, end))
  offset = end
}
await writeFile(noDpi, Buffer.concat(chunks))
const files = [pdfFile, image, jpeg, noDpi]
const hashes = async () =>
  Promise.all(
    files.map(async (file) =>
      createHash('sha256')
        .update(await readFile(file))
        .digest('hex')
    )
  )
const before = await hashes()
const results = []
for (const language of ['en', 'fr', 'ar']) {
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  const selection = join(folder, 'selection.json')
  await writeFile(selection, JSON.stringify({ version: 1, files }))
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_DIRECTION: '1',
    FAST_PRINT_VERIFY_MONTAGE: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings'),
    FAST_PRINT_TEST_SINGLE_CORE: '1',
    FAST_PRINT_NONINTERACTIVE: '1'
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  const { stdout, stderr } = await run(
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
  await writeFile(join(folder, 'native.log'), stdout + stderr)
  assert.equal(await readFile(join(folder, 'error.txt'), 'utf8').catch(() => ''), '')
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  for (const key of [
    'headless',
    'rejectedOversize',
    'actualSizeDisablesCrop',
    'specialModesIsolated'
  ])
    assert.equal(result[key], true, key)
  assert.equal(result.captures.length, 8)
  for (const report of result.reports) {
    const request = JSON.parse(await readFile(report.request, 'utf8'))
    assert.equal(request.preset.compact, true)
    assert.equal(request.preset.preserveActualSize, true)
    assert.equal(request.preset.fitToFrame, false)
    assert.equal(request.preset.separatorLines, true)
    assert.equal(request.preset.separatorColor, '#E02080')
    assert.equal(request.preset.gapMm, 0)
    assert.equal(request.preset.imageSizesMm[0], null)
    assert.ok(Math.abs(request.preset.imageSizesMm[1].widthMm - (650 * 25.4) / 300) < 0.01)
    assert.ok(Math.abs(request.preset.imageSizesMm[2].widthMm - 55) < 0.01, 'EXIF physical width')
    assert.ok(Math.abs(request.preset.imageSizesMm[2].heightMm - 85) < 0.01, 'EXIF physical height')
    assert.ok(Math.abs(request.preset.imageSizesMm[3].widthMm - 25.4) < 0.01, 'Missing DPI uses 96')
    assert.equal(report.bounds.length, 14)
    assert.equal(report.sheets.length, 2)
    for (const badge of report.bounds.filter((item) => item.file === 0)) {
      assert.ok(Math.abs(badge.widthMm - (badge.page === 10 ? 85 : 55)) < 0.01)
      assert.ok(Math.abs(badge.heightMm - (badge.page === 10 ? 55 : 85)) < 0.01)
    }
    if (language !== 'en') continue
    const worker = join(folder, report.name, 'worker')
    const ran = await run(electron, [root, '--fast-print-request', report.request], {
      cwd: root,
      env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: worker },
      windowsHide: true,
      timeout: 120000
    })
    await writeFile(join(worker, 'worker.log'), ran.stdout + ran.stderr)
    const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
    assert.equal(job.sheets.length, 2)
    for (let sheet = 0; sheet < job.sheets.length; sheet++) {
      const pixels = async (file) =>
        sharp(file).resize(420, 594, { fit: 'fill' }).removeAlpha().raw().toBuffer()
      const actual = await pixels(job.sheets[sheet]),
        expected = await pixels(report.sheets[sheet])
      const difference =
        actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) /
        actual.length
      assert.ok(difference < 5, 'Native/output mismatch ' + report.name + ': ' + difference)
      report['difference' + sheet] = difference
    }
  }
  if (language === 'en') {
    const worker = join(folder, 'rotation/worker')
    await run(electron, [root, '--fast-print-request', result.rotatedRequest], {
      cwd: root,
      env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: worker },
      windowsHide: true,
      timeout: 120000
    })
    const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
    assert.equal(job.preset.pageRotations[0].turns, 1)
    const actual = await sharp(job.sheets[0]).resize(420, 594).removeAlpha().raw().toBuffer()
    const expected = await sharp(join(folder, 'rotation/sheet-0.png'))
      .resize(420, 594)
      .removeAlpha()
      .raw()
      .toBuffer()
    const difference =
      actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) /
      actual.length
    assert.ok(difference < 5, 'Rotated montage preview/output mismatch: ' + difference)
    const fittedWorker = join(folder, 'compact-fit/worker')
    await run(electron, [root, '--fast-print-request', result.fittedRequest], {
      cwd: root,
      env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: fittedWorker },
      windowsHide: true,
      timeout: 120000
    })
    const fittedJob = JSON.parse(await readFile(join(fittedWorker, 'job.json'), 'utf8'))
    assert.equal(fittedJob.preset.compact, true)
    assert.equal(fittedJob.preset.preserveActualSize, false)
    assert.equal(fittedJob.sheets.length, 2)
    const fitted = await sharp(fittedJob.sheets[0]).resize(420, 594).removeAlpha().raw().toBuffer()
    const fittedPreview = await sharp(join(folder, 'compact-fit/sheet-0.png'))
      .resize(420, 594)
      .removeAlpha()
      .raw()
      .toBuffer()
    const fittedDifference =
      fitted.reduce((sum, value, index) => sum + Math.abs(value - fittedPreview[index]), 0) /
      fitted.length
    assert.ok(fittedDifference < 5, 'Compact fitted preview/output mismatch: ' + fittedDifference)
  }
  results.push({ language, folder, reports: result.reports })
  console.log(
    language +
      ': actual PDF/image/EXIF sizes, compact packing, colors, pagination, oversize rejection and UI passed'
  )
}
assert.deepEqual(await hashes(), before, 'Original artwork was modified')
await writeFile(
  join(output, 'results.json'),
  JSON.stringify({ headless: true, hardwareJobs: 0, results }, null, 2)
)
console.log('Evidence: ' + output)
