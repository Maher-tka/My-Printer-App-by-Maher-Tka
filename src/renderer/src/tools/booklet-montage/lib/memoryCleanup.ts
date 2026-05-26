import type { BookletPage } from '../types'
import { revokeThumbnailUrl } from './thumbnailCache'

export const MAX_CANVAS_PIXELS = 80_000_000

export function assertCanvasWithinLimit(
  width: number,
  height: number,
  purpose: string
): void {
  if (width * height > MAX_CANVAS_PIXELS) {
    throw new Error(
      `Out of memory risk while ${purpose}. Reduce paper size, export quality, or custom dimensions.`
    )
  }
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

export function yieldToUi(delayMs = 0): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
  })
}
