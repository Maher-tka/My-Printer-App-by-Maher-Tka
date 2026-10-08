import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  createIllustratorExportPowerShell,
  getIllustratorExportErrorMessage,
  ILLUSTRATOR_EXPORT_MESSAGES,
  isIllustratorExportTimeout,
  isIllustratorJobUnfinished
} from './illustrator-export-runner.js'
import { createIllustratorPdfScript } from './illustrator-pdf-script.js'

const script = createIllustratorExportPowerShell("C:\\test\\O'Brien ملف\\export.jsx")
assert.match(script, /Get-Process -Name Illustrator/)
assert.match(script, /HasDialog\(\[uint32\]\$process.Id\)/)
assert.ok(
  script.indexOf('ILLUSTRATOR_DIALOG_OPEN') < script.indexOf('DoJavaScriptFile'),
  'reject dialogs before entering a blocking COM call'
)
assert.match(script, /GetActiveObject\('Illustrator.Application'\)/)
assert.doesNotMatch(
  script,
  /New-Object -ComObject/,
  'cold startup cannot introduce a FineCut setup dialog inside an export'
)
assert.match(script, /O''Brien ملف/, 'Unicode/apostrophe paths stay literal')
for (const [code, key] of [
  ['ILLUSTRATOR_NOT_RUNNING', 'notRunning'],
  ['ILLUSTRATOR_DIALOG_OPEN', 'dialog'],
  ['ILLUSTRATOR_BUSY', 'busy'],
  ['80010001', 'busy'],
  ['8001010A', 'busy'],
  ['ILLUSTRATOR_AUTOMATION_UNAVAILABLE', 'automation']
] as const) {
  assert.equal(getIllustratorExportErrorMessage({ stderr: code }), ILLUSTRATOR_EXPORT_MESSAGES[key])
}
assert.equal(
  getIllustratorExportErrorMessage({ killed: true, signal: 'SIGTERM' }),
  ILLUSTRATOR_EXPORT_MESSAGES.timeout
)
assert.equal(
  getIllustratorExportErrorMessage({ code: 'ENOSPC' }),
  ILLUSTRATOR_EXPORT_MESSAGES.space
)
assert.equal(
  getIllustratorExportErrorMessage({ code: 'EACCES' }),
  ILLUSTRATOR_EXPORT_MESSAGES.write
)
const raw = {
  // Raw command output belongs in diagnostics, never in a user-facing banner.
  message: 'Command failed: powershell.exe -EncodedCommand JABFAHI#< CLIXML',
  stderr: '#< CLIXML\n<Objs>broken export</Objs>'
}
assert.equal(getIllustratorExportErrorMessage(raw), ILLUSTRATOR_EXPORT_MESSAGES.failed)
assert.equal(
  getIllustratorExportErrorMessage({
    stderr: 'open: The destination PDF is already open in Illustrator.'
  }),
  ILLUSTRATOR_EXPORT_MESSAGES.destination
)
assert.equal(
  getIllustratorExportErrorMessage({
    stderr: 'verify saved sheet: Saved PDF lost cutting paths or registration marks.'
  }),
  ILLUSTRATOR_EXPORT_MESSAGES.verification
)
assert.doesNotMatch(getIllustratorExportErrorMessage(raw), /EncodedCommand|CLIXML|JABFAHI/)
assert.equal(isIllustratorExportTimeout({ killed: true }), true)
assert.equal(isIllustratorExportTimeout({ code: 1 }), false)
const jsx = createIllustratorPdfScript(
  [{ svgPath: 'input.svg', widthMm: 955, heightMm: 355, repeatCount: 1 }],
  'output.pdf',
  1,
  false,
  'status.txt'
)
for (const stage of [
  'open layout',
  'prepare layers',
  'save PDF',
  'reopen PDF',
  'verify saved sheet',
  'complete',
  'error'
])
  assert.ok(jsx.includes(`status('${stage}'`))
assert.match(jsx, /finally\{app.userInteractionLevel=previous/)
assert.match(jsx, /actualCuts!==expectedCuts/, 'progress reporting preserves cut-path verification')

const folder = await mkdtemp(join(tmpdir(), 'illustrator-export-test-'))
try {
  const status = join(folder, 'status.txt'),
    pids = join(folder, 'process.txt')
  assert.equal(
    await isIllustratorJobUnfinished(status),
    false,
    'a rejected preflight has no native job to wait for'
  )
  await writeFile(status, 'save PDF\n')
  assert.equal(
    await isIllustratorJobUnfinished(status),
    true,
    'timed-out native save remains protected from concurrent retries'
  )
  assert.equal(
    await isIllustratorJobUnfinished(status, pids),
    true,
    'missing process metadata cannot release an active job'
  )
  await writeFile(pids, String(process.pid))
  assert.equal(await isIllustratorJobUnfinished(status, pids), true)
  await writeFile(status, 'complete\n')
  assert.equal(
    await isIllustratorJobUnfinished(status, pids),
    false,
    'finished native job permits retry'
  )
  await writeFile(status, 'error\nverify saved sheet: Missing cut paths.')
  assert.equal(await isIllustratorJobUnfinished(status, pids), false)
  // A native process that exits cannot leave an export permanently locked.
  const exited = await promisify(execFile)(process.execPath, [
    '-e',
    'process.stdout.write(String(process.pid))'
  ])
  await writeFile(status, 'open layout\n')
  await writeFile(pids, exited.stdout)
  assert.equal(
    await isIllustratorJobUnfinished(status, pids),
    false,
    'closing Illustrator releases the timed-out job'
  )
} finally {
  await rm(folder, { recursive: true, force: true })
}
console.log(
  'Illustrator readiness, readable errors, stage diagnostics and timeout recovery tests passed.'
)
