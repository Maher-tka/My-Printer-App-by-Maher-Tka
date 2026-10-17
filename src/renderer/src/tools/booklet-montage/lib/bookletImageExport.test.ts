import assert from 'node:assert/strict'
import { createBlankPage, generateBookletSheets } from './bookletImposition'
import { exportBookletImages } from './exportImages'
import { DEFAULT_SHEET_SETTINGS } from './printSizes'
import { isCanceledError } from './memoryCleanup'

// Exercise export scheduling and allocation guards without a browser/GPU dependency.
const canvases: CanvasStub[] = []
let beforeEncode: (() => void) | undefined
let failEncode = false
class CanvasStub {
  allocations: number[] = []
  private w = 300
  private h = 150
  get width() {
    return this.w
  }
  set width(value: number) {
    this.w = value
    this.allocations.push(value)
  }
  get height() {
    return this.h
  }
  set height(value: number) {
    this.h = value
    this.allocations.push(value)
  }
  getContext() {
    return { fillStyle: '', fillRect() {}, save() {}, restore() {} }
  }
  toBlob(callback: BlobCallback, type: string) {
    setTimeout(() => {
      beforeEncode?.()
      callback(failEncode ? null : new Blob(['encoded sheet'], { type }))
    }, 0)
  }
}
const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    createElement: () => {
      const canvas = new CanvasStub()
      canvases.push(canvas)
      return canvas
    }
  }
})
try {
  const sheets = generateBookletSheets(Array.from({ length: 4 }, (_, i) => createBlankPage(i + 1)))
  const names: string[] = []
  const result = await exportBookletImages(sheets, [], DEFAULT_SHEET_SETTINGS, 'png', () => {}, {
    onImage: (image) => {
      names.push(image.fileName)
      assert.equal(image.blob.type, 'image/png')
    }
  })
  assert.deepEqual(names, ['001.png', '002.png'], 'streamed images preserve front/back order')
  assert.deepEqual(result, [], 'streamed images are not retained in a second in-memory batch')
  assert.ok(
    canvases.every((canvas) => canvas.width === 1 && canvas.height === 1),
    'sheet canvases are released'
  )

  canvases.length = 0
  await assert.rejects(
    exportBookletImages(
      sheets,
      [],
      {
        ...DEFAULT_SHEET_SETTINGS,
        paperSize: 'custom',
        customWidthMm: 10000,
        customHeightMm: 10000
      },
      'png',
      () => {}
    ),
    /Out of memory risk/
  )
  assert.ok(
    canvases.every((canvas) => canvas.allocations.every((size) => size === 1)),
    'oversized canvases are rejected before allocating their pixels'
  )

  const controller = new AbortController()
  let delivered = 0
  beforeEncode = () => controller.abort()
  await assert.rejects(
    exportBookletImages(sheets, [], DEFAULT_SHEET_SETTINGS, 'jpg', () => {}, {
      signal: controller.signal,
      onImage: () => {
        delivered++
      }
    }),
    isCanceledError
  )
  assert.equal(delivered, 0, 'canceling during image encoding cannot save the finished blob')
  beforeEncode = undefined

  const finalSheetCancel = new AbortController()
  await assert.rejects(
    exportBookletImages(sheets, [], DEFAULT_SHEET_SETTINGS, 'jpg', () => {}, {
      signal: finalSheetCancel.signal,
      onImage: (image) => {
        if (image.fileName === '002.jpg') finalSheetCancel.abort()
      }
    }),
    isCanceledError,
    'canceling the last streamed sheet cannot report success'
  )

  failEncode = true
  await assert.rejects(
    exportBookletImages(sheets, [], DEFAULT_SHEET_SETTINGS, 'png', () => {}),
    /Could not export sheet image/
  )
  assert.ok(
    canvases.every((canvas) => canvas.width === 1 && canvas.height === 1),
    'failure and cancellation release canvases'
  )
} finally {
  if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument)
  else Reflect.deleteProperty(globalThis, 'document')
}
console.log('Booklet image export scheduling, memory guards and cancellation tests passed.')
