import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { build } from 'esbuild'
import { PDFDocument, PDFName, PDFRawStream, degrees, rgb } from 'pdf-lib'
import sharp from 'sharp'
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas'

// Capture before editing with --capture-baseline, then run again after editing.
// Native comparison also needs FastPrint-audit-before/after.exe, built with the
// same VerifyPerformance harness. All checks run hidden and send no print jobs.
const root = resolve(import.meta.dirname, '..')
process.chdir(root)
const output = join(root, 'output/performance-audit')
const capture = process.argv.includes('--capture-baseline')
const phase = capture ? 'before' : 'after'
const run = promisify(execFile)
await mkdir(join(output, phase), { recursive: true })
for (const [name, entry] of Object.entries({
  card: 'src/renderer/src/tools/card-montage/lib/exportPdf.ts',
  groups: 'src/renderer/src/tools/cutter-montage/lib/productionSheetGroups.ts'
})) {
  await build({
    entryPoints: [join(root, entry)],
    outfile: join(output, phase, `${name}.mjs`),
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    tsconfig: join(root, 'tsconfig.web.json')
  })
}

const graph = await build({
  entryPoints: [join(root, 'src/renderer/src/app/App.tsx')],
  bundle: true,
  write: false,
  metafile: true,
  format: 'esm',
  platform: 'browser',
  packages: 'external',
  tsconfig: join(root, 'tsconfig.web.json'),
  loader: {
    '.ttf': 'dataurl',
    '.wasm': 'dataurl',
    '.gz': 'dataurl',
    '.onnx': 'dataurl',
    '.css': 'text'
  },
  logLevel: 'silent'
})
const seen = new Set(),
  external = new Set()
function walk(key) {
  if (seen.has(key)) return
  seen.add(key)
  for (const dependency of graph.metafile.inputs[key]?.imports ?? []) {
    if (dependency.kind === 'dynamic-import') continue
    if (dependency.external) external.add(dependency.path)
    else walk(dependency.path)
  }
}
walk('src/renderer/src/app/App.tsx')
const startup = {
  bytes: [...seen].reduce((total, key) => total + (graph.metafile.inputs[key]?.bytes ?? 0), 0),
  files: [...seen],
  external: [...external]
}
await writeFile(join(output, `startup-${phase}.json`), JSON.stringify(startup, null, 2))
if (capture) {
  console.log('Baseline captured. Re-run without --capture-baseline after applying changes.')
  process.exit(0)
}

const implementations = {}
for (const name of ['before', 'after']) {
  implementations[name] = {
    card: await import(pathToFileURL(join(output, name, 'card.mjs'))),
    groups: await import(pathToFileURL(join(output, name, 'groups.mjs')))
  }
}
async function measure(task, samples = 5) {
  await task()
  const times = []
  let result
  for (let index = 0; index < samples; index++) {
    const start = performance.now()
    result = await task()
    times.push(performance.now() - start)
  }
  return { result, medianMs: times.sort((a, b) => a - b)[Math.floor(times.length / 2)], samples }
}

// Exercise sparse sheets, fixed/trimmed lengths, production bounds and old projects
// without sheetIndex. Output grouping must stay exactly equivalent.
function cutterFixture(count, sheets) {
  return {
    sheet: {
      heightCm: 100,
      safeMarginCm: 0.5,
      lengthMode: 'auto-trim-last',
      autoExpandHeight: true
    },
    placedPieces: Array.from({ length: count }, (_, index) => ({
      id: `placement-${index}`,
      presetId: `art-${index % 3}`,
      sheetIndex: index % sheets,
      xCm: (index % 8) * 5,
      yCm: (index % 18) * 5,
      widthCm: 4,
      heightCm: 4,
      rotation: index % 2 ? 90 : 0,
      ...(index % 7 === 0
        ? { productionBoundsCm: { xCm: 1, yCm: 2, widthCm: 5, heightCm: 6 } }
        : {})
    }))
  }
}
for (const count of [0, 1, 31, 600]) {
  for (const lengthMode of ['fixed', 'auto-trim-last']) {
    const project = cutterFixture(count, 19)
    project.sheet.lengthMode = lengthMode
    if (count > 1) project.placedPieces[1].sheetIndex = undefined
    assert.deepEqual(
      implementations.after.groups.getProductionSheetLayoutGroups(project),
      implementations.before.groups.getProductionSheetLayoutGroups(project)
    )
  }
}
const largeJob = cutterFixture(20000, 500)
const groups = {}
for (const name of ['before', 'after']) {
  const { result, ...timing } = await measure(() =>
    implementations[name].groups.getProductionSheetLayoutGroups(largeJob)
  )
  groups[name] = {
    ...timing,
    layouts: result.length,
    copies: result.reduce((sum, group) => sum + group.totalCopies, 0)
  }
}
assert.deepEqual(
  implementations.after.groups.getProductionSheetLayoutGroups(largeJob),
  implementations.before.groups.getProductionSheetLayoutGroups(largeJob)
)

// A customer PDF whose card sides reuse one photo. Copies must share the
// original compressed resource without changing any rendered page.
const pixels = Buffer.alloc(400 * 300 * 3)
for (let index = 0; index < pixels.length; index++)
  pixels[index] = (index * 37 + (index >> 8)) % 256
const jpeg = await sharp(pixels, { raw: { width: 400, height: 300, channels: 3 } })
  .jpeg({ quality: 90 })
  .toBuffer()
const source = await PDFDocument.create()
const photo = await source.embedJpg(jpeg)
for (let index = 0; index < 24; index++) {
  const page = source.addPage([240, 160])
  page.drawImage(photo, { x: 0, y: 0, width: 240, height: 160 })
  page.drawRectangle({ x: index * 2, y: 10, width: 20, height: 35, color: rgb(0.2, 0.5, 0.8) })
  page.setRotation(degrees((index % 4) * 90))
  if (index % 3 === 0) page.setCropBox(5, 5, 230, 150)
}
const input = await source.save()
const artwork = {
  name: 'shared-photo.pdf',
  kind: 'pdf',
  bytesBase64: Buffer.from(input).toString('base64'),
  pageNumber: 1,
  pageCount: 24,
  widthMm: 85,
  heightMm: 55,
  previewDataUrl: ''
}
const { DEFAULT_CARD_SETTINGS } =
  await import('../src/renderer/src/tools/card-montage/types.ts').catch(async () => {
    await build({
      entryPoints: [join(root, 'src/renderer/src/tools/card-montage/types.ts')],
      outfile: join(output, 'card-types.mjs'),
      bundle: true,
      format: 'esm',
      platform: 'node',
      packages: 'external'
    })
    return import(pathToFileURL(join(output, 'card-types.mjs')))
  })
const card = {}
const exported = {}
for (const name of ['before', 'after']) {
  const { result, ...timing } = await measure(
    () =>
      implementations[name].card.exportCardMontagePdf(artwork, {
        ...DEFAULT_CARD_SETTINGS,
        exportAllPdfPages: true
      }),
    3
  )
  exported[name] = result
  await writeFile(join(output, `card-${name}.pdf`), result)
  const pdf = await PDFDocument.load(result)
  const images = pdf.context
    .enumerateIndirectObjects()
    .filter(
      ([, object]) =>
        object instanceof PDFRawStream &&
        object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')
    ).length
  card[name] = { ...timing, bytes: result.length, pages: pdf.getPageCount(), imageObjects: images }
}
assert.equal(card.after.pages, 24)
assert.equal(card.after.imageObjects, 1)
assert.ok(card.after.bytes < card.before.bytes / 3)
globalThis.DOMMatrix ??= DOMMatrix
globalThis.ImageData ??= ImageData
globalThis.Path2D ??= Path2D
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
const documents = {}
for (const name of ['before', 'after'])
  documents[name] = await getDocument({ data: exported[name].slice(), useSystemFonts: false })
    .promise
try {
  for (let index = 1; index <= 24; index++) {
    const images = []
    for (const name of ['before', 'after']) {
      const page = await documents[name].getPage(index)
      const viewport = page.getViewport({ scale: 0.8 })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
      images.push(canvas.toBuffer('image/png'))
      if (index === 1) await writeFile(join(output, `card-proof-${name}.png`), images.at(-1))
      page.cleanup()
    }
    assert.ok(images[0].equals(images[1]), `Card page ${index} changed visually`)
  }
} finally {
  await Promise.all(Object.values(documents).map((document) => document.destroy()))
}

const sourcePath = join(output, 'navigation.pdf')
await writeFile(sourcePath, input)
const native = {}
for (const name of ['before', 'after']) {
  const folder = join(output, `native-${name}`)
  await mkdir(folder, { recursive: true })
  const env = {
    ...process.env,
    FAST_PRINT_VERIFY_PERFORMANCE: '1',
    FAST_PRINT_NONINTERACTIVE: '1',
    FAST_PRINT_TEST_SINGLE_CORE: '1',
    FAST_PRINT_TEST_SETTINGS: join(folder, 'settings')
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await run(
    join(root, `out/native/FastPrint-audit-${name}.exe`),
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
      '--',
      sourcePath
    ],
    { cwd: root, env, windowsHide: true, timeout: 180000 }
  )
  assert.equal(await readFile(join(folder, 'error.txt'), 'utf8').catch(() => ''), '')
  native[name] = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(native[name].headless, true)
  assert.equal(native[name].navigationSheets, 12)
}
const { readdir } = await import('node:fs/promises')
let identicalNativeProofs = 0
for (const file of (await readdir(join(output, 'native-before'))).filter((file) =>
  file.endsWith('.png')
)) {
  const old = await sharp(join(output, 'native-before', file))
    .raw()
    .toBuffer({ resolveWithObject: true })
  const fresh = await sharp(join(output, 'native-after', file))
    .raw()
    .toBuffer({ resolveWithObject: true })
  assert.deepEqual(fresh.info, old.info)
  assert.ok(fresh.data.equals(old.data), `Fast Print proof changed: ${file}`)
  identicalNativeProofs++
}
assert.ok(native.after.navigationRequests < native.before.navigationRequests)
// Delete only the GUID-named temporary sessions owned by these two checks.
const { rm } = await import('node:fs/promises')
for (const report of Object.values(native)) {
  const owned = resolve(report.cleanupDirectory)
  assert.equal(
    dirname(owned).toLowerCase(),
    resolve(tmpdir(), 'maher-fast-print-native').toLowerCase()
  )
  assert.match(owned, /[\\/][a-f0-9]{32}$/)
  await rm(owned, { recursive: true, force: true })
}
const startupBefore = JSON.parse(await readFile(join(output, 'startup-before.json'), 'utf8'))
assert.ok(!startup.files.some((file) => file.includes('cutter-montage/')))
assert.ok(startup.bytes < startupBefore.bytes)
const report = {
  hardwareJobs: 0,
  headless: true,
  startup: {
    beforeSourceBytes: startupBefore.bytes,
    afterSourceBytes: startup.bytes,
    runtimeTimingMeasured: false
  },
  groups,
  card,
  identicalCardPages: 24,
  native,
  identicalNativeProofs
}
await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2))
console.log(
  JSON.stringify(
    {
      startup: report.startup,
      groups,
      card,
      identicalCardPages: 24,
      nativeNavigation: Object.fromEntries(
        Object.entries(native).map(([name, result]) => [
          name,
          {
            requests: result.navigationRequests,
            misses: result.navigationMisses,
            ms: result.navigationMs
          }
        ])
      ),
      identicalNativeProofs
    },
    null,
    2
  )
)
