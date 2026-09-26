import { safeFileName } from '@/lib/fileNaming'
import type {
  CoverDimensions,
  CoverZone,
  HardcoverPdfFitMode,
  HardcoverPdfPagePosition,
  HardcoverPdfSource,
  HardcoverProjectState,
  SpineTextLayout
} from '../types'
import { calculateCoverDimensions } from './coverCalculations'
import { hasHardcoverPdfSourceBytes } from './sourcePdf'
import { normalizePdfPagePosition } from './pdfPosition'
import { getSpineBackgroundFill } from './spineBackground'
import { calculateSpineTextLayout } from './spineTextLayout'
import { isRtlText, wrapTextByCharacters } from './textFit'

const SOURCE_PDF_SPINE_TEXT_COLOR = '#0f172a'

export function buildHardcoverSvg(
  state: HardcoverProjectState,
  options: { idPrefix?: string } = {}
): string {
  const dimensions = calculateCoverDimensions(state.setup)
  const { content, exportSettings } = state
  const showProductionGuides = exportSettings.mode === 'production-guide'
  const showGuides = showProductionGuides || exportSettings.includeFoldLines
  const showSafeZones = showProductionGuides || exportSettings.includeSafeZones
  const showZoneFills = showProductionGuides || exportSettings.mode === 'customer-preview'
  const frontSourcePreview = getSourcePagePreview(state.sourcePdf, 'front')
  const backSourcePreview = getSourcePagePreview(state.sourcePdf, 'back')
  const drawManualArtwork = !state.sourcePdf
  const spineLayout = calculateSpineTextLayout(
    content.spine,
    state.setup.spineWidthMm,
    dimensions.spine.heightMm - state.setup.hingeMm * 2
  )

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${round(dimensions.fullWidthMm)}mm" height="${round(dimensions.fullHeightMm)}mm" viewBox="0 0 ${round(dimensions.fullWidthMm)} ${round(dimensions.fullHeightMm)}">
  <title>${escapeXml(content.front.studentName || 'Hardcover cover')}</title>
  <metadata>Created by My Printer App by Maher Tka; ${new Date().toISOString()}; ${round(dimensions.fullWidthMm)} x ${round(dimensions.fullHeightMm)} mm; ${escapeXml(exportSettings.mode)}</metadata>
  <defs>
    <linearGradient id="coverBackground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${escapeXml(state.template.background)}"/><stop offset="1" stop-color="${escapeXml(state.template.backgroundAccent)}"/></linearGradient>
    <filter id="leather"><feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="8" result="noise"/><feBlend in="SourceGraphic" in2="noise" mode="multiply"/></filter>
  </defs>
  <rect id="PrinterSheet" width="100%" height="100%" fill="#ffffff"/>
  ${physicalZoneMarkup(dimensions, state, showZoneFills)}
  <g id="Artwork" data-template="${escapeXml(state.template.name)}">
    ${
      drawManualArtwork
        ? manualArtworkMarkup(dimensions, state)
        : sourcePdfArtworkMarkup(
            dimensions,
            state,
            frontSourcePreview,
            backSourcePreview,
            getSourceFitMode(state.sourcePdf, 'front'),
            getSourceFitMode(state.sourcePdf, 'back')
          )
    }
    ${spineTextMarkup(spineLayout, dimensions, state)}
  </g>
  ${showGuides ? guideMarkup(dimensions) : ''}
  ${showSafeZones ? safeZoneMarkup(dimensions) : ''}
  ${exportSettings.includeCropMarks ? cropMarkMarkup(dimensions) : ''}
</svg>`

  return options.idPrefix ? namespaceSvgIds(svg, options.idPrefix) : svg
}

function sourcePdfArtworkMarkup(
  dimensions: CoverDimensions,
  state: HardcoverProjectState,
  frontSourcePreview: string | undefined,
  backSourcePreview: string | undefined,
  frontFitMode: HardcoverPdfFitMode,
  backFitMode: HardcoverPdfFitMode
): string {
  const frontFit = frontFitMode === 'fill' ? 'cover' : 'contain'
  const backFit = backFitMode === 'fill' ? 'cover' : 'contain'
  const frontPosition = getSourcePosition(state.sourcePdf, 'front')
  const backPosition = getSourcePosition(state.sourcePdf, 'back')
  const backExpected = Boolean(state.sourcePdf?.backCoverEnabled)

  return `
    ${frontSourcePreview ? positionedSourceImageMarkup(frontSourcePreview, dimensions.front, frontFit, frontPosition, 'front') : missingSourceMarkup('front', dimensions.front)}
    ${
      backExpected
        ? backSourcePreview
          ? positionedSourceImageMarkup(
              backSourcePreview,
              dimensions.back,
              backFit,
              backPosition,
              'back'
            )
          : missingSourceMarkup('back', dimensions.back)
        : ''
    }`
}

export function exportHardcoverSvg(state: HardcoverProjectState): {
  bytes: Uint8Array
  fileName: string
  mimeType: string
} {
  assertSvgSourceReady(state)
  const svg = buildHardcoverSvg(state)
  return {
    bytes: new TextEncoder().encode(svg),
    fileName: `hardcover_cover_${safeFileName(state.content.front.studentName, 'Student')}_${safeFileName(state.content.front.academicYear, 'Year')}.svg`,
    mimeType: 'image/svg+xml'
  }
}

function getSourcePagePreview(
  source: HardcoverPdfSource | undefined,
  target: 'front' | 'back'
): string | undefined {
  if (!source) return undefined

  const coverSource = target === 'front' ? source.frontSource : source.backSource
  if (source.sourceMode === 'separate' || coverSource) {
    if (!coverSource || (target === 'back' && !source.backCoverEnabled)) return undefined
    return (
      coverSource.thumbnailDataUrl ??
      coverSource.pagePreviews?.find((preview) => preview.pageNumber === coverSource.pageNumber)
        ?.thumbnailDataUrl
    )
  }

  if (target === 'back' && !source.backCoverEnabled) return undefined
  const pageNumber = target === 'front' ? source.frontPageNumber : source.backPageNumber
  if (!pageNumber) return undefined

  return target === 'front'
    ? (source.thumbnailDataUrl ??
        source.pagePreviews?.find((preview) => preview.pageNumber === pageNumber)?.thumbnailDataUrl)
    : (source.backThumbnailDataUrl ??
        source.pagePreviews?.find((preview) => preview.pageNumber === pageNumber)?.thumbnailDataUrl)
}

function getSourceFitMode(
  source: HardcoverPdfSource | undefined,
  target: 'front' | 'back'
): HardcoverPdfFitMode {
  if (!source) return 'fit'
  if (source.sourceMode === 'separate' || source.frontSource || source.backSource) {
    const coverSource = target === 'front' ? source.frontSource : source.backSource
    return coverSource?.fitMode ?? 'fit'
  }
  return source.fitMode
}

function getSourcePosition(
  source: HardcoverPdfSource | undefined,
  target: 'front' | 'back'
): HardcoverPdfPagePosition {
  if (!source) return normalizePdfPagePosition(undefined)
  if (source.sourceMode === 'separate' || source.frontSource || source.backSource) {
    const coverSource = target === 'front' ? source.frontSource : source.backSource
    return normalizePdfPagePosition(coverSource?.position)
  }
  return normalizePdfPagePosition(target === 'front' ? source.frontPosition : source.backPosition)
}

function missingSourceMarkup(side: 'front' | 'back', zone: CoverZone): string {
  const label = side === 'front' ? 'Front' : 'Back'
  return `<g data-source-status="missing-${side}"><rect x="${round(zone.xMm)}" y="${round(zone.yMm)}" width="${round(zone.widthMm)}" height="${round(zone.heightMm)}" fill="#fff7ed" stroke="#f97316" stroke-width="0.6"/><text x="${round(zone.xMm + zone.widthMm / 2)}" y="${round(zone.yMm + zone.heightMm / 2)}" fill="#9a3412" font-family="Arial, sans-serif" font-size="5" text-anchor="middle">Re-upload ${label} PDF</text></g>`
}

function assertSvgSourceReady(state: HardcoverProjectState): void {
  const source = state.sourcePdf
  if (!source) return

  if (!hasHardcoverPdfSourceBytes(source)) {
    throw new Error(
      source.sourceMode === 'separate'
        ? 'Re-upload the independent front and back cover PDFs before exporting SVG.'
        : 'Upload the memoire PDF again before exporting SVG.'
    )
  }

  if (!getSourcePagePreview(source, 'front')) {
    throw new Error(
      'The selected front-cover page preview is unavailable. Re-upload the source PDF.'
    )
  }
  if (source.backCoverEnabled && !getSourcePagePreview(source, 'back')) {
    throw new Error(
      'The selected back-cover page preview is unavailable. Re-upload the source PDF.'
    )
  }
}

function manualArtworkMarkup(dimensions: CoverDimensions, state: HardcoverProjectState): string {
  const { template, content } = state
  const titleLines = wrapTextByCharacters(content.front.title, 32).slice(0, 4)
  const summaryLines = wrapTextByCharacters(content.back.summary, 42).slice(0, 9)
  const direction = isRtlText(content.front.title) ? 'rtl' : content.front.direction

  return `
    <rect width="100%" height="100%" fill="url(#coverBackground)"${template.decorativeStyle === 'leather' ? ' filter="url(#leather)"' : ''}/>
    ${spineBackgroundMarkup(dimensions, state)}
    ${decorativeMarkup(dimensions, state)}
    ${imageMarkup(content.front.backgroundDataUrl, dimensions.front, 'cover')}
    ${imageMarkup(content.front.logoDataUrl, logoZone(dimensions.front, template.logoPlacement), 'contain')}
    ${imageMarkup(content.back.logoDataUrl, logoZone(dimensions.back, 'bottom'), 'contain')}
    ${textLinesMarkup(titleLines, dimensions.front.xMm + dimensions.front.widthMm / 2, dimensions.front.yMm + dimensions.front.heightMm * 0.36, Math.min(11, dimensions.front.widthMm / 15), template.foreground, template.titleFontFamily, 'middle', direction)}
    <text x="${round(dimensions.front.xMm + dimensions.front.widthMm / 2)}" y="${round(dimensions.front.yMm + dimensions.front.heightMm * 0.17)}" fill="${escapeXml(template.foreground)}" font-family="${escapeXml(template.fontFamily)}" font-size="6" font-weight="700" text-anchor="middle" direction="${direction}">${escapeXml(content.front.studentName)}</text>
    <text x="${round(dimensions.front.xMm + dimensions.front.widthMm / 2)}" y="${round(dimensions.front.yMm + dimensions.front.heightMm * 0.68)}" fill="${escapeXml(template.mutedForeground)}" font-family="${escapeXml(template.fontFamily)}" font-size="4.2" text-anchor="middle">${escapeXml(content.front.degree)}</text>
    <text x="${round(dimensions.front.xMm + dimensions.front.widthMm / 2)}" y="${round(dimensions.front.yMm + dimensions.front.heightMm * 0.76)}" fill="${escapeXml(template.mutedForeground)}" font-family="${escapeXml(template.fontFamily)}" font-size="4.2" text-anchor="middle">${escapeXml(content.front.university)}</text>
    <text x="${round(dimensions.front.xMm + dimensions.front.widthMm / 2)}" y="${round(dimensions.front.yMm + dimensions.front.heightMm * 0.86)}" fill="${escapeXml(template.foreground)}" font-family="${escapeXml(template.fontFamily)}" font-size="5" font-weight="700" text-anchor="middle">${escapeXml(content.front.academicYear)}</text>
    ${textLinesMarkup(summaryLines, dimensions.back.xMm + 14, dimensions.back.yMm + dimensions.back.heightMm * 0.31, 4, template.mutedForeground, template.fontFamily, 'start', isRtlText(content.back.summary) ? 'rtl' : content.back.direction)}
    <text x="${round(dimensions.back.xMm + dimensions.back.widthMm / 2)}" y="${round(dimensions.back.yMm + dimensions.back.heightMm * 0.87)}" fill="${escapeXml(template.mutedForeground)}" font-family="${escapeXml(template.fontFamily)}" font-size="3.6" text-anchor="middle">${escapeXml(content.back.contactInfo)}</text>`
}

function physicalZoneMarkup(
  dimensions: CoverDimensions,
  state: HardcoverProjectState,
  showBoardFills: boolean
): string {
  const labels = showBoardFills
    ? `${zoneLabel('Back', dimensions.back)}${zoneLabel('Front', dimensions.front)}${zoneLabel('Spine', dimensions.spine)}${zoneLabel('Band', dimensions.leftBand)}${zoneLabel('Band', dimensions.rightBand)}`
    : ''
  const boardFill = showBoardFills
    ? `${zoneRect(dimensions.back, '#f8fafc', 0.7)}${zoneRect(dimensions.front, '#f8fafc', 0.7)}`
    : ''
  const spineFill = spineBackgroundMarkup(dimensions, state)

  return `<g id="PhysicalZones">
    ${boardFill}
    ${spineFill}
    ${labels}
  </g>`
}

function zoneRect(zone: CoverZone, fill: string, opacity: number): string {
  return `<rect x="${round(zone.xMm)}" y="${round(zone.yMm)}" width="${round(zone.widthMm)}" height="${round(zone.heightMm)}" fill="${escapeXml(fill)}" opacity="${round(opacity)}"/>`
}

function spineBackgroundMarkup(dimensions: CoverDimensions, state: HardcoverProjectState): string {
  const fill = getSpineBackgroundFill(state)

  return fill.shouldDraw ? zoneRect(dimensions.spine, fill.color, 1) : ''
}

function zoneLabel(label: string, zone: CoverZone): string {
  return `<text x="${round(zone.xMm + zone.widthMm / 2)}" y="${round(zone.yMm + 5)}" fill="#475569" font-family="Arial, sans-serif" font-size="3.2" text-anchor="middle">${escapeXml(label)}</text>`
}

function decorativeMarkup(dimensions: CoverDimensions, state: HardcoverProjectState): string {
  const { template } = state
  const front = dimensions.front
  const back = dimensions.back
  if (template.decorativeStyle === 'minimal') return ''
  if (template.decorativeStyle === 'frame' || template.decorativeStyle === 'foil') {
    return `<rect x="${round(front.xMm + 8)}" y="${round(front.yMm + 8)}" width="${round(front.widthMm - 16)}" height="${round(front.heightMm - 16)}" fill="none" stroke="${escapeXml(template.backgroundAccent)}" stroke-width="1"/><rect x="${round(back.xMm + 8)}" y="${round(back.yMm + 8)}" width="${round(back.widthMm - 16)}" height="${round(back.heightMm - 16)}" fill="none" stroke="${escapeXml(template.backgroundAccent)}" stroke-width="1"/>`
  }
  if (!state.content.front.showDecorativeLine) return ''
  return `<path d="M ${round(front.xMm + 18)} ${round(front.yMm + front.heightMm * 0.55)} H ${round(front.xMm + front.widthMm - 18)}" stroke="${escapeXml(template.backgroundAccent)}" stroke-width="1.2"/>`
}

function spineTextMarkup(
  layout: SpineTextLayout,
  dimensions: CoverDimensions,
  state: HardcoverProjectState
): string {
  if (layout.items.length === 0) return ''

  const x = dimensions.spine.xMm + dimensions.spine.widthMm / 2
  const topY = dimensions.spine.yMm + state.setup.hingeMm
  const angle = state.content.spine.direction === 'bottom-to-top' ? -90 : 90
  const textColor = state.sourcePdf ? SOURCE_PDF_SPINE_TEXT_COLOR : state.template.foreground
  const groups = layout.items
    .map((item) => {
      const y = topY + item.centerFromTopMm
      const fontSizeMm = item.fontSizePt * 0.352778
      const lineHeightMm = fontSizeMm * 1.18
      const firstLineOffset = -((item.lines.length - 1) * lineHeightMm) / 2
      const lines = item.lines
        .map((line, index) => {
          const offset = firstLineOffset + index * lineHeightMm

          return `<text x="0" y="${round(offset)}" fill="${escapeXml(textColor)}" font-family="${escapeXml(state.template.fontFamily)}" font-size="${round(fontSizeMm)}" font-weight="700" text-anchor="middle" dominant-baseline="middle" direction="${isRtlText(line) ? 'rtl' : 'ltr'}">${escapeXml(line)}</text>`
        })
        .join('')

      return `<g id="SpineText-${item.role}" transform="translate(${round(x)} ${round(y)}) rotate(${angle})">${lines}</g>`
    })
    .join('')

  return `<g id="SpineText">${groups}</g>`
}

function guideMarkup(dimensions: CoverDimensions): string {
  return `<g id="BindingEdgeMarks" fill="none" stroke="#e11d48" stroke-width="0.45" stroke-dasharray="3 2">${dimensions.guideMarks.map((mark) => `<path d="M ${round(mark.xMm)} ${round(mark.yStartMm)} V ${round(mark.yEndMm)}"/>`).join('')}</g>`
}

function safeZoneMarkup(dimensions: CoverDimensions): string {
  return `<g id="SafeZones" fill="none" stroke="#f59e0b" stroke-width="0.35" stroke-dasharray="2 2">${[dimensions.safeBack, dimensions.safeSpine, dimensions.safeFront].map((zone) => `<rect x="${round(zone.xMm)}" y="${round(zone.yMm)}" width="${round(zone.widthMm)}" height="${round(zone.heightMm)}"/>`).join('')}</g>`
}

function cropMarkMarkup(dimensions: CoverDimensions): string {
  const w = dimensions.fullWidthMm
  const h = dimensions.fullHeightMm
  return `<g id="CropMarks" stroke="#111" stroke-width="0.3"><path d="M 0 5 H 4 M 5 0 V 4 M ${round(w - 4)} 5 H ${round(w)} M ${round(w - 5)} 0 V 4 M 0 ${round(h - 5)} H 4 M 5 ${round(h - 4)} V ${round(h)} M ${round(w - 4)} ${round(h - 5)} H ${round(w)} M ${round(w - 5)} ${round(h - 4)} V ${round(h)}"/></g>`
}

function logoZone(
  zone: CoverDimensions['front'],
  placement: 'top' | 'center' | 'bottom'
): CoverDimensions['front'] {
  const heightMm = Math.min(38, zone.heightMm * 0.18)
  const yMm =
    placement === 'top'
      ? zone.yMm + 15
      : placement === 'bottom'
        ? zone.yMm + zone.heightMm - heightMm - 15
        : zone.yMm + zone.heightMm / 2 - heightMm / 2
  return { xMm: zone.xMm + zone.widthMm / 2 - heightMm / 2, yMm, widthMm: heightMm, heightMm }
}

function imageMarkup(
  dataUrl: string | undefined,
  zone: CoverDimensions['front'],
  preserveAspect: 'cover' | 'contain'
): string {
  if (!dataUrl) return ''
  return `<image href="${escapeXml(dataUrl)}" x="${round(zone.xMm)}" y="${round(zone.yMm)}" width="${round(zone.widthMm)}" height="${round(zone.heightMm)}" preserveAspectRatio="xMidYMid ${preserveAspect === 'cover' ? 'slice' : 'meet'}"/>`
}

function positionedSourceImageMarkup(
  dataUrl: string,
  zone: CoverDimensions['front'],
  preserveAspect: 'cover' | 'contain',
  position: HardcoverPdfPagePosition,
  side: 'front' | 'back'
): string {
  const normalizedPosition = normalizePdfPagePosition(position)
  const x = zone.xMm + zone.widthMm * (normalizedPosition.xPercent / 100)
  const y = zone.yMm - zone.heightMm * (normalizedPosition.yPercent / 100)
  const clipId = `source-${side}-clip`

  return `<g data-source-position="${side}" data-position-x="${normalizedPosition.xPercent}" data-position-y="${normalizedPosition.yPercent}"><defs><clipPath id="${clipId}"><rect x="${round(zone.xMm)}" y="${round(zone.yMm)}" width="${round(zone.widthMm)}" height="${round(zone.heightMm)}"/></clipPath></defs><image href="${escapeXml(dataUrl)}" x="${round(x)}" y="${round(y)}" width="${round(zone.widthMm)}" height="${round(zone.heightMm)}" preserveAspectRatio="xMidYMid ${preserveAspect === 'cover' ? 'slice' : 'meet'}" clip-path="url(#${clipId})"/></g>`
}

function textLinesMarkup(
  lines: string[],
  x: number,
  y: number,
  size: number,
  color: string,
  family: string,
  anchor: 'start' | 'middle',
  direction: string
): string {
  return `<text x="${round(x)}" y="${round(y)}" fill="${escapeXml(color)}" font-family="${escapeXml(family)}" font-size="${round(size)}" font-weight="700" text-anchor="${anchor}" direction="${direction}">${lines.map((line, index) => `<tspan x="${round(x)}" dy="${index === 0 ? 0 : round(size * 1.25)}">${escapeXml(line)}</tspan>`).join('')}</text>`
}

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] ??
      character
  )
}

function round(value: number): number {
  return Number(value.toFixed(3))
}

function namespaceSvgIds(svg: string, prefix: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!safePrefix) return svg

  return svg
    .replace(/\bid="([^"]+)"/g, (_match, id: string) => `id="${safePrefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_match, id: string) => `url(#${safePrefix}-${id})`)
}
