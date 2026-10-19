import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrinterPreferencesStore } from './printer-preferences-store.js'
import { emptyPrinterPreferences } from '../shared/printer-preferences.js'
const folder = await mkdtemp(join(tmpdir(), 'printer-preferences-test-'))
try {
  const store = new PrinterPreferencesStore(join(folder, 'preferences.json'))
  assert.deepEqual(await store.read(), emptyPrinterPreferences())
  const first = { ...emptyPrinterPreferences(), defaultPrinter: 'Konica' }
  await store.save(first)
  const next = { ...first, defaultPrinter: 'Epson' }
  await store.save(next)
  assert.deepEqual(await store.read(), next)
  assert.deepEqual(JSON.parse(await readFile(store.path + '.bak', 'utf8')), first)
  await assert.rejects(store.save({ ...next, profiles: { Epson: { 'polaroid-8': 'bad' } } }))
  assert.deepEqual(await store.read(), next)
  await writeFile(store.path, 'broken')
  await assert.rejects(
    store.read(),
    /could not be read/,
    'Do not silently replace corrupt preferences or print with unexpected settings'
  )
  console.log(
    'Printer preference atomic persistence, restart loading, backup and failure tests passed.'
  )
} finally {
  assert.ok(folder.startsWith(join(tmpdir(), 'printer-preferences-test-')))
  await rm(folder, { recursive: true, force: true })
}
