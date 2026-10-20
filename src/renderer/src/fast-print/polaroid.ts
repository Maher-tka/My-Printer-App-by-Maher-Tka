import type { FastPrintBatchSource } from '../../../shared/fast-print'
import { FAST_PRINT_MAX_PAGES } from '../../../shared/fast-print-batch'
import { polaroidLayout, type PolaroidMode } from '../../../shared/fast-print-polaroid'
import { loadPdfDocument, destroyPdfDocument } from '../tools/booklet-montage/lib/pdfWorker'
import { polaroidDecodeOptions } from './polaroidImage'
import { SmartPhotoFramer } from './smartPhoto'

export async function printPolaroid(batch: FastPrintBatchSource): Promise<void> {
  const layout = polaroidLayout(batch.preset.mode as PolaroidMode)
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  const context = canvas.getContext('2d')!
  const progress = document.getElementById('progress') as HTMLProgressElement
  progress.max = batch.files.length
  const label = (id: string, text: string) => {
    document.getElementById(id)!.textContent = text
  }
  label(
    'preset',
    `${batch.preset.printer} · ${layout.photos.length} PIC · A4 · ${batch.preset.color ? 'Color' : 'Black & white'}`
  )
  let slot = 0
  let pages = 0
  let sheets = 0
  const framer = new SmartPhotoFramer()
  function clear() {
    context.filter = 'none'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  async function flush() {
    if (!slot) return
    context.filter = 'none'
    context.strokeStyle = '#000000'
    context.lineWidth = layout.cutLineWidth
    context.beginPath()
    for (const x of layout.cutXs) {
      context.moveTo(x, 0)
      context.lineTo(x, canvas.height)
    }
    for (const y of layout.cutYs) {
      context.moveTo(0, y)
      context.lineTo(canvas.width, y)
    }
    context.stroke()
    await window.fastPrint.sheet(canvas.toDataURL('image/png'))
    sheets++
    slot = 0
    clear()
  }
  async function place(image: CanvasImageSource, width: number, height: number) {
    if (++pages > FAST_PRINT_MAX_PAGES)
      throw new Error(`Choose up to ${FAST_PRINT_MAX_PAGES} photos or PDF pages.`)
    const photo = layout.photos[slot]
    const framed = await framer.prepare(image, width, height, photo.width, photo.height)
    const crop = framed.crop
    let x = photo.x,
      y = photo.y,
      drawWidth = photo.width,
      drawHeight = photo.height
    if (framed.fit === 'contain') {
      const scale = Math.min(photo.width / framed.width, photo.height / framed.height)
      drawWidth = framed.width * scale
      drawHeight = framed.height * scale
      x += (photo.width - drawWidth) / 2
      y += (photo.height - drawHeight) / 2
    }
    context.filter = batch.preset.color ? 'none' : 'grayscale(1)'
    context.drawImage(
      framed.artwork,
      crop.x * framed.width,
      crop.y * framed.height,
      crop.width * framed.width,
      crop.height * framed.height,
      x,
      y,
      drawWidth,
      drawHeight
    )
    console.info(
      '[polaroid-photo]',
      JSON.stringify({
        photo: pages,
        turns: framed.turns,
        layoutTurns: framed.layoutTurns,
        faces: framed.faces.length,
        faceBoxes: framed.faces,
        fit: framed.fit,
        crop
      })
    )
    slot++
    if (slot === layout.photos.length) await flush()
  }
  clear()
  try {
    for (let index = 0; index < batch.files.length; index++) {
      const source = await window.fastPrint.file(index)
      label('file', source.name)
      if (source.extension === '.pdf') {
        const pdf = await loadPdfDocument(new Uint8Array(source.bytes))
        try {
          if (pages + pdf.numPages > FAST_PRINT_MAX_PAGES)
            throw new Error(`Choose up to ${FAST_PRINT_MAX_PAGES} photos or PDF pages.`)
          for (let number = 1; number <= pdf.numPages; number++) {
            const page = await pdf.getPage(number)
            const photoCanvas = document.createElement('canvas')
            try {
              const original = page.getViewport({ scale: 1 })
              const target = layout.photos[slot]
              const viewport = page.getViewport({
                scale: Math.min(
                  2200 / Math.max(original.width, original.height),
                  Math.max(target.width / original.width, target.height / original.height)
                )
              })
              photoCanvas.width = Math.ceil(viewport.width)
              photoCanvas.height = Math.ceil(viewport.height)
              await page.render({
                canvas: photoCanvas,
                viewport,
                intent: 'print',
                background: '#ffffff'
              }).promise
              await place(photoCanvas, photoCanvas.width, photoCanvas.height)
            } finally {
              page.cleanup()
              photoCanvas.width = 0
              photoCanvas.height = 0
            }
          }
        } finally {
          await destroyPdfDocument(pdf)
        }
      } else {
        const target = layout.photos[slot]
        const image = await createImageBitmap(
          new Blob([new Uint8Array(source.bytes)]),
          polaroidDecodeOptions(source.bytes, source.extension, target.width, target.height)
        )
        try {
          await place(image, image.width, image.height)
        } finally {
          image.close()
        }
      }
      progress.value = index + 1
      label('status', `${pages} photos · ${sheets + (slot ? 1 : 0)} sheets. Close to cancel.`)
    }
    await flush()
    label('heading', 'Sending to your printer')
    const result = await window.fastPrint.submit()
    label('heading', result.verified ? 'Print settings verified' : 'Sent to print queue')
    label('status', `${pages} photos · ${sheets} sheets · ${batch.preset.printer}`)
    if (!batch.previewOnly) await new Promise((resolve) => setTimeout(resolve, 1600))
    await window.fastPrint.finish()
  } finally {
    await framer.dispose()
    canvas.width = 0
    canvas.height = 0
  }
}
