import type { BookletPage } from '../types'
import { assertWithinCanvasBudget } from '../../../performance/memoryBudget'
import { getPerformanceSettingsSnapshot } from '../../../performance/performanceSettings'
import { revokeThumbnailUrl } from './thumbnailCache'

export const MAX_CANVAS_PIXELS = 80_000_000

export function assertCanvasWithinLimit(width: number, height: number, purpose: string): void {
  assertWithinCanvasBudget(width, height, purpose, getPerformanceSettingsSnapshot())
}

export function resetCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 1
  canvas.height = 1
}

export function releasePageThumbnail(page: BookletPage): void {
  if (page.thumbnailUrl) {
    revokeThumbnailUrl(page.thumbnailUrl)
  }
}

export function releasePageThumbnails(pages: BookletPage[]): void {
  for (const page of pages) {
    releasePageThumbnail(page)
  }
}

export function assertNotCanceled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createCanceledError('Operation canceled.')
  }
}

export function createCanceledError(message: string): Error {
  const error = new Error(message)
  error.name = 'AbortError'

  return error
}

export function isCanceledError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export function yieldToUi(delayMs = 0, signal?: AbortSignal): Promise<void> {
  assertNotCanceled(signal)

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }
    const onAbort = (): void => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(timeoutId)
      signal?.removeEventListener('abort', onAbort)
      reject(createCanceledError('Operation canceled.'))
    }
    const timeoutId = globalThis.setTimeout(finish, delayMs)

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
