import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'tmp', 'fast-print-batch-proof')
await mkdir(output, { recursive: true })
const files = []
for (const [name, color] of [
  ['01 & first', rgb(0.85, 0.15, 0.15)],
  ['02 second', rgb(0.15, 0.2, 0.85)]
]) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.HelveticaBold)
  for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
    const page = pdf.addPage([595, 842])
    page.drawRectangle({ x: 20, y: 20, width: 555, height: 802, color })
    page.drawText(`${name} - page ${pageIndex + 1}`, {
      x: 45,
      y: 400,
      size: 27,
      font,
      color: rgb(1, 1, 1)
    })
  }
  const path = join(output, `${name}.pdf`)
  await writeFile(path, await pdf.save())
  files.push(path)
}
const image = join(root, 'tmp', 'fast-print-proof', 'A4-color-1', '00001.png')
files.push(image)
const require = createRequire(import.meta.url)
const preset = { printer: 'Microsoft Print to PDF', paper: 'A4', color: true, pagesPerSheet: 2 }
const env = {
  ...process.env,
  FAST_PRINT_NONINTERACTIVE: '1',
  FAST_PRINT_VERIFY_DIR: join(output, 'sheets')
}
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_RENDERER_URL
await new Promise((fulfill, reject) => {
  const child = spawn(
    require('electron'),
    [root, '--fast-print', Buffer.from(JSON.stringify(preset)).toString('base64'), '--', ...files],
    { env, cwd: root, stdio: 'inherit', windowsHide: true }
  )
  const timer = setTimeout(() => {
    child.kill()
    reject(new Error('Batch verification timed out.'))
  }, 90000)
  child.on('error', reject)
  child.on('exit', (code) => {
    clearTimeout(timer)
    code === 0 ? fulfill() : reject(new Error(`Batch worker exited ${code}`))
  })
})
const settings = JSON.parse(await readFile(join(output, 'sheets', 'driver-settings.json'), 'utf8'))
assert.equal(settings.sheets, 5, '3-page PDF + 3-page PDF + image must produce 2+2+1 sheets')
assert.equal(settings.landscape, true)
assert.equal(settings.paper, 'A4')
const manifest = JSON.parse(await readFile(join(output, 'sheets', 'job.json'), 'utf8'))
assert.equal(manifest.name, 'Fast Print - 3 documents')
assert.equal(
  (await readdir(join(output, 'sheets'))).filter((name) => name.endsWith('.png')).length,
  5
)
// A mixed unsupported selection must fail before a job is prepared or submitted.
const invalidEnv = { ...env, FAST_PRINT_VERIFY_DIR: join(output, 'invalid') }
await new Promise((fulfill, reject) => {
  const child = spawn(
    require('electron'),
    [
      root,
      '--fast-print',
      Buffer.from(JSON.stringify(preset)).toString('base64'),
      '--',
      files[0],
      join(output, 'unsupported.bat')
    ],
    { env: invalidEnv, cwd: root, stdio: 'inherit', windowsHide: true }
  )
  child.on('error', reject)
  child.on('exit', (code) =>
    code === 1 ? fulfill() : reject(new Error('Unsupported batch was not rejected'))
  )
})
await assert.rejects(() => readFile(join(output, 'invalid', 'job.json')))
console.log(
  `Batch worker verified: one job, five sheets, mixed PDF/image input, fresh sheet boundaries, and unsupported-file rejection. Proofs: ${output}`
)
