import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'

// Hidden native previews and validate-only output; no hardware print jobs.
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-brightness', randomUUID())
const native = process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-ui-match.exe')
const electron = createRequire(import.meta.url)('electron')
const run = promisify(execFile)
await mkdir(output, { recursive: true })
const image = join(output, 'source.png')
await sharp({ create: { width: 600, height: 800, channels: 3, background: '#806c54' } })
  .png()
  .toFile(image)
const pdf = join(output, 'source.pdf')
const doc = await PDFDocument.create()
doc
  .addPage([450, 600])
  .drawRectangle({ x: 0, y: 0, width: 450, height: 600, color: rgb(0.5, 0.42, 0.33) })
await writeFile(pdf, await doc.save())
const hash = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex')
for (const [name, source, mono] of [
  ['image', image],
  ['pdf', pdf],
  ['monochrome', image, true]
]) {
  const before = await hash(source)
  const folder = join(output, name)
  await mkdir(folder, { recursive: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_BRIGHTNESS: '1',
    FAST_PRINT_VERIFY_MONO: mono ? '1' : '0',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings'),
    FAST_PRINT_NONINTERACTIVE: '1'
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await run(
    native,
    [
      '--verify-audit',
      folder,
      '--language',
      'en',
      '--preset',
      Buffer.from(
        JSON.stringify({
          printer: 'Microsoft Print to PDF',
          paper: 'A4',
          color: true,
          pagesPerSheet: 1
        })
      ).toString('base64'),
      '--',
      source
    ],
    { cwd: root, env, windowsHide: true, timeout: 120000 }
  )
  assert.equal(await readFile(join(folder, 'error.txt'), 'utf8').catch(() => ''), '')
  const report = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(report.headless, true)
  const brightness = []
  for (const item of report.cases) {
    const request = JSON.parse(await readFile(item.request, 'utf8'))
    assert.equal(request.preset.brightnessPercent, item.level)
    const worker = join(folder, 'worker-' + item.level)
    await run(electron, [root, '--fast-print-request', item.request], {
      cwd: root,
      env: { ...env, PRINTER_ACCOUNT_MODE: 'local-test', FAST_PRINT_VERIFY_DIR: worker },
      windowsHide: true,
      timeout: 120000
    })
    const job = JSON.parse(await readFile(join(worker, 'job.json'), 'utf8'))
    const pixels = async (file) =>
      sharp(file).resize(160, 220, { fit: 'fill' }).removeAlpha().raw().toBuffer()
    const expected = await pixels(item.proof)
    const actual = await pixels(job.sheets[0])
    const difference =
      actual.reduce((sum, value, i) => sum + Math.abs(value - expected[i]), 0) / actual.length
    assert.ok(difference < 8, `${name} ${item.level}% preview/output difference ${difference}`)
    const center = await sharp(job.sheets[0])
      .resize(100, 100)
      .extract({ left: 45, top: 45, width: 10, height: 10 })
      .removeAlpha()
      .stats()
    brightness.push(center.channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0))
  }
  assert.ok(
    brightness[0] < brightness[1] && brightness[1] < brightness[2],
    `${name} output brightness did not change`
  )
  assert.equal(await hash(source), before, 'Original source changed')
  console.log(`${name}: −15%, 0%, +15% output matches preview; original unchanged`)
}
