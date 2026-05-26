import type {
  BookletSheet,
  BookletSource,
  ExportImageFormat,
  ExportProgress,
  SheetSettings
} from '../types'
import { assertExportCanStart } from './exportPdf'
import { assertCanvasWithinLimit, assertNotCanceled, resetCanvas, yieldToUi } from './memoryCleanup'
import { getSheetLayoutMm } from './printSizes'
import { exportRenderQueue } from './renderQueue'
import {
  createCanvasRenderAssets,
  flattenSheetSides,
  getSheetSideFileName,
  releaseCanvasRenderAssets,
  renderCanvasSheetSide
} from './renderSheet'
import { mmToPixels } from './units'

export interface ExportedImage {
  blob: Blob
  fileName: string
}

interface ExportImagesOptions {
  signal?: AbortSignal
  onImage?: (image: ExportedImage) => Promise<void> | void
}

const STANDARD_EXPORT_DPI = 200
const HIGH_EXPORT_DPI = 300

export async function exportBookletImages(
  sheets: BookletSheet[],
  sources: BookletSource[],
  settings: SheetSettings,
  format: ExportImageFormat,
  onProgress: (progress: ExportProgress) => void,
  options: ExportImagesOptions = {}
): Promise<ExportedImage[]> {
  const signal = options.signal

  assertNotCanceled(signal)
  assertExportCanStart(sheets, settings)

  const sides = flattenSheetSides(sheets)
  const totalSides = sides.length
  const layout = getSheetLayoutMm(settings)
  const dpi = settings.exportQuality === 'high' ? HIGH_EXPORT_DPI : STANDARD_EXPORT_DPI
  const assets = createCanvasRenderAssets(sources)
  const exported: ExportedImage[] = []

  onProgress({
    phase: 'preparing-pages',
    current: 0,
    total: totalSides,
    message: 'Preparing pages for image export'
  })

  try {
    for (const side of sides) {
      assertNotCanceled(signal)

      onProgress({
        phase: 'rendering-page',
        current: exported.length,
        total: totalSides,
        message: `Rendering page ${exported.length + 1} of ${totalSides}: sheet ${side.sheetNumber} ${side.side}`
      })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Could not create a canvas context for sheet image export.')
      }

      try {
        canvas.width = mmToPixels(layout.paperSize.widthMm, dpi)
        canvas.height = mmToPixels(layout.paperSize.heightMm, dpi)
        assertCanvasWithinLimit(canvas.width, canvas.height, 'exporting montage sheets as images')
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)

        await exportRenderQueue.run(
          () => renderCanvasSheetSide(context, side, settings, layout, assets, dpi, signal),
          signal
        )

        const blob = await canvasToBlob(canvas, format, settings.exportQuality)
        const image = {
          blob,
          fileName: getSheetSideFileName(side.sheetNumber, side.side, format)
        }

        if (options.onImage) {
          await options.onImage(image)
        } else {
          exported.push(image)
        }
      } finally {
        resetCanvas(canvas)
      }

      onProgress({
        phase: 'rendering-page',
        current: exported.length,
        total: totalSides,
        message: `Rendered page ${exported.length} of ${totalSides}`
      })

      await yieldToUi()
    }
  } finally {
    await releaseCanvasRenderAssets(assets)
  }

  return exported
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ExportImageFormat,
  quality: SheetSettings['exportQuality']
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not export sheet image.'))
          return
        }

        resolve(blob)
      },
      format === 'png' ? 'image/png' : 'image/jpeg',
      format === 'png' ? undefined : quality === 'high' ? 0.98 : 0.92
    )
  })
}
