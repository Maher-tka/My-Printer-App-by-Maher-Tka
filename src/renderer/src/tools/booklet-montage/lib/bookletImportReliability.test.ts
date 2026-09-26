import { strict as assert } from 'node:assert'
import {
  clearThumbnailCache,
  getInitialThumbnailPageIndexes,
  getOrCreateThumbnailUrl,
  getPendingThumbnailCount,
  getThumbnailCacheSize,
  revokeThumbnailUrl
} from './thumbnailCache'
import { isCanceledError, yieldToUi } from './memoryCleanup'

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  assert.deepEqual(actual, expected, label)
}

function testInitialThumbnailPlanIsBounded(): void {
  expectEqual(
    getInitialThumbnailPageIndexes(64),
    [...Array.from({ length: 23 }, (_, index) => index), 63],
    '64-page import keeps order and includes the last page'
  )
  expectEqual(
    getInitialThumbnailPageIndexes(183),
    [...Array.from({ length: 23 }, (_, index) => index), 182],
    '183-page import never schedules every thumbnail'
  )
  expectEqual(
    getInitialThumbnailPageIndexes(4, 10),
    [0, 1, 2, 3],
    'small documents still receive every initial thumbnail'
  )
  expectEqual(
    getInitialThumbnailPageIndexes(100, 4),
    [0, 1, 2, 99],
    'custom thumbnail limit preserves the first and last pages'
  )
}

async function testThumbnailCacheSingleFlightAndCleanup(): Promise<void> {
  clearThumbnailCache()
  let renderCount = 0
  let releaseRender: (() => void) | undefined

  const first = getOrCreateThumbnailUrl(
    'booklet-test-single-flight',
    () =>
      new Promise<Blob>((resolve) => {
        renderCount += 1
        releaseRender = () => resolve(new Blob(['thumbnail']))
      })
  )
  const second = getOrCreateThumbnailUrl('booklet-test-single-flight', async () => {
    renderCount += 1
    return new Blob(['unexpected duplicate render'])
  })

  assert.equal(getPendingThumbnailCount(), 1, 'same-key thumbnail work is shared')
  assert.equal(renderCount, 0, 'render starts on the microtask boundary')
  await Promise.resolve()
  assert.equal(renderCount, 1, 'shared render starts once')
  releaseRender?.()

  const [firstUrl, secondUrl] = await Promise.all([first, second])
  assert.equal(renderCount, 1, 'same-key thumbnail work renders once')
  assert.equal(firstUrl, secondUrl, 'same-key callers receive one object URL')
  assert.equal(getThumbnailCacheSize(), 1, 'completed URL is cached once')

  revokeThumbnailUrl(firstUrl)
  assert.equal(getThumbnailCacheSize(), 0, 'released page URL leaves the cache')
  assert.equal(getPendingThumbnailCount(), 0, 'completed work leaves no pending entry')
}

async function testClearingCacheInvalidatesPendingWork(): Promise<void> {
  clearThumbnailCache()
  let releaseRender: (() => void) | undefined
  const pending = getOrCreateThumbnailUrl(
    'booklet-test-clear-pending',
    () =>
      new Promise<Blob>((resolve) => {
        releaseRender = () => resolve(new Blob(['late thumbnail']))
      })
  )

  assert.equal(getPendingThumbnailCount(), 1, 'pending work is visible to cleanup')
  await Promise.resolve()
  clearThumbnailCache()
  releaseRender?.()

  await assert.rejects(
    pending,
    /Thumbnail cache was cleared while a thumbnail was rendering/,
    'clearing cache invalidates an in-flight object URL'
  )
  assert.equal(getPendingThumbnailCount(), 0, 'invalidated work is removed')
  assert.equal(getThumbnailCacheSize(), 0, 'invalidated work is not reinserted')
}

async function testYieldCanBeCanceled(): Promise<void> {
  const controller = new AbortController()
  const pending = yieldToUi(25, controller.signal)
  controller.abort()

  await assert.rejects(
    pending,
    (error: unknown) => {
      return isCanceledError(error)
    },
    'UI yield responds to import cancellation'
  )
}

testInitialThumbnailPlanIsBounded()
await testThumbnailCacheSingleFlightAndCleanup()
await testClearingCacheInvalidatesPendingWork()
await testYieldCanBeCanceled()

console.log('Booklet import reliability tests passed.')
