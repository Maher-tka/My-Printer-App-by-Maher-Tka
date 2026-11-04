import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'

// Hidden WinForms controls with isolated icon files; no desktop input or print jobs.
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-icon-manager', randomUUID())
const powershell = join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')
const run = promisify(execFile)
await mkdir(output, { recursive: true })
for (const language of ['en', 'fr', 'ar']) {
  const preview = join(output, `${language}.png`)
  const env = { ...process.env, FAST_PRINT_SETTINGS_HIDDEN_PROOF: '1' }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  await run(
    powershell,
    [
      '-NoProfile',
      '-STA',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      join(root, 'scripts/fast-print-settings.ps1'),
      '-Action',
      'Manage',
      '-Language',
      language,
      '-PreviewPath',
      preview
    ],
    { cwd: root, env, windowsHide: true, timeout: 30000 }
  )
  const dimensions = await sharp(preview).metadata()
  assert.ok(dimensions.width >= 900 && dimensions.height >= 680, `${language}: incomplete preview`)
  console.log(`${language}: icon menu lifecycle, cancel, reset and target changes passed`)
}
