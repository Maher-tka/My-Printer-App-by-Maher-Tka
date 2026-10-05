import type { Block } from 'tesseract.js'
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
import coreUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'
import simdCoreUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'
import relaxedCoreUrl from 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js?url'
// Inline inside this lazy module: download managers can intercept .gz requests
// even from localhost. Data URLs also work offline in packaged Electron.
import arabicUrl from '@tesseract.js-data/ara/4.0.0_best_int/ara.traineddata.gz?url&inline'
import frenchUrl from '@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz?url&inline'
import englishUrl from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url&inline'
import { detectSpineText, getSpineAuthorCrops, type CoverTextBlock } from './spineDetection'

// Referencing every variant makes Vite include the local scripts. The worker
// chooses SIMD support without forcing older customer PCs to use it.
const coreAssets = [coreUrl, simdCoreUrl, relaxedCoreUrl]

async function readLocalAsset(url: string, signal: AbortSignal): Promise<Uint8Array> {
  const absolute = new URL(url, window.location.href).href
  if (!absolute.startsWith('file:')) {
    const response = await fetch(absolute, { signal })
    if (!response.ok) throw new Error('Could not load the installed recognition files.')
    return new Uint8Array(await response.arrayBuffer())
  }
  // Chromium fetch does not support file:// in all packaged Electron versions.
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    const abort = (): void => request.abort()
    request.open('GET', absolute)
    request.responseType = 'arraybuffer'
    signal.addEventListener('abort', abort, { once: true })
    request.onload = () => {
      signal.removeEventListener('abort', abort)
      if ((request.status === 0 || request.status === 200) && request.response)
        resolve(new Uint8Array(request.response))
      else reject(new Error('Could not load the installed recognition files.'))
    }
    request.onerror = () => {
      signal.removeEventListener('abort', abort)
      reject(new Error('Could not load recognition files.'))
    }
    request.onabort = () => {
      signal.removeEventListener('abort', abort)
      reject(new DOMException('Canceled', 'AbortError'))
    }
    request.send()
    if (signal.aborted) request.abort()
  })
}

/** One worker, one bounded image, no network services or resident AI model. */
export async function recognizeSpinePage(
  canvas: HTMLCanvasElement,
  signal: AbortSignal
): Promise<CoverTextBlock[]> {
  // Own the worker from its creation, including initialization. The high-level
  // createWorker API exposes it only after loading, too late to cancel on a
  // slow PC. This small bridge uses the pinned Tesseract 7 worker protocol.
  let worker: Worker | undefined
  let workerBlob: string | undefined
  let pendingReject: ((error: Error) => void) | undefined
  const controller = new AbortController()
  const abort = (): void => {
    controller.abort()
    worker?.terminate()
    pendingReject?.(new DOMException('Canceled', 'AbortError'))
  }
  signal.addEventListener('abort', abort, { once: true })
  const timeout = window.setTimeout(() => {
    controller.abort()
    worker?.terminate()
    pendingReject?.(
      new Error('Recognition took too long. Enter the remaining spine details manually.')
    )
  }, 90_000)
  try {
    signal.throwIfAborted()
    const languages = []
    for (const [code, url] of [
      ['ara', arabicUrl],
      ['fra', frenchUrl],
      ['eng', englishUrl]
    ]) {
      controller.signal.throwIfAborted()
      languages.push({ code, data: await readLocalAsset(url, controller.signal) })
    }
    const workerCode = await readLocalAsset(workerUrl, controller.signal)
    controller.signal.throwIfAborted()
    workerBlob = URL.createObjectURL(
      new Blob([workerCode as BlobPart], { type: 'application/javascript' })
    )
    worker = new Worker(workerBlob)
    let sequence = 0
    const job = (action: string, payload: unknown): Promise<unknown> =>
      new Promise((resolve, reject) => {
        controller.signal.throwIfAborted()
        pendingReject = reject
        const jobId = `spine-${++sequence}`
        worker!.onmessage = (event) => {
          if (event.data.jobId !== jobId || event.data.status === 'progress') return
          pendingReject = undefined
          if (event.data.status === 'resolve') resolve(event.data.data)
          else reject(new Error(String(event.data.data)))
        }
        worker!.onerror = () => reject(new Error('Could not start local cover recognition.'))
        worker!.postMessage({ workerId: 'spine', jobId, action, payload })
      })
    await job('load', {
      options: {
        lstmOnly: true,
        corePath: new URL('.', new URL(coreAssets[0], window.location.href)).href
      }
    })
    await job('loadLanguage', {
      langs: languages,
      options: { lstmOnly: true, cacheMethod: 'none' }
    })
    await job('initialize', { langs: languages.map((language) => language.code).join('+'), oem: 1 })
    await job('setParameters', { params: { tessedit_pageseg_mode: '11', user_defined_dpi: '150' } })
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('Could not read the cover image.'))),
        'image/png'
      )
    )
    controller.signal.throwIfAborted()
    const image = new Uint8Array(await blob.arrayBuffer())
    const data = (await job('recognize', {
      image,
      options: {},
      output: { blocks: true, text: true }
    })) as { blocks?: Block[] }
    controller.signal.throwIfAborted()
    const toBlocks = (data: { blocks?: Block[] }): CoverTextBlock[] =>
      (data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) =>
          paragraph.lines.map((line) => ({
            text: line.text,
            x: line.bbox.x0,
            y: line.bbox.y0,
            width: line.bbox.x1 - line.bbox.x0,
            height: line.bbox.y1 - line.bbox.y0,
            confidence: line.confidence
          }))
        )
      )
    let blocks = toBlocks(data)
    // Drawings and patterned covers can generate dozens of tiny false words.
    // One bounded contrast pass removes pale artwork while retaining dark text.
    // Reuse this worker, and accept it only if it preserves detected coverage.
    const noise = blocks.filter((block) => block.text.trim().length < 6).length
    if (blocks.length > 45 && noise > blocks.length * 0.55) {
      const contrast = document.createElement('canvas')
      contrast.width = canvas.width
      contrast.height = canvas.height
      try {
        const context = contrast.getContext('2d')!
        context.drawImage(canvas, 0, 0)
        const pixels = context.getImageData(0, 0, contrast.width, contrast.height)
        for (let index = 0; index < pixels.data.length; index += 4) {
          if (index % 1048576 === 0) {
            controller.signal.throwIfAborted()
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
          }
          const gray =
            (pixels.data[index] * 3 + pixels.data[index + 1] * 6 + pixels.data[index + 2]) / 10 <
            105
              ? 0
              : 255
          pixels.data[index] = gray
          pixels.data[index + 1] = gray
          pixels.data[index + 2] = gray
        }
        context.putImageData(pixels, 0, 0)
        const contrastBlob = await new Promise<Blob | null>((resolve) =>
          contrast.toBlob(resolve, 'image/png')
        )
        controller.signal.throwIfAborted()
        if (contrastBlob) {
          const contrasted = toBlocks(
            (await job('recognize', {
              image: new Uint8Array(await contrastBlob.arrayBuffer()),
              options: {},
              output: { blocks: true, text: true }
            })) as { blocks?: Block[] }
          )
          const pageSize = { width: canvas.width, height: canvas.height }
          const before = detectSpineText({ ...pageSize, blocks })
          const after = detectSpineText({ ...pageSize, blocks: contrasted })
          const retained = Object.keys(before).every((field) => after[field as keyof typeof after])
          const fewerFalseWords =
            contrasted.filter((block) => block.text.trim().length < 6).length < noise / 2
          if (retained && fewerFalseWords) blocks = contrasted
        }
      } finally {
        contrast.width = 0
        contrast.height = 0
      }
    }
    const page = { width: canvas.width, height: canvas.height, blocks }
    if (!detectSpineText(page).studentName) {
      for (const crop of getSpineAuthorCrops(page)) {
        controller.signal.throwIfAborted()
        await job('setParameters', { params: { tessedit_pageseg_mode: '6' } })
        const refined = (await job('recognize', {
          image,
          options: { rectangle: crop },
          output: { blocks: true, text: true }
        })) as { blocks?: Block[] }
        const lines = toBlocks(refined)
        if (lines.length) {
          const proposed = blocks
            .filter(
              (block) =>
                !(
                  block.y >= crop.top &&
                  block.y < crop.top + crop.height &&
                  block.x + block.width / 2 >= crop.left &&
                  block.x + block.width / 2 < crop.left + crop.width
                )
            )
            .concat(lines)
          // A crop can make decorative/Arabic lettering less readable. Keep
          // the first pass unless the retry yields a complete valid author.
          if (detectSpineText({ ...page, blocks: proposed }).studentName) blocks = proposed
        }
      }
    }
    return blocks
  } finally {
    window.clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
    worker?.terminate()
    if (workerBlob) URL.revokeObjectURL(workerBlob)
  }
}
