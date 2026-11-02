import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'

// Each stage starts a separate hidden process with isolated settings. No printing.
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output/fast-print-appearance', randomUUID())
const settings = join(output, 'settings')
const native = process.env.FAST_PRINT_NATIVE_EXE || join(root, 'out/native/FastPrint-ui-match.exe')
const run = promisify(execFile)
await mkdir(settings, { recursive: true })
const fixture = join(output, 'fixture.png')
await sharp({ create: { width: 32, height: 32, channels: 3, background: '#708090' } })
  .png()
  .toFile(fixture)
async function stage(name, expected, save, override) {
  const folder = join(output, name)
  await mkdir(folder, { recursive: true })
  const env = {
    ...process.env,
    FAST_PRINT_TEST_SETTINGS: settings,
    FAST_PRINT_VERIFY_APPEARANCE: '1',
    FAST_PRINT_EXPECT_APPEARANCE: expected,
    FAST_PRINT_SAVE_APPEARANCE: save || ''
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  const args = ['--verify-audit', folder]
  if (override) args.push('--appearance', override)
  args.push('--', fixture)
  await run(native, args, { cwd: root, env, windowsHide: true, timeout: 30000 })
  assert.equal(await readFile(join(folder, 'error.txt'), 'utf8').catch(() => ''), '')
  const report = JSON.parse(await readFile(join(folder, 'result.json'), 'utf8'))
  assert.equal(report.headless, true)
  assert.equal(report.launched, expected)
  return report
}
await stage('initial', 'system', 'light')
await stage('reopen-light', 'light', 'dark')
await stage('reopen-dark', 'dark')
await stage('explicit-override', 'light', undefined, 'light')
await stage('override-not-saved', 'dark', 'system')
await stage('reopen-system', 'system')
await writeFile(join(settings, 'appearance.json'), '{broken')
await stage('corrupt-fallback', 'system')
console.log(
  'Light, dark and system choices persist across processes; explicit overrides and corrupt-file fallback passed. No print jobs.'
)
