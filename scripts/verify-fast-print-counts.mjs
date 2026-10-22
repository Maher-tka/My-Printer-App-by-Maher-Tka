import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-counts')
const executable = process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint.exe')
const electron = createRequire(import.meta.url)('electron')
const pdf = async (pages) => {
  const document = await PDFDocument.create()
  for (let i = 0; i < pages; i++) {
    const page = document.addPage([595, 842])
    page.drawRectangle({ x: 40, y: 40, width: 515, height: 762, color: rgb(0.2, 0.5, 0.8) })
    page.drawText('PAGE ' + (i + 1), { x: 100, y: 400, size: 40 })
  }
  return document.save()
}
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
  for (const [name, count] of [
    ['document-five.pdf', 5],
    ['document-three.pdf', 3],
    ['photo-one.png', 1],
    ['photo-two.png', 1],
    ['document-one.pdf', 1],
    ['photo-three.png', 1]
  ]) {
    const path = join(folder, name)
    if (name.endsWith('.pdf')) await writeFile(path, await pdf(count))
    else
      await sharp({ create: { width: 300, height: 200, channels: 3, background: '#247dba' } })
        .png()
        .toFile(path)
    files.push(path)
  }
  await writeFile(join(folder, 'replacement.pdf'), await pdf(7))
  const selection = join(folder, 'selection.json')
  await writeFile(selection, JSON.stringify({ version: 1, files }))
  const env = {
    ...process.env,
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings'),
    FAST_PRINT_NONINTERACTIVE: '1'
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await new Promise((fulfill, reject) => {
    const child = spawn(
      executable,
      [
        '--verify-counts',
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
    let logs = ''
    child.stdout.on('data', (chunk) => (logs += chunk))
    child.stderr.on('data', (chunk) => (logs += chunk))
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Count verification timed out: ' + logs))
    }, 120000)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      code === 0 ? fulfill() : reject(new Error('Count verification exit ' + code + ': ' + logs))
    })
  })
  let failure
  try {
    failure = await readFile(join(folder, 'error.txt'), 'utf8')
  } catch {}
  assert.ok(!failure, failure)
  const report = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(report.headless, true)
  assert.deepEqual(report.counts, [5, 3, 1, 1, 1, 1])
  assert.deepEqual(report.changedCounts, [7, 3, 1, 1, 1, 1])
  assert.equal(report.changedAndMissingChecked, true)
  assert.equal(report.labels.length, 6)
  assert.ok(report.labels[0].includes('5 ') && report.labels[1].includes('3 '))
  // PDFs retain their own final sheet; the two adjacent photos share a group.
  const groups = [5, 3, 2, 1, 1]
  for (const item of report.reports) {
    const sides = groups.map((pages) => Math.ceil(pages / item.per))
    const simplex = sides.reduce((a, b) => a + b, 0)
    const duplexSides = simplex + sides.slice(0, -1).filter((count) => count % 2).length
    assert.equal(item.simplex.Pages, simplex)
    assert.equal(item.simplex.Sheets, simplex)
    assert.equal(item.simplex.TotalSheets, simplex * item.copies)
    assert.equal(item.duplex.Pages, duplexSides)
    assert.equal(item.duplex.Sheets, Math.ceil(duplexSides / 2))
    assert.equal(item.duplex.TotalSheets, Math.ceil(duplexSides / 2) * item.copies)
    assert.ok(item.label.includes('12 '), 'The visible total must include every source page')
  }
  assert.equal(report.reports.length, 16)
  await promisify(execFile)(electron, [root, '--fast-print-request', report.request], {
    cwd: root,
    windowsHide: true,
    timeout: 120000,
    env: {
      ...env,
      PRINTER_ACCOUNT_MODE: 'local-test',
      FAST_PRINT_VERIFY_DIR: join(folder, 'worker')
    }
  })
  const driver = JSON.parse(await readFile(join(folder, 'worker/driver-settings.json'), 'utf8'))
  const expectedOutput = report.reports.find((item) => item.per === 4 && item.copies === 3).simplex
  assert.equal(
    driver.sheets,
    expectedOutput.Pages,
    'The displayed output count must match actual composed pages'
  )
  assert.equal(driver.copies, expectedOutput.Copies)
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
    counts: report.counts,
    changedCounts: report.changedCounts,
    checks: report.reports.length,
    headless: true
  })
  console.log(
    language +
      ': per-file/selection pages, all n-up presets, copies, duplex boundaries, edited/missing PDF and layout sizes passed.'
  )
}
await writeFile(join(output, 'results.json'), JSON.stringify({ hardwareJobs: 0, reports }, null, 2))
