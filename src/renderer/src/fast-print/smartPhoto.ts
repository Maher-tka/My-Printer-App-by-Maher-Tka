import { InferenceSession, Tensor, env } from 'onnxruntime-web/wasm'
import wasmUrl from '../../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url'
import wasmModuleUrl from '../../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url'
import modelUrl from './models/face_detection_yunet_2023mar.onnx?url'
import {
  choosePhotoOrientation,
  choosePhotoPrintLayout,
  type PhotoFace
} from '../../../shared/polaroid-framing'

async function readAsset(url: string): Promise<Uint8Array> {
  try {
    const response = await fetch(url)
    if (response.ok || response.status === 0) return new Uint8Array(await response.arrayBuffer())
  } catch {
    /* Electron file:// can require XHR. */
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('GET', url, true)
    request.responseType = 'arraybuffer'
    request.onload = () =>
      request.status === 200 || request.status === 0
        ? resolve(new Uint8Array(request.response))
        : reject(new Error('Photo analysis asset unavailable.'))
    request.onerror = () => reject(new Error('Photo analysis asset unavailable.'))
    request.send()
  })
}

function overlap(a: PhotoFace, b: PhotoFace): number {
  const intersection =
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return intersection / (a.width * a.height + b.width * b.height - intersection)
}

export class SmartPhotoFramer {
  private session?: InferenceSession
  private unavailable = false
  private analysis = document.createElement('canvas')
  private rotated = document.createElement('canvas')

  private async detector(): Promise<InferenceSession> {
    if (!this.session) {
      env.wasm.numThreads = 1
      env.wasm.proxy = false
      env.wasm.wasmPaths = { mjs: wasmModuleUrl }
      env.wasm.wasmBinary = await readAsset(wasmUrl)
      this.session = await InferenceSession.create(await readAsset(modelUrl), {
        executionProviders: ['wasm'],
        intraOpNumThreads: 1,
        interOpNumThreads: 1
      })
    }
    return this.session
  }

  private async faces(
    image: CanvasImageSource,
    width: number,
    height: number,
    turns: number
  ): Promise<PhotoFace[]> {
    const size = 640
    const rotatedWidth = turns % 2 ? height : width
    const rotatedHeight = turns % 2 ? width : height
    const scale = Math.min(size / rotatedWidth, size / rotatedHeight)
    const sw = rotatedWidth * scale,
      sh = rotatedHeight * scale
    this.analysis.width = size
    this.analysis.height = size
    const context = this.analysis.getContext('2d', { willReadFrequently: true })!
    context.fillStyle = '#000000'
    context.fillRect(0, 0, size, size)
    context.save()
    context.translate(sw / 2, sh / 2)
    context.rotate((turns * Math.PI) / 2)
    context.drawImage(
      image,
      (-width * scale) / 2,
      (-height * scale) / 2,
      width * scale,
      height * scale
    )
    context.restore()
    const rgba = context.getImageData(0, 0, size, size).data
    const pixels = size * size
    const input = new Float32Array(pixels * 3)
    for (let i = 0; i < pixels; i++) {
      input[i] = rgba[i * 4 + 2]
      input[i + pixels] = rgba[i * 4 + 1]
      input[i + pixels * 2] = rgba[i * 4]
    }
    const session = await this.detector()
    const tensor = new Tensor('float32', input, [1, 3, size, size])
    let output: Awaited<ReturnType<InferenceSession['run']>> | undefined
    try {
      output = await session.run({ [session.inputNames[0]]: tensor })
      const found: PhotoFace[] = []
      for (const stride of [8, 16, 32]) {
        const cls = output[`cls_${stride}`].data as Float32Array,
          obj = output[`obj_${stride}`].data as Float32Array
        const boxes = output[`bbox_${stride}`].data as Float32Array,
          points = output[`kps_${stride}`].data as Float32Array
        const columns = size / stride
        for (let i = 0; i < cls.length; i++) {
          const confidence = Math.sqrt(
            Math.max(0, Math.min(1, cls[i])) * Math.max(0, Math.min(1, obj[i]))
          )
          if (confidence < 0.65) continue
          const row = Math.floor(i / columns),
            col = i % columns
          const w = Math.exp(boxes[i * 4 + 2]) * stride,
            h = Math.exp(boxes[i * 4 + 3]) * stride
          const x = ((col + boxes[i * 4]) * stride - w / 2) / sw,
            y = ((row + boxes[i * 4 + 1]) * stride - h / 2) / sh
          const eyeY = (points[i * 10 + 1] + points[i * 10 + 3]) / 2
          const mouthY = (points[i * 10 + 7] + points[i * 10 + 9]) / 2
          const eyeSlope = Math.abs(points[i * 10 + 1] - points[i * 10 + 3]) * stride
          // Count only plausible upright eyes/mouth; a sideways false positive must not vote for rotation.
          if (
            mouthY - eyeY < (h / stride) * 0.12 ||
            eyeSlope > h * 0.45 ||
            x < -0.1 ||
            y < -0.1 ||
            x + w / sw > 1.1 ||
            y + h / sh > 1.1
          )
            continue
          found.push({
            x: Math.max(0, x),
            y: Math.max(0, y),
            width: Math.min(w / sw, 1 - Math.max(0, x)),
            height: Math.min(h / sh, 1 - Math.max(0, y)),
            confidence
          })
        }
      }
      const kept: PhotoFace[] = []
      for (const face of found.sort((a, b) => b.confidence - a.confidence)) {
        if (kept.length === 100) break
        if (kept.every((previous) => overlap(previous, face) < 0.3)) kept.push(face)
      }
      return kept
    } finally {
      tensor.dispose()
      Object.values(output ?? {}).forEach((value) => value.dispose())
    }
  }

  async prepare(
    image: CanvasImageSource,
    width: number,
    height: number,
    targetWidth: number,
    targetHeight: number
  ) {
    let orientation = { turns: 0, faces: [] as PhotoFace[] }
    if (!this.unavailable) {
      try {
        const candidates = []
        for (const turns of [0, 1, 2, 3]) {
          candidates.push({ turns, faces: await this.faces(image, width, height, turns) })
          await new Promise((resolve) => setTimeout(resolve, 0))
        }
        orientation = choosePhotoOrientation(candidates)
      } catch (error) {
        this.unavailable = true
        console.warn('Smart photo analysis unavailable; preserving full photos.', error)
      }
    }
    const uprightWidth = orientation.turns % 2 ? height : width
    const uprightHeight = orientation.turns % 2 ? width : height
    const placement = choosePhotoPrintLayout(
      uprightWidth,
      uprightHeight,
      targetWidth,
      targetHeight,
      orientation.faces
    )
    const turns = (orientation.turns + placement.turns) % 4
    let artwork = image
    const orientedWidth = turns % 2 ? height : width
    const orientedHeight = turns % 2 ? width : height
    if (turns) {
      this.rotated.width = orientedWidth
      this.rotated.height = orientedHeight
      const context = this.rotated.getContext('2d')!
      context.translate(orientedWidth / 2, orientedHeight / 2)
      context.rotate((turns * Math.PI) / 2)
      context.drawImage(image, -width / 2, -height / 2, width, height)
      artwork = this.rotated
    }
    return {
      artwork,
      width: orientedWidth,
      height: orientedHeight,
      ...placement,
      turns,
      layoutTurns: placement.turns
    }
  }

  async dispose() {
    await this.session?.release()
    this.session = undefined
    this.analysis.width = 0
    this.analysis.height = 0
    this.rotated.width = 0
    this.rotated.height = 0
  }
}
