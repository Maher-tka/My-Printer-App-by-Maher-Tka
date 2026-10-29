import assert from 'node:assert/strict'
import { optionalPdfNativeCall } from './nativePdfBridge'
import { refreshPdfMemoryPolicy, getPdfMemoryPolicy } from './memoryPolicy'

const baseline = getPdfMemoryPolicy()
let missingMemoryCalls = 0
const memory = await refreshPdfMemoryPolicy(async () => {
  missingMemoryCalls++
  throw new Error(
    "Error invoking remote method 'pdf:machine-memory': Error: No handler registered for 'pdf:machine-memory'"
  )
})
assert.equal(memory.maxInputBytes, baseline.maxInputBytes)
await refreshPdfMemoryPolicy(async () => {
  missingMemoryCalls++
  throw Error('No handler registered for pdf:machine-memory')
})
assert.equal(missingMemoryCalls, 1, 'A known unavailable channel is not repeatedly invoked')
assert.equal(
  await optionalPdfNativeCall('pdf:select-files', async () => {
    throw Error("No handler registered for 'pdf:select-files'")
  }),
  undefined
)
assert.equal(await optionalPdfNativeCall('missing-api'), undefined)
await assert.rejects(
  () =>
    optionalPdfNativeCall('unexpected-failure', async () => {
      throw Error('Permission denied')
    }),
  /Permission denied/
)
await assert.rejects(
  () =>
    optionalPdfNativeCall('wrong-channel', async () => {
      throw Error("No handler registered for 'other-channel'")
    }),
  /other-channel/
)
const fresh = await optionalPdfNativeCall('supported-channel', async () => ({ ok: true }))
assert.deepEqual(fresh, { ok: true })
console.log(
  'Missing PDF IPC handlers use safe fallbacks; real errors remain visible and known missing calls are cached.'
)
