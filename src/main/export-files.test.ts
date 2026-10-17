import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportBuffer, planOutputFiles, writeExportFile } from './export-files.js'

const folder = await mkdtemp(join(tmpdir(), 'my-printer-export-'))
const bytes = (text: string) => Buffer.from(text)
try {
  const target = join(folder, 'customer.pdf')
  await writeFile(target, 'original export')
  assert.throws(() => writeExportFile(target, new Uint8Array()), /empty/)
  assert.equal(await readFile(target, 'utf8'), 'original export')
  assert.throws(() => exportBuffer(null as unknown as Uint8Array), /valid file data/)

  await Promise.all([
    writeExportFile(target, bytes('first replacement')),
    writeExportFile(target, bytes('second replacement'))
  ])
  assert.equal(
    await readFile(target, 'utf8'),
    'second replacement',
    'overlapping saves finish in order'
  )
  assert.deepEqual(
    await readdir(folder),
    ['customer.pdf'],
    'successful saves leave no staging files'
  )

  const blocked = join(folder, 'blocked.pdf')
  await mkdir(blocked)
  await writeFile(join(blocked, 'keep.txt'), 'preserved')
  await assert.rejects(writeExportFile(blocked, bytes('cannot replace a directory')), /Could not/)
  assert.equal(await readFile(join(blocked, 'keep.txt'), 'utf8'), 'preserved')
  assert.deepEqual(
    (await readdir(folder)).sort(),
    ['blocked.pdf', 'customer.pdf'],
    'failed saves clean up staging files'
  )
  await rm(blocked, { recursive: true })
  await writeExportFile(blocked, bytes('retry works'))
  assert.equal(
    await readFile(blocked, 'utf8'),
    'retry works',
    'a failed save does not poison later retries'
  )

  for (const name of [
    '../escape.pdf',
    'nested/../escape.pdf',
    'C:\\escape.pdf',
    '/escape.pdf',
    'bad:stream',
    'CON.pdf',
    'a/NUL.png',
    'trailing./a.pdf',
    'a//b.pdf'
  ]) {
    assert.throws(
      () => planOutputFiles(folder, [{ fileName: name, bytes: bytes('data') }]),
      /Invalid output/
    )
  }
  assert.throws(() => planOutputFiles(folder, []), /No files/)
  assert.throws(
    () =>
      planOutputFiles(folder, [
        { fileName: 'same.pdf', bytes: bytes('first') },
        { fileName: 'SAME.pdf', bytes: bytes('second') }
      ]),
    /Duplicate/
  )
  assert.throws(
    () =>
      planOutputFiles(folder, [
        { fileName: 'customer.pdf', bytes: bytes('should not be saved') },
        { fileName: 'empty.png', bytes: new Uint8Array() }
      ]),
    /empty/
  )
  assert.equal(
    await readFile(target, 'utf8'),
    'second replacement',
    'invalid batch leaves earlier destinations untouched'
  )
  const [planned] = planOutputFiles(folder, [
    { fileName: 'nested/sheet.pdf', bytes: bytes('valid') }
  ])
  assert.equal(planned.filePath, join(folder, 'nested', 'sheet.pdf'))
} finally {
  await rm(folder, { recursive: true, force: true })
}
console.log('Shared export file safety tests passed.')
