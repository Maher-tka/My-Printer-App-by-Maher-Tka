import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { PDFDocument, degrees, rgb } from 'pdf-lib'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..'),
  output = join(root, 'output/fast-print-source')
const executable = process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint.exe')
const electron = createRequire(import.meta.url)('electron')
const reports = []
for (const [language, appearance] of [
  ['en', 'dark'],
  ['fr', 'light'],
  ['ar', 'dark']
]) {
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  await rm(join(folder, 'error.txt'), { force: true })
  const files = []
  for (const [name, width, height, orientation] of [
    ['landscape.jpg', 900, 500, 1],
    ['portrait.jpg', 500, 900, 1],
    ['camera-rotation.jpg', 900, 500, 6]
  ]) {
    const svg = `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#2785bf"/><rect x="10" y="10" width="${width - 20}" height="40" fill="red"/><text x="50" y="120" font-size="60">TOP</text></svg>`
    const path = join(folder, name)
    await sharp(Buffer.from(svg)).withMetadata({ orientation }).jpeg().toFile(path)
    files.push(path)
  }
  const pdf = await PDFDocument.create()
  for (const [width, height, rotation] of [
    [842, 595, 0],
    [595, 842, 0],
    [595, 842, 90],
    [842, 595, 270]
  ]) {
    const page = pdf.addPage([width, height])
    page.setRotation(degrees(rotation))
    page.drawRectangle({
      x: 10,
      y: 10,
      width: width - 20,
      height: height - 20,
      color: rgb(0.2, 0.55, 0.8)
    })
    page.drawText('TOP', { x: 40, y: height - 80, size: 45 })
  }
  const document = join(folder, 'mixed-orientations.pdf')
  await writeFile(document, await pdf.save())
  files.push(document)
  const manifest = join(folder, 'selection.json')
  await writeFile(manifest, JSON.stringify({ version: 1, files }))
  const env = {
    ...process.env,
    FAST_PRINT_NONINTERACTIVE: '1',
    FAST_PRINT_VERIFY_SOURCE: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings')
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await new Promise((fulfill, reject) => {
    const child = spawn(
      executable,
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
        manifest
      ],
      { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    let logs = ''
    child.stdout.on('data', (chunk) => (logs += chunk))
    child.stderr.on('data', (chunk) => (logs += chunk))
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Source verification timed out: ' + logs))
    }, 180000)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      code === 0 ? fulfill() : reject(new Error('Source verification exit ' + code + ': ' + logs))
    })
  })
  let failure
  try {
    failure = await readFile(join(folder, 'error.txt'), 'utf8')
  } catch {}
  assert.ok(!failure, failure)
  const report = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(report.headless, true)
  assert.equal(report.lastPrinterRestored, true)
  assert.equal(report.explicitOrientationChecked, true)
  const expected = [true, false, false, true, false, true, false]
  for (const item of report.requests) {
    assert.deepEqual(
      item.landscapes,
      expected,
      'Native previews must preserve image/EXIF/PDF orientations'
    )
    assert.ok(
      item.summary.includes('7 ') && item.summary.includes('14 '),
      'Mixed inputs and copies must show all 14 sheets'
    )
    const worker = join(folder, item.paper)
    await promisify(execFile)(electron, [root, '--fast-print-request', item.request], {
      cwd: root,
      windowsHide: true,
      timeout: 120000,
      env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: worker }
    })
    const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
    assert.equal(job.preset.autoOrientation, true)
    assert.equal(job.preset.fitToFrame, false)
    assert.equal(job.sheets.length, 7)
    assert.equal(job.sheetSizes.length, 7)
    const driver = JSON.parse(await readFile(join(worker, 'driver-settings.json'), 'utf8'))
    assert.equal(driver.paper, item.paper)
    assert.equal(driver.copies, 2)
    for (let i = 0; i < 7; i++) {
      const metadata = await sharp(job.sheets[i]).metadata()
      assert.equal(
        metadata.width > metadata.height,
        expected[i],
        'Print page orientation differs from the source'
      )
      const size = job.sheetSizes[i],
        short = item.paper === 'A3' ? 297 : 210,
        long = item.paper === 'A3' ? 420 : 297
      assert.ok(Math.abs(size.widthMm - (expected[i] ? long : short)) < 0.15)
      assert.ok(Math.abs(size.heightMm - (expected[i] ? short : long)) < 0.15)
      const actual = await sharp(job.sheets[i])
        .resize(200, 200, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer()
      const preview = await sharp(join(folder, item.paper + '-source-' + i + '.png'))
        .resize(200, 200, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer()
      const error =
        actual.reduce((sum, value, index) => sum + Math.abs(value - preview[index]), 0) /
        actual.length
      assert.ok(error < 12, 'Native and print page placement differ: ' + error)
    }
  }
  const owned = resolve(report.cleanupDirectory)
  assert.equal(
    dirname(owned).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(owned, /maher-fast-print-native[\\/][a-f0-9]{32}$/)
  await rm(owned, { recursive: true, force: true })
  reports.push({
    language,
    appearance,
    pages: 7,
    copies: 2,
    sheets: 14,
    lastPrinterRestored: true,
    sourceOrientationsMatched: true
  })
  console.log(
    language +
      ': last printer, original/manual orientation, A4/A3 physical sizes, all 7 pages and 14-sheet total passed.'
  )
}
await writeFile(join(output, 'results.json'), JSON.stringify({ hardwareJobs: 0, reports }, null, 2))
