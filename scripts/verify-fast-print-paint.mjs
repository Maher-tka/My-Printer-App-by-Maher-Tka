import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'

// Paint only our own hidden controls; no mouse, keyboard, printers or visible windows.
const root = resolve(import.meta.dirname, '..'),
  output = join(root, 'output/fast-print-paint')
const executable = process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint.exe')
await mkdir(output, { recursive: true })
const fixture = join(output, 'preview.png')
await sharp({ create: { width: 720, height: 480, channels: 3, background: '#427db5' } })
  .png()
  .toFile(fixture)
const reports = []
for (const language of ['en', 'fr', 'ar']) {
  const folder = join(output, language)
  await mkdir(folder, { recursive: true })
  await rm(join(folder, 'error.txt'), { force: true })
  await new Promise((resolve, reject) => {
    const child = spawn(
      executable,
      ['--verify-paint', folder, '--language', language, '--', fixture],
      { cwd: root, windowsHide: true, stdio: 'ignore' }
    )
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Hidden paint check timed out.'))
    }, 60000)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve() : reject(new Error('Native paint verification exited ' + code))
    })
  })
  let error
  try {
    error = await readFile(join(folder, 'error.txt'), 'utf8')
  } catch {}
  assert.ok(!error, error)
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(result.headless, true)
  for (const report of result.reports) {
    assert.equal(report.frames, 160)
    assert.equal(report.legacyCornerPixels, 0)
    assert.equal(report.blankPreviewReplacements, 0)
    assert.ok(report.gdiDelta <= 4)
    assert.ok(report.selectionInvalidations <= 2)
    for (const [width, height] of [
      [1366, 768],
      [1920, 1080],
      [1600, 900],
      [820, 640]
    ]) {
      const file = join(folder, report.theme + '-' + width + 'x' + height + '.png'),
        metadata = await sharp(file).metadata()
      assert.equal(metadata.width, width)
      assert.equal(metadata.height, height)
    }
  }
  const cleanup = resolve(result.cleanupDirectory)
  assert.equal(
    dirname(cleanup).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(basename(cleanup), /^[a-f0-9]{32}$/)
  await rm(cleanup, { recursive: true, force: true })
  reports.push({ language, ...result, cleanupDirectory: undefined })
  console.log(language, JSON.stringify(result.reports))
}
await writeFile(
  join(output, 'results.json'),
  JSON.stringify({ headless: true, hardwareJobs: 0, reports }, null, 2)
)
console.log(
  'Single-pass control rendering, rounded corners, repaint-region validation, GDI resources and retained loading previews passed.'
)
