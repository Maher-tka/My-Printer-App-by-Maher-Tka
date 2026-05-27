import { assertNotCanceled, yieldToUi } from './memoryCleanup'
import { getPerformanceSettingsSnapshot } from '../../../performance/performanceSettings'
import { getRenderConcurrency } from '../../../performance/renderQuality'

type QueueTask<T> = () => Promise<T>

interface PendingQueueTask<T> {
  task: QueueTask<T>
  signal?: AbortSignal
  priority: number
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

export class RenderQueue {
  private activeCount = 0
  private pending: Array<PendingQueueTask<unknown>> = []

  constructor(private concurrency = 1) {}

  setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, Math.min(Math.floor(concurrency), 3))
    this.drain()
  }

  clear(): void {
    const queued = this.pending
    this.pending = []

    for (const task of queued) {
      task.reject(new Error('Render queue cleared.'))
    }
  }

  run<T>(task: QueueTask<T>, signal?: AbortSignal, priority = 0): Promise<T> {
    assertNotCanceled(signal)

    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        task,
        signal,
        priority,
        resolve: resolve as (value: unknown) => void,
        reject
      })
      this.pending.sort((first, second) => second.priority - first.priority)
      this.drain()
    })
  }

  private drain(): void {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const next = this.pending.shift()

      if (!next) {
        return
      }

      this.activeCount += 1
      void this.runTask(next)
    }
  }

  private async runTask(task: PendingQueueTask<unknown>): Promise<void> {
    try {
      assertNotCanceled(task.signal)
      task.resolve(await task.task())
    } catch (error) {
      task.reject(error)
    } finally {
      this.activeCount -= 1
      this.drain()
    }
  }
}

export const pdfThumbnailRenderQueue = new RenderQueue(getCurrentConcurrency())
export const previewRenderQueue = new RenderQueue(getCurrentConcurrency())
export const exportRenderQueue = new RenderQueue(1)

export function syncRenderQueueConcurrency(): void {
  const concurrency = getCurrentConcurrency()

  pdfThumbnailRenderQueue.setConcurrency(concurrency)
  previewRenderQueue.setConcurrency(concurrency)
  exportRenderQueue.setConcurrency(1)
}

export async function yieldAfterChunk(index: number, chunkSize: number): Promise<void> {
  if (index > 0 && index % chunkSize === 0) {
    await yieldToUi(8)
  }
}

function getCurrentConcurrency(): number {
  return getRenderConcurrency(getPerformanceSettingsSnapshot())
}
