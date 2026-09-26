import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve(import.meta.dirname, '..')
const profile = JSON.parse(
  await readFile(join(root, 'tmp', 'fast-print-profile-verification.json'), 'utf8')
)
const require = createRequire(import.meta.url)
const folder = join(root, 'tmp', 'fast-print-proof', 'saved-driver-profile')
const token = Buffer.from(
  JSON.stringify({
    printer: profile.printer,
    paper: profile.paper,
    color: true,
    pagesPerSheet: 4,
    profileId: profile.id
  })
).toString('base64')
const env = { ...process.env, FAST_PRINT_NONINTERACTIVE: '1', FAST_PRINT_VERIFY_DIR: folder }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_RENDERER_URL
await new Promise((fulfill, reject) => {
  const child = spawn(
    require('electron'),
    [
      root,
      '--fast-print',
      token,
      '--',
      join(root, 'tmp', 'fast-print-proof', 'five pages & mixed orientation.pdf')
    ],
    { cwd: root, env, stdio: 'inherit', windowsHide: true }
  )
  const timer = setTimeout(() => {
    child.kill()
    reject(new Error('Saved preset verification timed out.'))
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
assert.equal(settings.profileId, profile.id)
assert.equal(settings.paper, 'A4')
assert.equal(settings.landscape, true)
assert.equal(settings.color, true)
assert.equal(settings.sheets, 2)
assert.equal(settings.tray, profile.tray)
assert.equal(settings.duplex, profile.duplex)
console.log('Saved driver preset worker verified:', settings)
