import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadReviewedPolaroid } from './fast-print-polaroid-cache.js'
import { polaroidLayout } from '../shared/fast-print-polaroid.js'

const directory = await mkdtemp(join(tmpdir(), 'polaroid-cache-test-'))
try {
  const folder = join(directory, 'reviewed-polaroid')
  await mkdir(folder)
  const source = join(directory, 'source.jpg')
  await writeFile(source, 'original source')
  const info = await stat(source)
  const layout = polaroidLayout('polaroid-8')
  // The production renderer/driver proof checks full PNG decoding. This fixture
  // isolates manifest, source freshness, filename and physical-size validation.
  const header = Buffer.alloc(24)
  header.set(Buffer.from('89504e470d0a1a0a', 'hex'))
  header.writeUInt32BE(layout.width, 16)
  header.writeUInt32BE(layout.height, 20)
  await writeFile(join(folder, '00001.png'), header)
  const manifest = {
    version: 1,
    mode: 'polaroid-8',
    photos: 1,
    sources: [{ path: source, length: info.size, modifiedMs: info.mtimeMs }],
    sheets: ['00001.png']
  }
  const save = (value: unknown) => writeFile(join(folder, 'sheets.json'), JSON.stringify(value))
  await save(manifest)
  assert.deepEqual(await loadReviewedPolaroid(directory, 'polaroid-8', [source]), {
    sheets: [join(folder, '00001.png')],
    photos: 1
  })
  for (const invalid of [
    { ...manifest, mode: 'polaroid-9' },
    { ...manifest, photos: 9 },
    { ...manifest, sheets: [] },
    { ...manifest, sheets: ['../00001.png'] },
    { ...manifest, sources: [] },
    { ...manifest, sources: [{ ...manifest.sources[0], path: 'other.jpg' }] },
    { ...manifest, sources: [{ ...manifest.sources[0], modifiedMs: info.mtimeMs - 2000 }] }
  ]) {
    await save(invalid)
    await assert.rejects(loadReviewedPolaroid(directory, 'polaroid-8', [source]))
  }
  await save(manifest)
  header.writeUInt32BE(layout.height, 16)
  await writeFile(join(folder, '00001.png'), header)
  await assert.rejects(loadReviewedPolaroid(directory, 'polaroid-8', [source]), /sheet size/)
  await writeFile(source, 'changed source file')
  await assert.rejects(loadReviewedPolaroid(directory, 'polaroid-8', [source]), /Files changed/)
  console.log(
    'Reviewed Polaroid cache: source changes, missing sheets, mode, paths and dimensions passed.'
  )
} finally {
  await rm(directory, { recursive: true, force: true })
}
