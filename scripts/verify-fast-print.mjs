import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Runs the real worker and driver validation without submitting a printer job.
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'tmp', 'fast-print-proof')
await mkdir(output, { recursive: true })
const document = await PDFDocument.create()
const font = await document.embedFont(StandardFonts.HelveticaBold)
for (let index = 0; index < 5; index++) {
  const page = document.addPage(index === 2 ? [842, 595] : [595, 842])
  page.drawRectangle({
    x: 20,
    y: 20,
    width: page.getWidth() - 40,
    height: page.getHeight() - 40,
    color: rgb(index % 2 ? 0.2 : 0.85, 0.3, index % 2 ? 0.85 : 0.2)
  })
  page.drawText(`PAGE ${index + 1}`, {
    x: 60,
    y: page.getHeight() / 2,
    size: 60,
    font,
    color: rgb(1, 1, 1)
  })
}
const input = join(output, 'five pages & mixed orientation.pdf')
await writeFile(input, await document.save())
const require = createRequire(import.meta.url)
const printer = process.env.FAST_PRINT_TEST_PRINTER || 'Microsoft Print to PDF'
for (const [paper, color, pagesPerSheet] of [
  ['A4', true, 1],
  ['A4', true, 2],
  ['A3', false, 4]
]) {
  const folder = join(output, `${paper}-${color ? 'color' : 'mono'}-${pagesPerSheet}`)
  const token = Buffer.from(JSON.stringify({ printer, paper, color, pagesPerSheet })).toString(
    'base64'
  )
  const env = { ...process.env, FAST_PRINT_NONINTERACTIVE: '1', FAST_PRINT_VERIFY_DIR: folder }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await new Promise((fulfill, reject) => {
    const child = spawn(require('electron'), [root, '--fast-print', token, '--', input], {
      cwd: root,
      env,
      stdio: 'inherit',
      windowsHide: true
    })
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Fast Print verification timed out.'))
    }, 90000)
    child.on('error', reject)
    child.on('exit', (code) => {
      clearTimeout(timer)
      code === 0 ? fulfill() : reject(new Error(`Worker exited with ${code}`))
    })
  })
  const settings = JSON.parse(await readFile(join(folder, 'driver-settings.json'), 'utf8'))
  assert.equal(settings.paper, paper)
  assert.equal(settings.color, color)
  assert.equal(settings.landscape, pagesPerSheet === 2)
  assert.equal(settings.sheets, Math.ceil(5 / pagesPerSheet))
  console.log('Verified:', settings)
}
console.log(`Fast Print end-to-end verification passed. Proof sheets: ${output}`)
