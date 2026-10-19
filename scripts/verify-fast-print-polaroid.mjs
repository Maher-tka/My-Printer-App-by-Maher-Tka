import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Real renderer + Windows driver validation. Never submits a hardware print job.
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'tmp', 'fast-print-polaroid-proof')
await mkdir(output, { recursive: true })
async function fixture(name, first, count) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  for (let index = first; index < first + count; index++) {
    const page = pdf.addPage([300, 400])
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      color: rgb(0.1 + index * 0.05, 0.35, 0.75)
    })
    page.drawCircle({ x: 150, y: 200, size: 70, borderColor: rgb(1, 1, 1), borderWidth: 4 })
    page.drawText(String(index + 1), { x: 118, y: 180, size: 48, font, color: rgb(1, 1, 1) })
  }
  const path = join(output, name)
  await writeFile(path, await pdf.save())
  return path
}
const all = await fixture('ten-photos.pdf', 0, 10)
const first = await fixture('first-four.pdf', 0, 4)
const last = await fixture('next-six.pdf', 4, 6)
const require = createRequire(import.meta.url)
for (const [mode, files] of [
  ['polaroid-8', [all]],
  ['polaroid-9', [first, last]]
]) {
  const folder = join(output, mode)
  const preset = {
    printer: 'Microsoft Print to PDF',
    paper: 'A4',
    color: true,
    pagesPerSheet: 1,
    mode
  }
  const token = Buffer.from(JSON.stringify(preset)).toString('base64')
  const env = { ...process.env, FAST_PRINT_NONINTERACTIVE: '1', FAST_PRINT_VERIFY_DIR: folder }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await new Promise((fulfill, reject) => {
    const child = spawn(require('electron'), [root, '--fast-print', token, '--', ...files], {
      cwd: root,
      env,
      stdio: 'inherit',
      windowsHide: true
    })
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Polaroid verification timed out.'))
    }, 90000)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      code === 0 ? fulfill() : reject(new Error(`Worker exited with ${code}`))
    })
  })
  const settings = JSON.parse(await readFile(join(folder, 'driver-settings.json'), 'utf8'))
  assert.equal(settings.paper, 'A4')
  assert.equal(settings.color, true)
  assert.equal(settings.landscape, mode === 'polaroid-8')
  assert.equal(settings.sheets, 2)
  assert.equal(JSON.parse(await readFile(join(folder, 'job.json'), 'utf8')).preset.duplex, false)
  console.log('Verified Polaroid:', settings)
}
console.log(`Polaroid proof sheets: ${output}`)
