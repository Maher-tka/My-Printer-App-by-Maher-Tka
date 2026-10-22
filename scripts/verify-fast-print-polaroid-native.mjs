import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { polaroidLayout } from '../src/shared/fast-print-polaroid.ts'

// Hidden native forms and production renderers; every driver call is ValidateOnly.
const root = resolve(import.meta.dirname, '..')
const output = resolve(
  process.env.POLAROID_TEST_OUTPUT || join(root, 'output/fast-print-polaroid-native')
)
const source = process.env.POLAROID_TEST_SOURCE || 'C:/Users/Maher/Downloads/Compressed/num216p'
const executable = process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint.exe')
const printerName = process.env.POLAROID_TEST_PRINTER || 'Microsoft Print to PDF'
const require = createRequire(import.meta.url)
const electron = require('electron')
const files = (await readdir(source))
  .filter((name) => /\.(jpe?g|png)$/i.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((name) => join(source, name))
assert.ok(files.length > 9, 'Expected real photos covering multiple sheets in both modes.')
const hash = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
const originals = await Promise.all(files.map(hash))
const environment = {
  ...process.env,
  FAST_PRINT_NONINTERACTIVE: '1',
  FAST_PRINT_TEST_SETTINGS: join(output, 'settings')
}
// Explorer previews must work without a test/development access override.
delete environment.PRINTER_ACCOUNT_MODE
delete environment.ELECTRON_RUN_AS_NODE
delete environment.ELECTRON_RENDERER_URL
await mkdir(output, { recursive: true })
const accessBootstrap = join(output, 'signed-out-worker.cjs')
const signedOutData = await mkdtemp(join(output, 'signed-out-account-'))
await writeFile(
  accessBootstrap,
  `const { app } = require('electron');
app.setPath('userData', ${JSON.stringify(signedOutData)});
app.setAppPath(${JSON.stringify(root)});
import(${JSON.stringify(pathToFileURL(join(root, 'out/main/index.js')).href)}).catch(error => { console.error(error.message); app.exit(1); });
`
)
const run = (exe, args, env = environment) =>
  new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    let logs = ''
    child.stdout.on('data', (chunk) => (logs += chunk))
    child.stderr.on('data', (chunk) => (logs += chunk))
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Polaroid verification timed out. ' + logs))
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
const reports = []
let productionGateVerified = false
const selections = [
  ['all-photos', files, 'en', 'dark'],
  ['eight-one-sheet', files.slice(0, 8), 'fr', 'light'],
  ['nine-one-sheet', files.slice(0, 9), 'ar', 'light']
]
for (const [name, selection, language, appearance] of process.env.POLAROID_TEST_ALL_ONLY === '1'
  ? selections.slice(0, 1)
  : selections) {
  const folder = join(output, name)
  await mkdir(folder, { recursive: true })
  await rm(join(folder, 'error.txt'), { force: true })
  const manifest = join(folder, 'selection.json')
  await writeFile(manifest, JSON.stringify({ version: 1, files: selection }))
  await run(executable, [
    '--app',
    electron,
    '--app-path',
    root,
    '--verify-polaroid',
    folder,
    '--language',
    language,
    '--appearance',
    appearance,
    '--preset',
    Buffer.from(
      JSON.stringify({
        printer: printerName,
        paper: 'A4',
        color: true,
        pagesPerSheet: 1
      })
    ).toString('base64'),
    '--batch',
    manifest
  ])
  let error
  try {
    error = await readFile(join(folder, 'error.txt'), 'utf8')
  } catch {}
  assert.ok(!error, error)
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(result.headless, true)
  assert.equal(result.preparations, 2)
  for (const item of result.cases) {
    const capacity = item.mode === 'polaroid-8' ? 8 : 9
    const layout = polaroidLayout(item.mode)
    assert.equal(item.files, selection.length)
    assert.equal(item.previewDriverSnapshots, 0, 'Preview must not access vendor driver snapshots.')
    assert.ok(item.progressEvents >= selection.length, 'Every photo needs preparation feedback.')
    assert.equal(item.sheets, Math.ceil(selection.length / capacity))
    assert.equal(item.selectedFileSheet, Math.ceil(selection.length / capacity))
    const worker = join(folder, item.mode, 'worker')
    if (!productionGateVerified) {
      await assert.rejects(
        run(electron, [accessBootstrap, '--fast-print-request', item.request], {
          ...environment,
          FAST_PRINT_VERIFY_DIR: join(folder, 'signed-out-print'),
          PRINTER_SUPABASE_URL: '',
          PRINTER_SUPABASE_PUBLISHABLE_KEY: ''
        }),
        /Request access|Sign in|Online accounts are not configured/,
        'A production build must still deny printing without an authorized account.'
      )
      await assert.rejects(readFile(join(folder, 'signed-out-print', 'job.json')))
      productionGateVerified = true
    }
    const logs = await run(electron, [root, '--fast-print-request', item.request], {
      ...environment,
      // Only the generated-print proof uses the explicit offline fixture mode.
      PRINTER_ACCOUNT_MODE: 'local-test',
      FAST_PRINT_VERIFY_DIR: worker
    })
    await writeFile(join(folder, item.mode, 'worker.log'), logs)
    const driver = JSON.parse(await readFile(join(worker, 'driver-settings.json'), 'utf8'))
    assert.equal(driver.sheets, item.sheets)
    assert.equal(driver.printer, printerName)
    assert.equal(driver.paper, 'A4')
    assert.equal(driver.color, true)
    assert.equal(driver.landscape, capacity === 8)
    assert.equal(driver.duplex, 'Simplex')
    assert.match(logs, /\[polaroid-reviewed\]/, 'Print must reuse reviewed sheets.')
    assert.ok(!logs.includes('[polaroid-photo]'), 'Printing re-ran photo analysis.')
    const framing = (await readFile(join(folder, item.mode, 'framing.log'), 'utf8'))
      .split(/\r?\n/)
      .filter((line) => line.startsWith('[polaroid-photo] '))
      .map((line) => JSON.parse(line.slice('[polaroid-photo] '.length)))
    assert.equal(framing.length, selection.length, 'Print did not include every selected photo.')
    const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
    const photoErrors = []
    for (let index = 0; index < selection.length; index++) {
      const photo = layout.photos[index % capacity],
        frame = framing[index],
        crop = frame.crop
      if (frame.fit === 'cover')
        for (const face of frame.faceBoxes)
          assert.ok(
            face.x >= crop.x - 0.001 &&
              face.y >= crop.y - 0.001 &&
              face.x + face.width <= crop.x + crop.width + 0.001 &&
              face.y + face.height <= crop.y + crop.height + 0.001,
            'A detected face was clipped.'
          )
      const oriented = await sharp(selection[index])
        .rotate(frame.turns * 90)
        .png()
        .toBuffer()
      const meta = await sharp(oriented).metadata(),
        left = Math.max(0, Math.floor(crop.x * meta.width)),
        top = Math.max(0, Math.floor(crop.y * meta.height))
      const cropped = await sharp(oriented)
        .extract({
          left,
          top,
          width: Math.min(meta.width - left, Math.round(crop.width * meta.width)),
          height: Math.min(meta.height - top, Math.round(crop.height * meta.height))
        })
        .png()
        .toBuffer()
      const expectedCrop = await sharp(cropped)
        .flatten({ background: '#fff' })
        .resize(Math.round(photo.width), Math.round(photo.height), {
          fit: frame.fit,
          background: '#fff',
          position: 'centre'
        })
        .png()
        .toBuffer()
      const expected = await sharp(expectedCrop)
        .resize(64, 80, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer()
      const actual = await sharp(job.sheets[Math.floor(index / capacity)])
        .extract({
          left: Math.round(photo.x),
          top: Math.round(photo.y),
          width: Math.round(photo.width),
          height: Math.round(photo.height)
        })
        .resize(64, 80, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer()
      let difference = 0
      for (let pixel = 0; pixel < actual.length; pixel++)
        difference += Math.abs(actual[pixel] - expected[pixel])
      photoErrors.push(difference / actual.length)
      assert.ok(photoErrors.at(-1) < 22, 'A photo was missing, out of order or framed incorrectly.')
    }
    const occupied = selection.length % capacity || capacity
    for (const photo of layout.photos.slice(occupied)) {
      const blank = await sharp(job.sheets.at(-1))
        .extract({
          left: Math.ceil(photo.x + 2),
          top: Math.ceil(photo.y + 2),
          width: Math.floor(photo.width - 4),
          height: Math.floor(photo.height - 4)
        })
        .png()
        .toBuffer()
      assert.ok(
        (await sharp(blank).stats()).channels.slice(0, 3).every((channel) => channel.min === 255),
        'A final empty slot contains artwork.'
      )
    }
    for (let index = 0; index < item.sheets; index++) {
      const proof = join(worker, String(index + 1).padStart(5, '0') + '.png')
      assert.equal(
        await hash(join(folder, item.mode, 'sheet-' + (index + 1) + '.png')),
        await hash(proof),
        'Preview preparation differs from actual print artwork.'
      )
      const preview = await sharp(join(folder, item.mode, 'preview-' + (index + 1) + '.png'))
        .resize(160, 160, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer()
      const actual = await sharp(proof)
        .resize(160, 160, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer()
      let difference = 0
      for (let pixel = 0; pixel < actual.length; pixel++)
        difference += Math.abs(actual[pixel] - preview[pixel])
      assert.ok(
        difference / actual.length < 5,
        'Displayed native preview differs from the print sheet.'
      )
    }
    const screen = join(folder, item.mode, 'native-1366x768.png')
    const stage = await sharp(screen)
      .extract({ left: 300, top: 280, width: 650, height: 250 })
      .png()
      .toBuffer()
    assert.ok(
      (await sharp(stage).stats()).channels.slice(0, 3).some((channel) => channel.stdev > 15),
      'The hidden UI snapshot did not capture its sheet preview.'
    )
    await writeFile(
      join(folder, item.mode, 'proof-check.json'),
      JSON.stringify({
        allPhotosMatched: true,
        photoErrors,
        blankSlotsWhite: true,
        previewEqualsPrint: true
      })
    )
    console.log(
      name,
      item.mode,
      selection.length,
      'photos /',
      item.sheets,
      'sheets: preview and print artwork match exactly'
    )
  }
  for (const directory of result.cleanupDirectories) {
    assert.match(directory, /maher-fast-print-native[\\/][a-f0-9]{32}$/)
    await rm(directory, { recursive: true, force: true })
  }
  reports.push({
    name,
    files: selection.length,
    headless: true,
    singleCore: result.singleCore,
    cachedSwitchMs: result.cachedSwitchMs,
    cases: result.cases.map(({ request, ...item }) => item)
  })
}
assert.deepEqual(await Promise.all(files.map(hash)), originals, 'Original photos changed.')
await writeFile(
  join(output, 'results.json'),
  JSON.stringify(
    {
      reports,
      previewsWithoutAccessOverride: true,
      productionGateVerified,
      originalsUnchanged: true,
      hardwareJobs: 0
    },
    null,
    2
  )
)
console.log(
  'Native Polaroid selection, single-sheet layout, overflow, cached previews and matching production output passed. No desktop input or hardware jobs.'
)
