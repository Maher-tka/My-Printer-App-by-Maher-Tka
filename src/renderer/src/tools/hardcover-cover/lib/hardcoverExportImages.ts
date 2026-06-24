import { safeFileName } from '@/lib/fileNaming'
import type { HardcoverProjectState } from '../types'
import { buildHardcoverSvg } from './hardcoverExportSvg'

export async function exportHardcoverImage(
  state: HardcoverProjectState,
  format: 'png' | 'jpeg' = 'jpeg'
): Promise<{ bytes: Uint8Array; fileName: string; mimeType: string }> {
  const svg = buildHardcoverSvg({
    ...state,
    exportSettings: {
      ...state.exportSettings,
      mode: 'customer-preview',
      includeCropMarks: false,
      includeFoldLines: false,
      includeSafeZones: false
    }
  })
  const scale =
    state.exportSettings.imageQuality === 'high'
      ? 4
      : state.exportSettings.imageQuality === 'low'
        ? 1.5
        : 2.5
  const bytes = await svgToImageBytes(svg, format, scale)
  const extension = format === 'jpeg' ? 'jpg' : 'png'
  return {
    bytes,
    fileName: `hardcover_mockup_${safeFileName(state.content.front.studentName, 'Student')}.${extension}`,
    mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png'
  }
}

async function svgToImageBytes(
  svg: string,
  format: 'png' | 'jpeg',
  scale: number
): Promise<Uint8Array> {
  const widthMatch = /width="([\d.]+)mm"/.exec(svg)
  const heightMatch = /height="([\d.]+)mm"/.exec(svg)
  const widthMm = Number(widthMatch?.[1] ?? 480)
  const heightMm = Number(heightMatch?.[1] ?? 337)
  const pixelsPerMm = 3.7795 * scale
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(widthMm * pixelsPerMm))
  canvas.height = Math.max(1, Math.round(heightMm * pixelsPerMm))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas image export is unavailable.')
  const image = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not render the hardcover preview image.'))
      image.src = url
    })
    if (format === 'jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error('Could not encode the cover image.')),
        format === 'jpeg' ? 'image/jpeg' : 'image/png',
        0.9
      )
    )
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(url)
  }
}
