import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { PDFDocument, rgb } from 'pdf-lib'
import { fastPrintCell, fastPrintLayout } from '../src/shared/fast-print.ts'

// Hidden native window and verification-only print renderer; never sends a print job.
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-five-seven', randomUUID())
const native =
  process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-five-seven.exe')
const electron = createRequire(import.meta.url)('electron')
const run = promisify(execFile)
await mkdir(output, { recursive: true })
const colors = [
  [210, 55, 55],
  [55, 150, 75],
  [55, 95, 210],
  [185, 120, 35],
  [145, 65, 170],
  [30, 145, 155],
  [190, 80, 120],
  [110, 125, 45],
  [100, 80, 165],
  [180, 130, 170],
  [80, 160, 175]
]
const files = []
for (const [index, color] of colors.slice(0, 9).entries()) {
  const file = join(output, `photo-${index + 1}.png`)
  const [r, g, b] = color
  await sharp(
    Buffer.from(
      `<svg width="900" height="600"><rect width="900" height="600" fill="rgb(${r},${g},${b})"/><rect width="900" height="45" fill="white"/><text x="30" y="110" font-size="40">PHOTO ${index + 1}</text></svg>`
    )
  )
    .png()
    .toFile(file)
  files.push(file)
}
const pdf = await PDFDocument.create()
for (const [index, color] of colors.slice(9).entries()) {
  const page = pdf.addPage([595, 842])
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 595,
    height: 842,
    color: rgb(...color.map((c) => c / 255))
  })
  page.drawText(`PDF ${index + 1}`, { x: 30, y: 780, size: 25 })
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
const summaries = []
for (const language of ['en', 'fr', 'ar']) {
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_DIRECTION: '1',
    FAST_PRINT_VERIFY_FIVE_SEVEN: '1',
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
      selection
    ],
    { cwd: root, env, windowsHide: true, timeout: 240000 }
  )
  assert.equal(await readFile(join(folder, 'error.txt'), 'utf8').catch(() => ''), '')
  const report = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(report.headless, true)
  assert.equal(report.rotationIsolated, true)
  assert.equal(report.sourceOrderChecked, true)
  assert.equal(report.reports.length, 8)
  for (const item of report.reports) {
    const request = JSON.parse(await readFile(item.request, 'utf8'))
    assert.equal(request.preset.pagesPerSheet, item.per)
    assert.equal(request.preset.sourceRotations[1], 1)
    assert.ok(request.preset.sourceRotations.filter((_, i) => i !== 1).every((turn) => turn === 0))
    assert.equal(request.copies, 2)
    assert.equal(item.sheets.length, Math.ceil(colors.length / item.per))
    assert.equal(item.totals.TotalSheets, item.sheets.length * 2)
    if (language === 'en') {
      const worker = join(folder, item.name, 'worker')
      await run(electron, [root, '--fast-print-request', item.request], {
        cwd: root,
        windowsHide: true,
        timeout: 180000,
        env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: worker }
      })
      const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
      assert.equal(job.sheets.length, item.sheets.length)
      assert.equal(job.copies, 2)
      const layout = fastPrintLayout(request.preset)
      for (let sheet = 0; sheet < job.sheets.length; sheet++) {
        const expected = await sharp(item.sheets[sheet])
          .resize(300, 300, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer()
        const actual = await sharp(job.sheets[sheet])
          .resize(300, 300, { fit: 'fill' })
          .removeAlpha()
          .raw()
          .toBuffer()
        const difference =
          actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) /
          actual.length
        assert.ok(
          difference < 12,
          `Preview/output mismatch ${item.name} sheet ${sheet + 1}: ${difference}`
        )
        const occupied = Math.min(item.per, colors.length - sheet * item.per)
        for (let slot = 0; slot < occupied; slot++) {
          const cell = fastPrintCell(layout, slot, occupied)
          const pixel = await sharp(job.sheets[sheet])
            .extract({
              left: Math.floor(cell.x + cell.width / 2),
              top: Math.floor(cell.y + cell.height / 2),
              width: 1,
              height: 1
            })
            .removeAlpha()
            .raw()
            .toBuffer()
          const color = colors[sheet * item.per + slot]
          assert.ok(
            [...pixel].every((value, index) => Math.abs(value - color[index]) < 14),
            `${item.name} sheet ${sheet + 1} slot ${slot + 1} has the wrong source`
          )
        }
      }
    } else await removeOwned(dirname(item.request))
  }
  await removeOwned(report.cleanupDirectory)
  summaries.push({ language, folder, cases: report.reports.length })
  console.log(
    `${language}: 5/7 layouts, source order, rotation, pagination and ${language === 'en' ? 'matching print proofs' : 'native previews'} passed`
  )
}
await writeFile(
  join(root, 'output/fast-print-five-seven/results.json'),
  JSON.stringify({ headless: true, hardwareJobs: 0, summaries }, null, 2)
)
