import { assertNotCanceled, yieldToUi } from './memoryCleanup'

type QueueTask<T> = () => Promise<T>

interface PendingQueueTask<T> {
  task: QueueTask<T>
  signal?: AbortSignal
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

export class RenderQueue {
  private activeCount = 0
  private readonly pending: Array<PendingQueueTask<unknown>> = []

  constructor(private readonly concurrency = 1) {}

  run<T>(task: QueueTask<T>, signal?: AbortSignal): Promise<T> {
    assertNotCanceled(signal)

    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        task,
        signal,
        resolve: resolve as (value: unknown) => void,
        reject
      })
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

export const pdfThumbnailRenderQueue = new RenderQueue(1)
export const previewRenderQueue = new RenderQueue(1)
export const exportRenderQueue = new RenderQueue(1)

export async function yieldAfterChunk(index: number, chunkSize: number): Promise<void> {
  if (index > 0 && index % chunkSize === 0) {
    await yieldToUi(8)
  }
}
