import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { copyFile, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '..'),
  output = join(root, 'output/fast-print-audit')
const executable = process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint.exe')
const environment = {
  ...process.env,
  FAST_PRINT_NONINTERACTIVE: '1',
  FAST_PRINT_TEST_SETTINGS: join(output, 'settings')
}
delete environment.ELECTRON_RUN_AS_NODE
delete environment.ELECTRON_RENDERER_URL
delete environment.PRINTER_ACCOUNT_MODE
const run = (exe, args, env = environment) =>
  new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: root,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let logs = ''
    child.stdout.on('data', (chunk) => (logs += chunk))
    child.stderr.on('data', (chunk) => (logs += chunk))
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Audit timed out. ' + logs))
    }, 180000)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve(logs) : reject(new Error('Exit ' + code + ': ' + logs))
    })
  })
const pdf = async (count) => {
  const document = await PDFDocument.create()
  for (let page = 0; page < count; page++) {
    const sheet = document.addPage([595.276, 841.89])
    sheet.drawRectangle({
      x: 30,
      y: 30,
      width: 535,
      height: 781,
      color: rgb(0.2, 0.4 + page * 0.1, 0.8)
    })
  }
  return document.save()
}
const reports = []
for (const [language, appearance] of [
  ['en', 'dark'],
  ['fr', 'light'],
  ['ar', 'light']
]) {
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  await rm(join(folder, 'error.txt'), { force: true })
  // A real BMP header; only these disposable copies are edited by the audit.
  const bitmap = Buffer.alloc(54 + 240 * 160 * 3)
  bitmap.write('BM')
  bitmap.writeUInt32LE(bitmap.length, 2)
  bitmap.writeUInt32LE(54, 10)
  bitmap.writeUInt32LE(40, 14)
  bitmap.writeInt32LE(240, 18)
  bitmap.writeInt32LE(160, 22)
  bitmap.writeUInt16LE(1, 26)
  bitmap.writeUInt16LE(24, 28)
  for (let offset = 54; offset < bitmap.length; offset += 3) {
    bitmap[offset] = 40
    bitmap[offset + 1] = 60
    bitmap[offset + 2] = 220
  }
  const files = [join(folder, 'edited & front.bmp')]
  await writeFile(files[0], bitmap)
  for (let index = 0; index < 4; index++) {
    const file = join(folder, 'photo-' + index + '.png')
    await sharp({
      create: {
        width: 240,
        height: 160,
        channels: 3,
        background: { r: 40 + index * 30, g: 160, b: 80 }
      }
    })
      .png()
      .toFile(file)
    files.push(file)
  }
  files.push(join(folder, 'edited & pages.pdf'))
  await writeFile(files.at(-1), await pdf(1))
  await writeFile(join(folder, 'replacement.pdf'), await pdf(2))
  const selection = join(folder, 'selection.json')
  await writeFile(selection, JSON.stringify({ version: 1, files }))
  await run(executable, [
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
        pagesPerSheet: 4
      })
    ).toString('base64'),
    '--batch',
    selection
  ])
  let error
  try {
    error = await readFile(join(folder, 'error.txt'), 'utf8')
  } catch {}
  assert.ok(!error, error)
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  const colorPlan = JSON.parse(await readFile(result.request, 'utf8'))
  assert.equal(basename(colorPlan.files[0]), 'edited & front.png')
  assert.equal(basename(colorPlan.files.at(-1)), 'edited & pages.pdf')
  for (const field of [
    'headless',
    'stalePrinterResultsIgnored',
    'pendingPrinterBlocksPrint',
    'copiesPreserved',
    'polaroidSettingsLocked',
    'editedBmpRefreshed',
    'editedPngRefreshed',
    'editedPdfPageCountRefreshed',
    'changedFilesRequireReview',
    'invalidProfileBlocksPrint',
    'missingFileBlocksPrint',
    'sheetFilenameSynchronized',
    'scrolledLayoutStable',
    'activeLayoutRefresh',
    'defaultsUnchanged'
  ])
    assert.equal(result[field], true, field)
  const worker = join(folder, 'worker')
  // The two independent proof jobs must not share files deleted after the first job.
  const monoPlan = JSON.parse(await readFile(result.monoRequest, 'utf8'))
  const monoInputs = join(dirname(result.monoRequest), 'inputs')
  await mkdir(monoInputs, { recursive: true })
  for (let index = 0; index < monoPlan.files.length; index++) {
    const file = join(monoInputs, index + extname(monoPlan.files[index]))
    await copyFile(monoPlan.files[index], file)
    monoPlan.files[index] = file
  }
  await writeFile(result.monoRequest, JSON.stringify(monoPlan))
  await run(
    createRequire(import.meta.url)('electron'),
    [root, '--fast-print-request', result.request],
    { ...environment, FAST_PRINT_VERIFY_DIR: worker, PRINTER_ACCOUNT_MODE: 'local-test' }
  )
  const driver = JSON.parse(await readFile(join(worker, 'driver-settings.json'), 'utf8'))
  assert.equal(driver.sheets, 3)
  assert.equal(driver.copies, 7)
  assert.equal(driver.paper, 'A4')
  assert.equal(driver.color, true)
  const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
  const metadata = await sharp(job.sheets[0]).metadata()
  const pixel = await sharp(job.sheets[0])
    .extract({
      left: Math.round(metadata.width / 4),
      top: Math.round(metadata.height / 4),
      width: 1,
      height: 1
    })
    .removeAlpha()
    .raw()
    .toBuffer()
  assert.ok(
    pixel[2] > 170 && pixel[0] < 100 && pixel[1] < 160,
    'The updated BMP was not used in print output.'
  )
  const monoWorker = join(folder, 'mono-worker')
  await run(
    createRequire(import.meta.url)('electron'),
    [root, '--fast-print-request', result.monoRequest],
    { ...environment, FAST_PRINT_VERIFY_DIR: monoWorker, PRINTER_ACCOUNT_MODE: 'local-test' }
  )
  const monoDriver = JSON.parse(await readFile(join(monoWorker, 'driver-settings.json'), 'utf8'))
  assert.equal(monoDriver.outputColor, false)
  assert.equal(monoDriver.rasterGrayscale, true)
  assert.equal(monoDriver.sheets, 3)
  assert.equal(monoDriver.copies, 7)
  const monoJob = JSON.parse(await readFile(join(monoWorker, 'job.json'), 'utf8'))
  for (const sheet of monoJob.sheets) {
    const pixels = await sharp(sheet).resize(80, 80, { fit: 'fill' }).removeAlpha().raw().toBuffer()
    for (let index = 0; index < pixels.length; index += 3)
      assert.ok(
        pixels[index] === pixels[index + 1] && pixels[index] === pixels[index + 2],
        'Black-and-white output retained colored pixels.'
      )
  }
  const previewFile = join(folder, 'mono-preview.png'),
    previewSize = await sharp(previewFile).metadata(),
    sheetSize = await sharp(monoJob.sheets[0]).metadata()
  for (const x of [0.25, 0.75]) {
    const previewPixel = await sharp(previewFile)
      .extract({
        left: Math.round(previewSize.width * x),
        top: Math.round(previewSize.height * 0.25),
        width: 1,
        height: 1
      })
      .removeAlpha()
      .raw()
      .toBuffer()
    const sheetPixel = await sharp(monoJob.sheets[0])
      .extract({
        left: Math.round(sheetSize.width * x),
        top: Math.round(sheetSize.height * 0.25),
        width: 1,
        height: 1
      })
      .removeAlpha()
      .raw()
      .toBuffer()
    assert.ok(
      Math.abs(previewPixel[0] - sheetPixel[0]) <= 2,
      'Grayscale preview brightness differs from printed artwork.'
    )
  }
  for (const directory of result.cleanupDirectories) {
    const path = resolve(directory)
    assert.equal(
      dirname(path).toLowerCase(),
      resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
    )
    assert.match(basename(path), /^[a-f0-9]{32}$/)
    await rm(path, { recursive: true, force: true })
  }
  reports.push({
    language,
    ...result,
    request: undefined,
    monoRequest: undefined,
    cleanupDirectories: undefined,
    driver,
    monochromeMatchesPreview: true
  })
  console.log(
    language,
    'edited sources, printer races, profile guards, navigation, scroll and seven-copy print handoff passed'
  )
}
await writeFile(
  join(output, 'results.json'),
  JSON.stringify({ reports, headless: true, hardwareJobs: 0 }, null, 2)
)
