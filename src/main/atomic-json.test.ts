import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeJsonAtomically } from './atomic-json.js'

async function run(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'my-printer-atomic-save-'))
  const filePath = join(directory, 'job.myprinter-cutter.json')

  try {
    await writeJsonAtomically(filePath, { revision: 1 }, { backupExisting: true })
    assert.equal(JSON.parse(await readFile(filePath, 'utf8')).revision, 1)

    await writeJsonAtomically(filePath, { revision: 2 }, { backupExisting: true })
    assert.equal(JSON.parse(await readFile(filePath, 'utf8')).revision, 2)
    assert.equal(JSON.parse(await readFile(`${filePath}.bak`, 'utf8')).revision, 1)

    await writeJsonAtomically(filePath, { revision: 3 }, { backupExisting: true })
    assert.equal(JSON.parse(await readFile(filePath, 'utf8')).revision, 3)
    assert.equal(JSON.parse(await readFile(`${filePath}.bak`, 'utf8')).revision, 2)

    const circular: { self?: unknown } = {}
    circular.self = circular
    await assert.rejects(writeJsonAtomically(filePath, circular, { backupExisting: true }))
    assert.equal(JSON.parse(await readFile(filePath, 'utf8')).revision, 3)
    assert.equal(JSON.parse(await readFile(`${filePath}.bak`, 'utf8')).revision, 2)
    assert.deepEqual((await readdir(directory)).sort(), [
      'job.myprinter-cutter.json',
      'job.myprinter-cutter.json.bak'
    ])

    await Promise.all([
      writeJsonAtomically(filePath, { revision: 4 }, { backupExisting: true }),
      writeJsonAtomically(filePath, { revision: 5 }, { backupExisting: true })
    ])
    assert.equal(JSON.parse(await readFile(filePath, 'utf8')).revision, 5)
    assert.equal(JSON.parse(await readFile(`${filePath}.bak`, 'utf8')).revision, 4)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

await run()
console.log('Atomic project save tests passed.')
