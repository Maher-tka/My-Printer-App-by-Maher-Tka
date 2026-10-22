import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve, dirname, basename } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { PDFDocument, rgb } from 'pdf-lib'
import { fastPrintLayout, fastPrintCell } from '../src/shared/fast-print.ts'

const root = resolve(import.meta.dirname, '..'),
  output = process.env.FAST_PRINT_PRESET_OUTPUT || join(root, 'output/fast-print-general-presets')
const executable = process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint.exe')
const electron = createRequire(import.meta.url)('electron')
const env = {
  ...process.env,
  FAST_PRINT_NONINTERACTIVE: '1',
  FAST_PRINT_VERIFY_PRESETS: '1',
  FAST_PRINT_TEST_SETTINGS: join(output, 'settings')
}
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_RENDERER_URL
const run = (exe, args, environment = env) =>
  new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: root,
      env: environment,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let logs = ''
    child.stdout.on('data', (chunk) => (logs += chunk))
    child.stderr.on('data', (chunk) => (logs += chunk))
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Preset verification timed out. ' + logs))
    }, 180_000)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve(logs) : reject(new Error('Preset verification failed: ' + logs))
    })
  })
await mkdir(output, { recursive: true })
const files = []
for (let index = 0; index < 17; index++) {
  const width = index % 2 ? 240 : 360,
    height = index % 2 ? 360 : 240
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="hsl(${index * 21},65%,55%)"/><rect x="12" y="12" width="${width - 24}" height="${height - 24}" fill="none" stroke="black" stroke-width="5"/><path d="M${width / 2} 20 L${width / 2 - 20} 50 L${width / 2 + 20} 50 Z" fill="black"/><text x="30" y="${height / 2}" font-size="48">${index + 1}</text></svg>`
  const file = join(output, `image-${String(index + 1).padStart(2, '0')}.png`)
  await sharp(Buffer.from(svg)).png().toFile(file)
  files.push(file)
}
const pdf = await PDFDocument.create()
for (let index = 0; index < 5; index++) {
  const page = pdf.addPage(index % 2 ? [842, 595] : [595, 842])
  page.drawRectangle({
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
    color: rgb(0.15 + index * 0.1, 0.6, 0.85 - index * 0.1)
  })
  page.drawRectangle({
    x: 18,
    y: 18,
    width: page.getWidth() - 36,
    height: page.getHeight() - 36,
    borderWidth: 4,
    borderColor: rgb(0, 0, 0)
  })
  page.drawText(`PAGE ${index + 1} - TOP`, { x: 40, y: page.getHeight() - 65, size: 25 })
}
const pdfFile = join(output, 'five-mixed-pages.pdf')
await writeFile(pdfFile, await pdf.save())
files.push(pdfFile)
const hash = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
const originalHashes = await Promise.all(files.map(hash))
const selection = join(output, 'selection.json')
await writeFile(selection, JSON.stringify({ version: 1, files }))
const compare = async (actualFile, expectedFile) => {
  const actual = await sharp(actualFile)
    .resize(240, 240, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer()
  const expected = await sharp(expectedFile)
    .resize(240, 240, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer()
  let difference = 0
  for (let i = 0; i < actual.length; i++) difference += Math.abs(actual[i] - expected[i])
  assert.ok(
    difference / actual.length < 10,
    `Native/worker preview mismatch: ${actualFile} (${difference / actual.length})`
  )
}
const verifyMargins = async (file, preset, occupied) => {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const layout = fastPrintLayout(
      preset.autoOrientation && preset.pagesPerSheet === 1
        ? { ...preset, landscape: info.width > info.height }
        : preset
    ),
    cells = Array.from({ length: occupied }, (_, i) => fastPrintCell(layout, i, occupied))
  assert.equal(info.width, layout.width)
  assert.equal(info.height, layout.height)
  let outside = 0
  const allowed = new Uint8Array(info.width)
  for (let y = 0; y < info.height; y++) {
    allowed.fill(0)
    for (const cell of cells)
      if (y >= cell.y - 1 && y < cell.y + cell.height + 1)
        allowed.fill(
          1,
          Math.max(0, Math.ceil(cell.x - 1)),
          Math.min(info.width, Math.ceil(cell.x + cell.width + 1))
        )
    for (let x = 0; x < info.width; x++)
      if (!allowed[x]) {
        const index = (y * info.width + x) * info.channels
        if (Math.min(data[index], data[index + 1], data[index + 2]) < 240) outside++
      }
  }
  assert.equal(outside, 0, 'Ink escaped equal slots, cutting gaps or page margins')
}
const removeOwned = async (directory) => {
  const absolute = resolve(directory)
  assert.equal(
    dirname(absolute).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(basename(absolute), /^[a-f0-9]{32}$/)
  await rm(absolute, { recursive: true, force: true })
}
const results = []
for (const [language, appearance] of [
  ['en', 'dark'],
  ['fr', 'light'],
  ['ar', 'dark']
]) {
  if (
    process.env.FAST_PRINT_PRESET_LANGUAGES &&
    !JSON.parse(process.env.FAST_PRINT_PRESET_LANGUAGES).includes(language)
  )
    continue
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  await rm(join(folder, 'error.txt'), { force: true })
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
  let failure
  try {
    failure = await readFile(join(folder, 'error.txt'), 'utf8')
  } catch {}
  assert.ok(!failure, failure)
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(result.headless, true)
  assert.equal(result.selectedRotationIndependent, true)
  assert.equal(result.globalRotationConsistent, true)
  assert.equal(result.defaultRotationConsistent, true)
  assert.equal(result.reports.length, 16)
  for (const report of result.reports) {
    const plan = JSON.parse(await readFile(report.request, 'utf8'))
    assert.equal(report.imagePages, 17)
    assert.equal(report.pdfPages, 5)
    assert.equal(plan.preset.marginMm, report.marginMm)
    assert.equal(plan.preset.gapMm, report.gapMm)
    assert.deepEqual(plan.preset.sourceRotations, report.rotations)
    assert.deepEqual(
      report.rotations,
      Array.from({ length: 18 }, (_, index) =>
        report.count === 9 ? (index === 0 || index === 17 ? 1 : index === 1 ? 3 : 0) : 0
      ),
      'Defaults must preserve one rotation across all sources'
    )
    if (language === 'en') {
      const proof = join(folder, report.name, 'worker')
      await run(electron, [root, '--fast-print-request', report.request], {
        ...env,
        PRINTER_ACCOUNT_MODE: 'local-test',
        FAST_PRINT_VERIFY_DIR: proof
      })
      const driver = JSON.parse(await readFile(join(proof, 'driver-settings.json'), 'utf8'))
      const imageSheets = Math.ceil(17 / report.count),
        pdfSheets = Math.ceil(5 / report.count)
      assert.equal(driver.sheets, imageSheets + pdfSheets)
      assert.equal(driver.paper, report.paper)
      const checks = [
        [0, 'images-first.png', Math.min(17, report.count)],
        [imageSheets - 1, 'images-final.png', ((17 - 1) % report.count) + 1],
        [imageSheets, 'pdf-first.png', Math.min(5, report.count)],
        [imageSheets + pdfSheets - 1, 'pdf-final.png', ((5 - 1) % report.count) + 1]
      ]
      for (const [index, preview, occupied] of checks) {
        const file = join(proof, String(index + 1).padStart(5, '0') + '.png')
        await compare(file, join(folder, report.name, preview))
        await verifyMargins(file, plan.preset, occupied)
      }
      console.log(
        `${report.paper} ${report.count}-up: uniform slots, ${report.marginMm} mm margins, rotations, final sheets and PDF boundaries passed`
      )
    } else await removeOwned(dirname(report.request))
  }
  await removeOwned(result.sourceSession)
  results.push({ language, appearance, layouts: result.reports.length, hardwareJobs: 0 })
}
assert.deepEqual(await Promise.all(files.map(hash)), originalHashes)
await writeFile(
  join(output, 'results.json'),
  JSON.stringify({ headless: true, originalsUnchanged: true, results }, null, 2)
)
console.log('General native Fast Print presets verified without hardware output.')
