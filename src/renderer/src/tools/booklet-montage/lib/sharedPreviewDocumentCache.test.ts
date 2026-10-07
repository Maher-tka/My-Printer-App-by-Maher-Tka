import assert from 'node:assert/strict'
import { SharedPreviewDocumentCache } from './sharedPreviewDocumentCache'

type Document = { destroyed: number; destroy(): Promise<void> }
const document = (): Document => ({
  destroyed: 0,
  async destroy() {
    this.destroyed++
  }
})
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const cache = new SharedPreviewDocumentCache<Document>()
const firstLoad = deferred<Document>()
let loads = 0
const first = cache.get('source', () => {
  loads++
  return firstLoad.promise
})
const second = cache.get('source', () => {
  throw new Error('Duplicate source load')
})
assert.equal(first, second, 'concurrent previews share document loading')
const firstDocument = document()
firstLoad.resolve(firstDocument)
assert.equal(await second, firstDocument)
assert.equal(loads, 1)
assert.equal(
  await cache.get('source', () => {
    throw new Error('Cached source reloaded')
  }),
  firstDocument
)
await cache.clear()
assert.equal(firstDocument.destroyed, 1)

const staleLoad = deferred<Document>()
const stale = cache.get('source', () => staleLoad.promise)
const rejected = assert.rejects(stale, /Preview cache was cleared/)
await cache.clear()
const nextLoad = deferred<Document>()
const next = cache.get('source', () => nextLoad.promise)
const staleDocument = document()
staleLoad.resolve(staleDocument)
await rejected
assert.equal(staleDocument.destroyed, 1, 'cleared pending documents are destroyed')
assert.equal(
  cache.get('source', () => {
    throw new Error('Stale cleanup erased the new request')
  }),
  next
)
const nextDocument = document()
nextLoad.resolve(nextDocument)
assert.equal(await next, nextDocument)

const broken = cache.get('broken', async () => {
  throw new Error('Cannot read PDF')
})
await assert.rejects(broken, /Cannot read PDF/)
const recovered = document()
assert.equal(
  await cache.get('broken', async () => recovered),
  recovered,
  'failed source loads can be retried'
)
await cache.clear()
assert.equal(nextDocument.destroyed, 1)
assert.equal(recovered.destroyed, 1)
console.log(
  'Shared preview document loading, clearing, stale-request isolation, and retry tests passed.'
)
