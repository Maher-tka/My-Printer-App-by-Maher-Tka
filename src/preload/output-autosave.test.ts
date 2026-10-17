import assert from 'node:assert/strict'
import { createOutputAutosave } from './output-autosave.js'

let saves = 0
const autosave = createOutputAutosave(async (_snapshot: { revision: number }) => {
  saves++
  return { ok: true }
})
const original = { revision: 1 }
await Promise.all(Array.from({ length: 92 }, () => autosave(original)))
assert.equal(saves, 1, 'streaming export shares one in-flight project backup')
await autosave(original)
assert.equal(saves, 1, 'later sheets reuse the completed backup')
await autosave({ revision: 2 })
assert.equal(saves, 2, 'edited project snapshots still receive their own backup')

let attempts = 0
const retry = createOutputAutosave(async (_snapshot: object) => {
  attempts++
  if (attempts === 1) throw new Error('temporary write failure')
  return { ok: attempts > 2 }
})
await assert.rejects(retry(original), /temporary write failure/)
await retry(original)
await retry(original)
await retry(original)
assert.equal(
  attempts,
  3,
  'rejected and unsuccessful backups are retried; successful backups are reused'
)
console.log('Export autosave tests passed.')
