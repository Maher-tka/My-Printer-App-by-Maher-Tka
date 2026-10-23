import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-performance')
await mkdir(output, { recursive: true })
const files = []
for (let index = 0; index < 6; index++) {
  const width = index % 2 ? 4000 : 6000,
    height = index % 2 ? 6000 : 4000
  const path = join(output, 'large-' + index + '.jpg')
  const svg = `<svg width="${width}" height="${height}"><defs><pattern id="grid" width="65" height="70" patternUnits="userSpaceOnUse"><rect width="65" height="70" fill="hsl(${index * 50},65%,55%)"/><circle cx="32" cy="35" r="25" fill="white"/><path d="M0 0L65 70M65 0L0 70" stroke="black" stroke-width="4"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/><text x="150" y="350" font-size="250">PHOTO ${index} TOP</text></svg>`
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 94 })
    .withMetadata({ orientation: index === 4 ? 6 : 1 })
    .toFile(path)
  files.push(path)
}
const hashes = await Promise.all(
  files.map(async (path) =>
    createHash('sha256')
      .update(await readFile(path))
      .digest('hex')
  )
)
const selection = join(output, 'selection.json')
await writeFile(selection, JSON.stringify({ version: 1, files }))
const results = {}
for (const name of ['Before', 'After']) {
  const folder = join(output, name.toLowerCase())
  await mkdir(folder, { recursive: true })
  await rm(join(folder, 'error.txt'), { force: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_PERFORMANCE: '1',
    FAST_PRINT_NONINTERACTIVE: '1',
    FAST_PRINT_TEST_SINGLE_CORE: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings')
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await new Promise((fulfill, reject) => {
    const child = spawn(
      join(root, 'out/native/FastPrint-Performance-' + name + '.exe'),
      [
        '--verify-audit',
        folder,
        '--language',
        'en',
        '--appearance',
        'dark',
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
    child.stderr.on('data', (chunk) => (log += chunk))
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error('Preview performance check timed out ' + name))
    }, 180000)
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      code === 0 ? fulfill() : reject(new Error('Preview check failed ' + name + ': ' + log))
    })
  })
  let failure
  try {
    failure = await readFile(join(folder, 'error.txt'), 'utf8')
  } catch {}
  assert.ok(!failure, failure)
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(result.headless, true)
  assert.equal(result.states.length, 16)
  const cleanup = resolve(result.cleanupDirectory)
  assert.equal(
    dirname(cleanup).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(cleanup, /[\\/][a-f0-9]{32}$/)
  await rm(cleanup, { recursive: true, force: true })
  results[name.toLowerCase()] = result
  console.log(
    name +
      ': ' +
      JSON.stringify({
        coldMs: result.coldMs,
        maxUiPauseMs: result.maxUiPauseMs,
        photoDecodeOffUi: result.photoDecodeOffUi,
        compositions: result.compositions,
        reuses: result.reuses
      })
  )
}
assert.equal(results.before.photoDecodeOffUi, false)
assert.equal(results.after.photoDecodeOffUi, true)
assert.ok(results.before.states.every((state) => state.compositions === 8))
assert.ok(results.after.states.every((state) => state.compositions === 0))
let identical = 0
for (const name of (await readdir(join(output, 'before'))).filter((name) =>
  name.endsWith('.png')
)) {
  const old = await sharp(join(output, 'before', name))
    .raw()
    .toBuffer({ resolveWithObject: true })
  const fresh = await sharp(join(output, 'after', name))
    .raw()
    .toBuffer({ resolveWithObject: true })
  assert.deepEqual(fresh.info, old.info, 'Preview dimensions changed: ' + name)
  assert.ok(fresh.data.equals(old.data), 'Preview pixels changed: ' + name)
  identical++
}
assert.equal(identical, 19)
assert.deepEqual(
  await Promise.all(
    files.map(async (path) =>
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex')
    )
  ),
  hashes
)
await writeFile(
  join(output, 'results.json'),
  JSON.stringify(
    {
      hardwareJobs: 0,
      singleCore: true,
      identicalPreviews: identical,
      originalsUnchanged: true,
      ...results
    },
    null,
    2
  )
)
console.log(
  'All 19 A4/A3, EXIF, rotation, fit and grayscale previews are pixel-identical. Warm refreshes reuse the retained sheet; photo decoding runs off the UI thread.'
)
