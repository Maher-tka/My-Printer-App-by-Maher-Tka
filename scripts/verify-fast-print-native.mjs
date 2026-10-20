import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { deflateRawSync } from 'node:zlib'
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import sharp from 'sharp'

// Actual native windows and encrypted driver handoff. The worker runs ValidateOnly.
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-native-verification')
const executable = join(root, 'out/native/FastPrint.exe')
const require = createRequire(import.meta.url)
const settings = join(output, 'settings')
await mkdir(join(settings, 'profiles'), { recursive: true })
const environment = { ...process.env, FAST_PRINT_TEST_SETTINGS: settings }
delete environment.ELECTRON_RUN_AS_NODE
delete environment.ELECTRON_RENDERER_URL
const run = (exe, args, env = environment) =>
  new Promise((fulfill, reject) => {
    const child = spawn(exe, args, { cwd: root, env, stdio: 'inherit', windowsHide: true })
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Native verification timed out.'))
    }, 120000)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      code === 0 ? fulfill() : reject(new Error('Worker exited ' + code))
    })
  })
const hash = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
const base = { printer: 'Microsoft Print to PDF', paper: 'A4', color: true, pagesPerSheet: 1 }
async function nativeCase(name, files, language = 'en', initial = base, appearance = 'dark') {
  const folder = join(output, name)
  await mkdir(folder, { recursive: true })
  for (const file of ['error.txt', 'result.json']) await rm(join(folder, file), { force: true })
  const before = await Promise.all(files.map(hash))
  const selection = join(folder, 'selection.json')
  await writeFile(selection, JSON.stringify({ version: 1, files }))
  await run(executable, [
    '--verify',
    folder,
    '--language',
    language,
    '--appearance',
    appearance,
    '--preset',
    Buffer.from(JSON.stringify(initial)).toString('base64'),
    '--batch',
    selection
  ])
  let failure
  try {
    failure = await readFile(join(folder, 'error.txt'), 'utf8')
  } catch {}
  assert.ok(!failure, failure)
  const result = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(result.nativeOnly, true)
  assert.equal(result.defaultsUnchanged, true)
  assert.equal(result.currentOptionsPreserved, true)
  assert.ok(result.firstPaintMs < 3000, 'Native window startup exceeded three seconds')
  assert.deepEqual(await Promise.all(files.map(hash)), before, 'Original documents changed')
  console.log(name, {
    firstPaintMs: result.firstPaintMs,
    previewReadyMs: result.previewReadyMs,
    pages: result.pages
  })
  return result
}
async function workerCase(
  name,
  result,
  sheets,
  paper = 'A4',
  proof = join(output, name, 'fill-frame.png')
) {
  const folder = join(output, name, 'worker')
  const env = {
    ...environment,
    PRINTER_ACCOUNT_MODE: 'local-test',
    FAST_PRINT_NONINTERACTIVE: '1',
    FAST_PRINT_VERIFY_DIR: folder
  }
  await run(require('electron'), [root, '--fast-print-request', result.request], env)
  const driver = JSON.parse(await readFile(join(folder, 'driver-settings.json'), 'utf8'))
  const job = JSON.parse(await readFile(join(folder, 'job.json'), 'utf8'))
  assert.equal(driver.sheets, sheets)
  assert.equal(driver.copies, 3)
  assert.equal(driver.paper, paper)
  assert.equal(job.preset.fitToFrame, true)
  assert.equal(driver.profileId, job.preset.profileId)
  const expected = await sharp(proof).resize(100, 142).removeAlpha().raw().toBuffer()
  const actual = await sharp(join(folder, '00001.png'))
    .resize(100, 142)
    .removeAlpha()
    .raw()
    .toBuffer()
  let difference = 0
  for (let index = 0; index < expected.length; index++)
    difference += Math.abs(expected[index] - actual[index])
  assert.ok(difference / expected.length < 8, 'Native preview differs from the worker output')
  let removed = false
  try {
    await stat(dirname(result.request))
  } catch {
    removed = true
  }
  assert.equal(removed, true, 'Native session was not cleaned up')
  return driver
}
// Small self-contained OpenXML fixture; no Office SDK is needed to run this check.
function docxFixture() {
  const files = {
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':
      '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>Fast Print Word preview</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblBorders><w:top w:val="single"/><w:bottom w:val="single"/><w:left w:val="single"/><w:right w:val="single"/><w:insideH w:val="single"/><w:insideV w:val="single"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>Table alignment</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Preserve formatting</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:r><w:t>Page 2: DOCX pagination</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:bottom="1440" w:left="1440" w:right="1440"/></w:sectPr></w:body></w:document>'
  }
  const local = [],
    directory = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const bytes = Buffer.from(text),
      packed = deflateRawSync(bytes),
      filename = Buffer.from(name)
    let crc = 0xffffffff
    for (const byte of bytes) {
      crc ^= byte
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    crc = (crc ^ 0xffffffff) >>> 0
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(8, 8)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(packed.length, 18)
    header.writeUInt32LE(bytes.length, 22)
    header.writeUInt16LE(filename.length, 26)
    local.push(header, filename, packed)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(packed.length, 20)
    entry.writeUInt32LE(bytes.length, 24)
    entry.writeUInt16LE(filename.length, 28)
    entry.writeUInt32LE(offset, 42)
    directory.push(entry, filename)
    offset += header.length + filename.length + packed.length
  }
  const central = Buffer.concat(directory),
    end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(3, 8)
  end.writeUInt16LE(3, 10)
  end.writeUInt32LE(central.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, central, end])
}

const pdf = await PDFDocument.create(),
  font = await pdf.embedFont(StandardFonts.HelveticaBold)
for (let i = 0; i < 5; i++) {
  const page = pdf.addPage(i === 2 ? [841.89, 595.276] : [595.276, 841.89])
  page.drawRectangle({
    x: 24,
    y: 24,
    width: page.getWidth() - 48,
    height: page.getHeight() - 48,
    color: rgb(0.15, 0.35 + i * 0.08, 0.7)
  })
  page.drawText('PAGE ' + (i + 1), { x: 110, y: 400, size: 58, font, color: rgb(1, 1, 1) })
}
const pdfFile = join(output, 'five pages & layout.pdf')
await writeFile(pdfFile, await pdf.save())
const imageFile = join(output, 'landscape.png')
await sharp({ create: { width: 900, height: 500, channels: 3, background: '#427db5' } })
  .png()
  .toFile(imageFile)
const wordFile = join(output, 'Word document & table.docx')
await writeFile(wordFile, docxFixture())
const english = await nativeCase('english', [pdfFile])
assert.equal(english.pages, 5)
const request = JSON.parse(await readFile(english.request, 'utf8'))
const profile = JSON.parse(
  await readFile(join(dirname(english.request), request.preset.profileId + '.json'), 'utf8')
)
const stockId = 'a'.repeat(32),
  assignedId = 'b'.repeat(32)
for (const [id, name, bypass] of [
  [stockId, 'Saved bypass & paper', true],
  [assignedId, 'Assigned four-up stock', false]
])
  await writeFile(
    join(settings, 'profiles', id + '.json'),
    JSON.stringify({
      ...profile,
      id,
      name,
      defaultBypassFaceUp: bypass,
      savedAt: new Date().toISOString()
    })
  )
await writeFile(
  join(settings, 'preferences.json'),
  JSON.stringify({
    version: 1,
    defaultPrinter: base.printer,
    optionPrinters: {},
    profiles: { [base.printer]: { 'fast:A4:color:4': assignedId } }
  })
)
const french = await nativeCase('french-presets', [pdfFile], 'fr')
assert.equal(french.assignments['1'], stockId)
assert.equal(french.assignments['4'], assignedId)
const arabic = await nativeCase('arabic-explicit-preset', [pdfFile], 'ar', {
  ...base,
  profileId: stockId
})
assert.equal(arabic.assignments['4'], stockId)
const mixed = await nativeCase('mixed-images-and-pdf', [pdfFile, imageFile])
const results = { english, french, arabic, mixed, drivers: {} }
const longPdf = await PDFDocument.create()
const longFont = await longPdf.embedFont(StandardFonts.HelveticaBold)
for (let index = 0; index < 19; index++) {
  const page = longPdf.addPage(index % 3 === 2 ? [841.89, 595.276] : [595.276, 841.89])
  page.drawRectangle({
    x: 12,
    y: 12,
    width: page.getWidth() - 24,
    height: page.getHeight() - 24,
    color: rgb(0.12 + index * 0.03, 0.3 + (index % 6) * 0.08, 0.7)
  })
  page.drawText('PAGE ' + (index + 1), {
    x: 100,
    y: 400,
    size: 58,
    font: longFont,
    color: rgb(1, 1, 1)
  })
}
const longPdfFile = join(output, 'nineteen pages.pdf')
await writeFile(longPdfFile, await longPdf.save())
// Every native grid is rendered through the real print worker on both paper sizes.
results.layouts = []
const layouts = JSON.parse(await readFile(join(root, 'src/shared/fast-print-layouts.json'), 'utf8'))
for (const paper of ['A4', 'A3']) {
  const name = 'layouts-' + paper
  const matrix = await nativeCase(
    name,
    [longPdfFile],
    'en',
    { ...base, paper },
    paper === 'A4' ? 'light' : 'dark'
  )
  assert.equal(matrix.pages, 19)
  const source = JSON.parse(await readFile(matrix.request, 'utf8'))
  const profileFile = source.preset.profileId + '.json'
  const profileBytes = await readFile(join(dirname(matrix.request), profileFile))
  for (const layout of layouts) {
    const session = join(tmpdir(), 'maher-fast-print-native', randomUUID().replaceAll('-', ''))
    await mkdir(session, { recursive: true })
    await writeFile(join(session, profileFile), profileBytes)
    const requestFile = join(session, 'request.json')
    await writeFile(
      requestFile,
      JSON.stringify({
        ...source,
        preset: { ...source.preset, pagesPerSheet: layout.count, landscape: layout.landscape }
      })
    )
    const driver = await workerCase(
      name + '-' + layout.count,
      { request: requestFile },
      Math.ceil(19 / layout.count),
      paper,
      join(output, name, 'fit-' + layout.count + '.png')
    )
    assert.equal(driver.landscape, layout.landscape)
    results.layouts.push({ paper, count: layout.count, sheets: driver.sheets })
    console.log('Worker layout passed', paper, layout.count)
  }
  await rm(dirname(matrix.request), { recursive: true, force: true })
}
// Consecutive images fill shared sheets; a PDF starts a separate document group.
const photos = []
for (let index = 0; index < 13; index++) {
  const file = join(output, 'photo-' + String(index + 1).padStart(2, '0') + '.png')
  await sharp({
    create: {
      width: 600,
      height: 400,
      channels: 3,
      background: { r: 30 + index * 14, g: 65 + index * 7, b: 210 - index * 11 }
    }
  })
    .png()
    .toFile(file)
  photos.push(file)
}
const photoGroup = await nativeCase('thirteen-images', photos)
assert.equal(photoGroup.pages, 13)
results.drivers.photos = await workerCase('thirteen-images', photoGroup, 4)
const photoJob = JSON.parse(await readFile(join(output, 'thirteen-images/worker/job.json'), 'utf8'))
for (let index = 0; index < 16; index++) {
  const slot = index % 4
  const sheet = photoJob.sheets[Math.floor(index / 4)]
  const { width, height } = await sharp(sheet).metadata()
  const actual = await sharp(sheet)
    .extract({
      left: Math.round(width * (slot % 2 === 0 ? 0.25 : 0.75)),
      top: Math.round(height * (slot < 2 ? 0.25 : 0.75)),
      width: 1,
      height: 1
    })
    .removeAlpha()
    .raw()
    .toBuffer()
  const expected =
    index < 13 ? [30 + index * 14, 65 + index * 7, 210 - index * 11] : [255, 255, 255]
  for (let channel = 0; channel < 3; channel++)
    assert.ok(
      Math.abs(actual[channel] - expected[channel]) < 3,
      'Photo order or blank final slot differs at ' + index
    )
}
const boundary = await nativeCase('images-pdf-images', [
  ...photos.slice(0, 2),
  pdfFile,
  ...photos.slice(2)
])
results.drivers.boundary = await workerCase('images-pdf-images', boundary, 6)
results.drivers.pdf = await workerCase('english', english, 2)
results.drivers.mixed = await workerCase('mixed-images-and-pdf', mixed, 3)
if (process.env.FAST_PRINT_SOFFICE || english.docxConverter !== 'Unavailable') {
  const word = await nativeCase('docx', [wordFile])
  assert.equal(word.pages, 2)
  results.word = word
  results.drivers.word = await workerCase('docx', word, 1)
} else
  results.word = { pending: 'Install Microsoft Word or LibreOffice to exercise DOCX conversion.' }
assert.ok((await stat(executable)).size < 1024 * 1024)
await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2))
console.log(
  'Native print UI, startup, PDF/image preview, preset precedence, copies, driver handoff and source preservation passed. No hardware jobs submitted.'
)
