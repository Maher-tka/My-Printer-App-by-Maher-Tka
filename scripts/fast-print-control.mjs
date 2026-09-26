import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const action = process.argv[2]
if (!['install', 'remove', 'manage'].includes(action))
  throw new Error('Choose install, remove, or manage.')
const env = { ...process.env, FAST_PRINT_NONINTERACTIVE: '1' }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_RENDERER_URL
const child = spawn(require('electron'), [root, `--${action}-fast-print`], {
  cwd: root,
  env,
  stdio: 'inherit',
  windowsHide: true
})
child.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
