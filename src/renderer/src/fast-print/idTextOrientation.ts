import type { Block } from 'tesseract.js'
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
import coreUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'
import simdCoreUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'
import relaxedCoreUrl from 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js?url'
import arabicUrl from '@tesseract.js-data/ara/4.0.0_best_int/ara.traineddata.gz?url&inline'
import englishUrl from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url&inline'
import { chooseIdTextOrientation, scoreIdText } from '../../../shared/id-orientation'

const coreAssets = [coreUrl, simdCoreUrl, relaxedCoreUrl]
async function asset(url: string): Promise<Uint8Array> {
  if (url.startsWith('data:'))
    return Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0))
  const absolute = new URL(url, location.href).href
  if (!absolute.startsWith('file:')) {
    const response = await fetch(absolute)
    if (!response.ok) throw new Error('Local recognition unavailable')
    return new Uint8Array(await response.arrayBuffer())
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('GET', absolute)
    request.responseType = 'arraybuffer'
    request.onload = () =>
      request.response && (request.status === 0 || request.status === 200)
        ? resolve(new Uint8Array(request.response))
        : reject(new Error('Local recognition unavailable'))
    request.onerror = () => reject(new Error('Local recognition unavailable'))
    request.send()
  })
}

/** Session worker. Only numeric orientation evidence survives each local recognition pass. */
export class IdTextOrientationReader {
  private worker?: Worker
  private blob?: string
  private ready?: Promise<void>
  private sequence = 0
  private stopped = false
  private pending?: (error: Error) => void
  private queue: Promise<unknown> = Promise.resolve()
  dispose(): void {
    this.stopped = true
    this.worker?.terminate()
    this.pending?.(new Error('Canceled'))
    if (this.blob) URL.revokeObjectURL(this.blob)
  }
  private job(action: string, payload: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (this.stopped || !this.worker) return reject(new Error('Canceled'))
      const jobId = `id-${++this.sequence}`
      const timer = window.setTimeout(() => {
        this.dispose()
        reject(new Error('Recognition timed out'))
      }, 30_000)
      const fail = (error: Error) => {
        window.clearTimeout(timer)
        this.pending = undefined
        reject(error)
      }
      this.pending = fail
      this.worker.onmessage = (event) => {
        if (event.data.jobId !== jobId || event.data.status === 'progress') return
        window.clearTimeout(timer)
        this.pending = undefined
        if (event.data.status === 'resolve') resolve(event.data.data)
        else reject(new Error('Local recognition failed'))
      }
      this.worker.onerror = () => fail(new Error('Local recognition failed'))
      this.worker.postMessage({ workerId: 'id', jobId, action, payload })
    })
  }
  private async initialize(): Promise<void> {
    const code = await asset(workerUrl)
    if (this.stopped) throw new Error('Canceled')
    this.blob = URL.createObjectURL(
      new Blob([code as BlobPart], { type: 'application/javascript' })
    )
    this.worker = new Worker(this.blob)
    await this.job('load', {
      options: {
        lstmOnly: true,
        corePath: new URL('.', new URL(coreAssets[0], location.href)).href
      }
    })
    const langs = []
    for (const [code, url] of [
      ['ara', arabicUrl],
      ['eng', englishUrl]
    ])
      langs.push({ code, data: await asset(url) })
    await this.job('loadLanguage', { langs, options: { lstmOnly: true, cacheMethod: 'none' } })
    await this.job('initialize', { langs: 'ara+eng', oem: 1 })
    await this.job('setParameters', {
      params: { tessedit_pageseg_mode: '11', user_defined_dpi: '150' }
    })
  }
  read(canvas: HTMLCanvasElement): Promise<0 | 2 | null> {
    const run = async () => {
      await (this.ready ??= this.initialize())
      const recognize = async (turns: number, contrast: boolean) => {
        const image = document.createElement('canvas')
        image.width = canvas.width
        image.height = canvas.height
        const context = image.getContext('2d')!
        context.translate(image.width / 2, image.height / 2)
        context.rotate((turns * Math.PI) / 2)
        context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
        if (contrast) {
          const pixels = context.getImageData(0, 0, image.width, image.height)
          const histogram = new Uint32Array(256)
          for (let i = 0; i < pixels.data.length; i += 4)
            histogram[
              Math.round(
                pixels.data[i] * 0.299 + pixels.data[i + 1] * 0.587 + pixels.data[i + 2] * 0.114
              )
            ]++
          const percentile = (fraction: number) => {
            let count = 0
            for (let value = 0; value < 256; value++) {
              count += histogram[value]
              if (count >= image.width * image.height * fraction) return value
            }
            return 255
          }
          const low = percentile(0.02),
            high = percentile(0.98)
          for (let i = 0; i < pixels.data.length; i += 4) {
            const value = Math.round(
              ((pixels.data[i] * 0.299 +
                pixels.data[i + 1] * 0.587 +
                pixels.data[i + 2] * 0.114 -
                low) *
                255) /
                Math.max(40, high - low)
            )
            pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value
          }
          context.putImageData(pixels, 0, 0)
        }
        const blob = await new Promise<Blob>((resolve, reject) =>
          image.toBlob(
            (value) => (value ? resolve(value) : reject(new Error('Image unavailable'))),
            'image/png'
          )
        )
        image.width = image.height = 0
        const result = (await this.job('recognize', {
          image: new Uint8Array(await blob.arrayBuffer()),
          options: {},
          output: { blocks: true, text: false }
        })) as { blocks?: Block[] }
        return scoreIdText(
          (result.blocks ?? []).flatMap((b) =>
            b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words))
          )
        )
      }
      const normal = await recognize(0, false),
        inverted = await recognize(2, false)
      const first = chooseIdTextOrientation(normal, inverted)
      if (first !== null) return first
      // One bounded retry for faded/scaled text; print artwork is never filtered.
      const refinedNormal = await recognize(0, true),
        refinedInverted = await recognize(2, true)
      return chooseIdTextOrientation(refinedNormal, refinedInverted)
    }
    const result = this.queue.then(run)
    this.queue = result.catch(() => undefined)
    return result
  }
}
