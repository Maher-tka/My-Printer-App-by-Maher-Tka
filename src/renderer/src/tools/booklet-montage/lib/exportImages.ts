import type {
  BookletSheet,
  BookletSource,
  EmptyMontageSheet,
  ExportImageFormat,
  ExportProgress,
  SheetSettings
} from '../types'
import { normalizeHex } from './colorUtils'
import { assertExportCanStart } from './exportPdf'
import { assertCanvasWithinLimit, assertNotCanceled, resetCanvas, yieldToUi } from './memoryCleanup'
import { getSheetLayoutMm } from './printSizes'
import { exportRenderQueue } from './renderQueue'
import {
  createCanvasRenderAssets,
  flattenSheetSides,
  releaseCanvasRenderAssets,
  renderCanvasSheetSide
} from './renderSheet'
import { getNumberedMontageImageFileName } from './exportNaming'
import { mmToPixels } from './units'

export { getBookletImageExportFolderName } from './exportNaming'

export interface ExportedImage {
  blob: Blob
  fileName: string
}

interface ExportImagesOptions {
  signal?: AbortSignal
  emptySheets?: EmptyMontageSheet[]
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
  const emptySheets = options.emptySheets ?? []

  assertNotCanceled(signal)
  assertExportCanStart(sheets, settings, emptySheets.length)

  const sides = flattenSheetSides(sheets)
  const totalPages = sides.length + emptySheets.length
  const layout = getSheetLayoutMm(settings)
  const dpi = settings.exportQuality === 'high' ? HIGH_EXPORT_DPI : STANDARD_EXPORT_DPI
  const assets = createCanvasRenderAssets(sources)
  const exported: ExportedImage[] = []
  let renderedCount = 0

  onProgress({
    phase: 'preparing-pages',
    current: 0,
    total: totalPages,
    message: 'Preparing pages for image export'
  })

  try {
    for (const side of sides) {
      assertNotCanceled(signal)

      onProgress({
        phase: 'rendering-page',
        current: renderedCount,
        total: totalPages,
        message: `Rendering page ${renderedCount + 1} of ${totalPages}: sheet ${side.sheetNumber} ${side.side}`
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
          fileName: getNumberedMontageImageFileName(renderedCount + 1, format)
        }

        if (options.onImage) {
          await options.onImage(image)
        } else {
          exported.push(image)
        }

        renderedCount += 1
      } finally {
        resetCanvas(canvas)
      }

      onProgress({
        phase: 'rendering-page',
        current: renderedCount,
        total: totalPages,
        message: `Rendered page ${renderedCount} of ${totalPages}`
      })

      await yieldToUi()
    }

    for (const emptySheet of emptySheets) {
      assertNotCanceled(signal)

      onProgress({
        phase: 'rendering-page',
        current: renderedCount,
        total: totalPages,
        message: `Rendering page ${renderedCount + 1} of ${totalPages}: ${emptySheet.label}`
      })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Could not create a canvas context for empty sheet image export.')
      }

      try {
        canvas.width = mmToPixels(layout.paperSize.widthMm, dpi)
        canvas.height = mmToPixels(layout.paperSize.heightMm, dpi)
        assertCanvasWithinLimit(canvas.width, canvas.height, 'exporting empty montage sheets as images')
        context.fillStyle = normalizeHex(emptySheet.colorHex) ?? '#FFFFFF'
        context.fillRect(0, 0, canvas.width, canvas.height)

        const blob = await canvasToBlob(canvas, format, settings.exportQuality)
        const image = {
          blob,
          fileName: getNumberedMontageImageFileName(renderedCount + 1, format)
        }

        if (options.onImage) {
          await options.onImage(image)
        } else {
          exported.push(image)
        }

        renderedCount += 1
      } finally {
        resetCanvas(canvas)
      }

      onProgress({
        phase: 'rendering-page',
        current: renderedCount,
        total: totalPages,
        message: `Rendered page ${renderedCount} of ${totalPages}`
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
