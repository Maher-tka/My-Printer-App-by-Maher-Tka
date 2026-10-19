import assert from 'node:assert/strict'
import { writeProjectRecovery } from './recoverySave'

const request = { project: { metadata: { id: 'test-project' } }, originalFilePath: null }
await writeProjectRecovery(request, async (received) => {
  assert.equal(received, request)
  return { ok: true }
})
await assert.rejects(
  writeProjectRecovery(request, async () => ({ ok: false, error: 'Disk full' })),
  /Disk full/
)
await assert.rejects(
  writeProjectRecovery(request, async () => ({ ok: false })),
  /Automatic recovery could not be saved/
)
await assert.rejects(
  writeProjectRecovery(request, async () => {
    throw new Error('IPC unavailable')
  }),
  /IPC unavailable/
)
console.log('Project recovery write success, disk failure and IPC failure tests passed.')
