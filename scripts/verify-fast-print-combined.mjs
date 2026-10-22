import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import { fastPrintLayout, fastPrintCell } from '../src/shared/fast-print.ts'

const root = resolve(import.meta.dirname, '..'),
  output = join(
    root,
    process.env.FAST_PRINT_VERIFY_STOCK_UI === '1'
      ? 'output/fast-print-stocks-ui'
      : 'output/fast-print-combined'
  )
const native = process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint.exe')
const electron = createRequire(import.meta.url)('electron')
const results = []
const proofsOnly = process.argv.includes('--proofs-only')
async function removeOwned(path) {
  const absolute = resolve(path)
  assert.equal(
    dirname(absolute).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(absolute, /maher-fast-print-native[\\/][a-f0-9]{32}$/)
  await rm(absolute, { recursive: true, force: true })
}
for (const [language, appearance] of [
  ['en', 'dark'],
  ['fr', 'light'],
  ['ar', 'dark']
]) {
  if (
    process.env.FAST_PRINT_COMBINED_LANGUAGES &&
    !JSON.parse(process.env.FAST_PRINT_COMBINED_LANGUAGES).includes(language)
  )
    continue
  if (proofsOnly && language !== 'en') continue
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  if (!proofsOnly) await rm(join(folder, 'error.txt'), { force: true })
  const files = []
  const pageColors = []
  for (const [fileIndex, count] of [5, 3, 0, 0, 1, 0].entries()) {
    const path = join(folder, 'file-' + fileIndex + (count ? '.pdf' : '.png'))
    if (count) {
      const document = await PDFDocument.create()
      for (let i = 0; i < count; i++) {
        const page = document.addPage(i % 2 ? [842, 595] : [595, 842])
        if (i === 2) page.setRotation(degrees(90))
        pageColors.push(
          [0.15 + fileIndex * 0.1, 0.25 + i * 0.1, 0.6].map((value) => Math.round(value * 255))
        )
        page.drawRectangle({
          x: 0,
          y: 0,
          width: page.getWidth(),
          height: page.getHeight(),
          color: rgb(0.15 + fileIndex * 0.1, 0.25 + i * 0.1, 0.6)
        })
        page.drawText('FILE ' + fileIndex + ' PAGE ' + (i + 1), {
          x: 40,
          y: page.getHeight() - 65,
          size: 25
        })
      }
      if (!proofsOnly) await writeFile(path, await document.save())
    } else {
      if (!proofsOnly)
        await sharp(
          Buffer.from(
            `<svg width="600" height="400"><rect width="100%" height="100%" fill="hsl(${fileIndex * 50},60%,55%)"/><text x="30" y="80" font-size="50">PHOTO ${fileIndex}</text></svg>`
          )
        )
          .png()
          .toFile(path)
    }
    if (!count)
      pageColors.push([
        ...(await sharp(path)
          .extract({ left: 300, top: 200, width: 1, height: 1 })
          .removeAlpha()
          .raw()
          .toBuffer())
      ])
    files.push(path)
  }
  const selection = join(folder, 'selection.json')
  await writeFile(selection, JSON.stringify({ version: 1, files }))
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_COMBINED: '1',
    FAST_PRINT_NONINTERACTIVE: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings')
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  if (!proofsOnly)
    await new Promise((fulfill, reject) => {
      const child = spawn(
        native,
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
          selection
        ],
        { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
      )
      let log = ''
      child.stdout.on('data', (chunk) => (log += chunk))
      child.stderr.on('data', (chunk) => (log += chunk))
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error('Direction verification timed out ' + log))
      }, 180000)
      child.once('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.once('exit', (code) => {
        clearTimeout(timer)
        code === 0 ? fulfill() : reject(new Error('Direction exit ' + code + ': ' + log))
      })
    })
  let failure
  try {
    failure = await readFile(join(folder, 'error.txt'), 'utf8')
  } catch {}
  assert.ok(!failure, failure)
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(result.headless, true)
  if (proofsOnly)
    result.reports = (await readdir(folder))
      .filter((name) => /^A[34]-(2|4|6|8|9|12|16)-(merged|separate)$/.test(name))
      .map((name) => ({ name, per: Number(name.split('-')[1]), merge: name.endsWith('-merged') }))
  assert.deepEqual(result.counts, [5, 3, 1, 1, 1, 1])
  assert.equal(result.reports.length, process.env.FAST_PRINT_VERIFY_STOCK_UI === '1' ? 0 : 28)
  assert.equal(result.presets.length, 2)
  assert.ok(result.presets.every((preset) => preset.fullDriverBytes))
  for (const report of result.reports) {
    if (proofsOnly && language !== 'en') continue
    const plan = JSON.parse(
      await readFile(
        proofsOnly ? join(folder, report.name, 'worker/job.json') : report.request,
        'utf8'
      )
    )
    assert.equal(plan.preset.combineFiles, report.merge)
    const sides = (report.merge ? [12] : [5, 3, 2, 1, 1]).map((pages) =>
      Math.ceil(pages / report.per)
    )
    const simplex = sides.reduce((sum, count) => sum + count, 0)
    const duplex = simplex + sides.slice(0, -1).filter((count) => count % 2).length
    if (!proofsOnly) {
      assert.equal(report.simplex.Pages, simplex)
      assert.equal(report.simplex.TotalSheets, simplex * 2)
      assert.equal(report.duplex.Pages, duplex)
      assert.equal(report.duplex.TotalSheets, Math.ceil(duplex / 2) * 2)
    }
    if (language === 'en') {
      const worker = join(folder, report.name, 'worker')
      if (!proofsOnly)
        await promisify(execFile)(electron, [root, '--fast-print-request', report.request], {
          cwd: root,
          windowsHide: true,
          timeout: 120000,
          env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: worker }
        })
      const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
      assert.equal(job.sheets.length, simplex)
      if (report.merge)
        for (let page = 0; page < job.sheets.length; page++) {
          const layout = fastPrintLayout(plan.preset)
          const occupied = Math.min(report.per, 12 - page * report.per)
          for (let slot = 0; slot < occupied; slot++) {
            const cell = fastPrintCell(layout, slot, occupied)
            const color = [
              ...(await sharp(job.sheets[page])
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
            const expectedColor = pageColors[page * report.per + slot]
            assert.ok(
              color.every((value, index) => Math.abs(value - expectedColor[index]) < 6),
              'Missing/reordered page: ' + report.name + ' page ' + page + ' slot ' + slot
            )
          }
          const actual = await sharp(job.sheets[page])
            .resize(220, 220, { fit: 'fill' })
            .removeAlpha()
            .raw()
            .toBuffer()
          const expected = await sharp(
            report.sheets?.[page] ?? join(folder, report.name, 'sheet-' + page + '.png')
          )
            .resize(220, 220, { fit: 'fill' })
            .removeAlpha()
            .raw()
            .toBuffer()
          const difference =
            actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) /
            actual.length
          assert.ok(
            difference < 12,
            'Merged preview/output mismatch: ' +
              report.name +
              ' sheet ' +
              page +
              ' error ' +
              difference
          )
        }
      console.log(report.name + ': ordered PDF/photo pages, preview and output counts passed')
    } else if (!proofsOnly) await removeOwned(dirname(report.request))
  }
  if (!proofsOnly) await removeOwned(result.cleanupDirectory)
  results.push({
    language,
    appearance,
    cases: result.reports.length,
    namedStocks: true
  })
  console.log(
    language +
      (result.reports.length
        ? ': combined-file layout and named stock checks passed'
        : ': named stock saving, A4/A3 selection and dialog checks passed')
  )
}
await writeFile(
  join(output, proofsOnly ? 'proof-order.json' : 'results.json'),
  JSON.stringify({ hardwareJobs: 0, results }, null, 2)
)
