import {
  PDFDocument,
  degrees,
  rgb,
  type PDFEmbeddedPage,
  type PDFImage,
  type PDFPage,
  type PDFFont
} from 'pdf-lib'
import { safeFileName } from '@/lib/fileNaming'
import type { BatchStudent, HardcoverProjectState } from '../types'
import { calculateCoverDimensions } from './coverCalculations'
import { embedHardcoverPdfFonts, type HardcoverPdfFonts } from './hardcoverPdfFonts'
import { preparePdfDisplayText } from './pdfText'
import { calculateSpineTextLayout } from './spineTextLayout'
import { wrapTextByCharacters } from './textFit'
import { mmToPoints } from './units'

interface EmbeddedSourcePages {
  front?: PDFEmbeddedPage
  back?: PDFEmbeddedPage
}

export async function exportHardcoverPdf(state: HardcoverProjectState): Promise<{
  bytes: Uint8Array
  fileName: string
  mimeType: string
}> {
  const bytes = await buildHardcoverPdf([state])
  const suffix = state.exportSettings.mode === 'production-guide' ? '_production-guide' : ''
  return {
    bytes,
    fileName: `hardcover_cover_${safeFileName(state.content.front.studentName, 'Student')}${suffix}.pdf`,
    mimeType: 'application/pdf'
  }
}

export async function exportHardcoverBatchPdf(
  state: HardcoverProjectState,
  students: BatchStudent[]
): Promise<Uint8Array> {
  const states = students.map((student) => applyStudent(state, student))
  return buildHardcoverPdf(states)
}

export function applyStudent(
  state: HardcoverProjectState,
  student: BatchStudent
): HardcoverProjectState {
  const academicYear =
    student.year.trim() || state.content.spine.year.trim() || state.content.front.academicYear

  return {
    ...state,
    content: {
      ...state.content,
      front: {
        ...state.content.front,
        studentName: student.studentName,
        title: student.title,
        department: student.department,
        supervisor: student.supervisor,
        academicYear
      },
      spine: {
        ...state.content.spine,
        studentName: student.studentName,
        shortTitle: student.spineTitle || student.title,
        year: academicYear
      }
    }
  }
}

async function buildHardcoverPdf(states: HardcoverProjectState[]): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle('Hardcover Cover Sheet')
  document.setCreator('My Printer App by Maher Tka')
  const fonts = await embedHardcoverPdfFonts(document)

  for (const state of states) {
    await drawCoverPage(document, state, fonts)
  }

  return document.save()
}

async function drawCoverPage(
  document: PDFDocument,
  state: HardcoverProjectState,
  fonts: HardcoverPdfFonts
): Promise<void> {
  const dimensions = calculateCoverDimensions(state.setup)
  const page = document.addPage([
    mmToPoints(dimensions.fullWidthMm),
    mmToPoints(dimensions.fullHeightMm)
  ])
  const background = parseHex(state.template.background)
  const accent = parseHex(state.template.backgroundAccent)
  const foreground = parseHex(state.template.foreground)
  const muted = parseHex(state.template.mutedForeground)
  const sourcePages = await embedSelectedSourcePages(document, state)
  const spineTextColor = sourcePages.front ? rgb(0.06, 0.09, 0.16) : foreground

  page.drawRectangle({
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
    color: sourcePages.front ? rgb(1, 1, 1) : background
  })
  drawPhysicalAreas(page, state, dimensions, sourcePages.front ? undefined : accent)

  if (sourcePages.front) {
    drawEmbeddedPdfPageInZone(
      page,
      sourcePages.front,
      dimensions.front,
      state.sourcePdf?.fitMode ?? 'fit'
    )
    if (sourcePages.back) {
      drawEmbeddedPdfPageInZone(
        page,
        sourcePages.back,
        dimensions.back,
        state.sourcePdf?.fitMode ?? 'fit'
      )
    }
    drawSpineText(page, state, dimensions, fonts.bold, spineTextColor)
  } else {
    const frontBackground = await embedDataImage(document, state.content.front.backgroundDataUrl)
    const frontLogo = await embedDataImage(document, state.content.front.logoDataUrl)
    const backLogo = await embedDataImage(document, state.content.back.logoDataUrl)
    if (frontBackground) drawImageInZone(page, frontBackground, dimensions.front, 'cover')
    if (frontLogo) {
      drawImageInZone(
        page,
        frontLogo,
        {
          xMm: dimensions.front.xMm + dimensions.front.widthMm / 2 - 18,
          yMm: dimensions.front.yMm + 14,
          widthMm: 36,
          heightMm: 36
        },
        'contain'
      )
    }
    if (backLogo) {
      drawImageInZone(
        page,
        backLogo,
        {
          xMm: dimensions.back.xMm + dimensions.back.widthMm / 2 - 15,
          yMm: dimensions.back.yMm + dimensions.back.heightMm - 48,
          widthMm: 30,
          heightMm: 30
        },
        'contain'
      )
    }
    if (state.exportSettings.mode !== 'print-final') {
      drawFrame(page, dimensions.front, accent)
      drawFrame(page, dimensions.back, accent)
    }
    drawCentered(
      page,
      safePdfText(state.content.front.studentName),
      dimensions.front.xMm + dimensions.front.widthMm / 2,
      dimensions.front.yMm + dimensions.front.heightMm * 0.17,
      18,
      fonts.bold,
      foreground
    )
    const titleLines = wrapTextByCharacters(safePdfText(state.content.front.title), 34).slice(0, 4)
    titleLines.forEach((line, index) =>
      drawCentered(
        page,
        line,
        dimensions.front.xMm + dimensions.front.widthMm / 2,
        dimensions.front.yMm + dimensions.front.heightMm * 0.34 + index * 13,
        24,
        fonts.bold,
        foreground
      )
    )
    drawCentered(
      page,
      safePdfText(state.content.front.degree),
      dimensions.front.xMm + dimensions.front.widthMm / 2,
      dimensions.front.yMm + dimensions.front.heightMm * 0.69,
      12,
      fonts.regular,
      muted
    )
    drawCentered(
      page,
      safePdfText(state.content.front.university),
      dimensions.front.xMm + dimensions.front.widthMm / 2,
      dimensions.front.yMm + dimensions.front.heightMm * 0.77,
      12,
      fonts.regular,
      muted
    )
    drawCentered(
      page,
      safePdfText(state.content.front.academicYear),
      dimensions.front.xMm + dimensions.front.widthMm / 2,
      dimensions.front.yMm + dimensions.front.heightMm * 0.87,
      14,
      fonts.bold,
      foreground
    )
    wrapTextByCharacters(safePdfText(state.content.back.summary), 48)
      .slice(0, 10)
      .forEach((line, index) =>
        drawTextAt(
          page,
          line,
          dimensions.back.xMm + 14,
          dimensions.back.yMm + dimensions.back.heightMm * 0.28 + index * 7,
          10,
          fonts.regular,
          muted
        )
      )
    drawCentered(
      page,
      safePdfText(state.content.back.contactInfo),
      dimensions.back.xMm + dimensions.back.widthMm / 2,
      dimensions.back.yMm + dimensions.back.heightMm * 0.88,
      9,
      fonts.regular,
      muted
    )
    drawSpineText(page, state, dimensions, fonts.bold, foreground)
  }

  if (state.exportSettings.mode === 'production-guide' || state.exportSettings.includeFoldLines)
    drawBindingEdgeMarks(page, dimensions)
  if (state.exportSettings.mode === 'production-guide' || state.exportSettings.includeSafeZones)
    drawSafeZones(page, dimensions)
  if (state.exportSettings.includeCropMarks) drawCropMarks(page)
}

async function embedDataImage(
  document: PDFDocument,
  dataUrl: string | undefined
): Promise<PDFImage | undefined> {
  if (!dataUrl) return undefined
  const match = /^data:(image\/(?:png|jpeg));base64,(.+)$/i.exec(dataUrl)
  if (!match) return undefined
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0))
  return match[1].toLowerCase() === 'image/png'
    ? document.embedPng(bytes)
    : document.embedJpg(bytes)
}

async function embedSelectedSourcePages(
  document: PDFDocument,
  state: HardcoverProjectState
): Promise<EmbeddedSourcePages> {
  const source = state.sourcePdf

  if (!source) return {}
  if (!source.bytes) {
    throw new Error('Upload the memoire PDF again before exporting this saved hardcover project.')
  }
  if (source.frontPageNumber < 1 || source.frontPageNumber > source.pageCount) {
    throw new Error(`Choose a page between 1 and ${source.pageCount}.`)
  }
  if (
    source.backCoverEnabled &&
    (!source.backPageNumber ||
      source.backPageNumber < 1 ||
      source.backPageNumber > source.pageCount)
  ) {
    throw new Error(`Choose a back-cover page between 1 and ${source.pageCount}.`)
  }

  const sourceDocument = await PDFDocument.load(source.bytes)
  const frontPage = sourceDocument.getPage(source.frontPageNumber - 1)
  const backPage =
    source.backCoverEnabled && source.backPageNumber
      ? sourceDocument.getPage(source.backPageNumber - 1)
      : undefined

  return {
    front: await document.embedPage(frontPage),
    back: backPage ? await document.embedPage(backPage) : undefined
  }
}

function drawPhysicalAreas(
  page: PDFPage,
  state: HardcoverProjectState,
  dimensions: ReturnType<typeof calculateCoverDimensions>,
  manualAccent?: ReturnType<typeof rgb>
): void {
  const bandColor = rgb(0.93, 0.95, 0.98)
  const spineColor = state.sourcePdf ? rgb(0.96, 0.97, 0.98) : manualAccent

  drawZoneFill(page, dimensions.leftBand, bandColor, 0.9)
  drawZoneFill(page, dimensions.rightBand, bandColor, 0.9)
  if (spineColor) drawZoneFill(page, dimensions.spine, spineColor, state.sourcePdf ? 0.95 : 0.25)
}

function drawZoneFill(
  page: PDFPage,
  zone: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  color: ReturnType<typeof rgb>,
  opacity: number
): void {
  page.drawRectangle({
    x: mmToPoints(zone.xMm),
    y: page.getHeight() - mmToPoints(zone.yMm + zone.heightMm),
    width: mmToPoints(zone.widthMm),
    height: mmToPoints(zone.heightMm),
    color,
    opacity
  })
}

function drawEmbeddedPdfPageInZone(
  page: PDFPage,
  embeddedPage: PDFEmbeddedPage,
  zone: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  fitMode: 'fit' | 'fill'
): void {
  const zoneWidth = mmToPoints(zone.widthMm)
  const zoneHeight = mmToPoints(zone.heightMm)
  const scale =
    fitMode === 'fill'
      ? Math.max(zoneWidth / embeddedPage.width, zoneHeight / embeddedPage.height)
      : Math.min(zoneWidth / embeddedPage.width, zoneHeight / embeddedPage.height)
  const width = embeddedPage.width * scale
  const height = embeddedPage.height * scale

  page.drawPage(embeddedPage, {
    x: mmToPoints(zone.xMm) + (zoneWidth - width) / 2,
    y: page.getHeight() - mmToPoints(zone.yMm) - zoneHeight + (zoneHeight - height) / 2,
    width,
    height
  })
}

function drawImageInZone(
  page: PDFPage,
  image: PDFImage,
  zone: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  fit: 'cover' | 'contain'
): void {
  const zoneWidth = mmToPoints(zone.widthMm)
  const zoneHeight = mmToPoints(zone.heightMm)
  const imageRatio = image.width / image.height
  const zoneRatio = zoneWidth / zoneHeight
  const width =
    fit === 'cover' ? zoneWidth : imageRatio > zoneRatio ? zoneWidth : zoneHeight * imageRatio
  const height = fit === 'cover' ? zoneHeight : width / imageRatio
  page.drawImage(image, {
    x: mmToPoints(zone.xMm) + (zoneWidth - width) / 2,
    y: page.getHeight() - mmToPoints(zone.yMm) - zoneHeight + (zoneHeight - height) / 2,
    width,
    height
  })
}

function drawSpineText(
  page: PDFPage,
  state: HardcoverProjectState,
  dimensions: ReturnType<typeof calculateCoverDimensions>,
  font: PDFFont,
  color: ReturnType<typeof rgb>
): void {
  const layout = calculateSpineTextLayout(
    state.content.spine,
    state.setup.spineWidthMm,
    dimensions.spine.heightMm - state.setup.hingeMm * 2
  )
  if (layout.items.length === 0) return

  const centerX = mmToPoints(dimensions.spine.xMm + dimensions.spine.widthMm / 2)
  const topY = dimensions.spine.yMm + state.setup.hingeMm
  const angle = state.content.spine.direction === 'bottom-to-top' ? 90 : -90

  for (const item of layout.items) {
    const centerY = page.getHeight() - mmToPoints(topY + item.centerFromTopMm)
    const lineHeight = item.fontSizePt * 1.18
    const firstLineOffset = -((item.lines.length - 1) * lineHeight) / 2

    item.lines.forEach((line, index) =>
      drawRotatedCenteredText({
        page,
        text: preparePdfDisplayText(safePdfText(line)),
        centerX,
        centerY,
        lineOffset: firstLineOffset + index * lineHeight,
        angle,
        size: item.fontSizePt,
        font,
        color
      })
    )
  }
}

function drawRotatedCenteredText({
  page,
  text,
  centerX,
  centerY,
  lineOffset,
  angle,
  size,
  font,
  color
}: {
  page: PDFPage
  text: string
  centerX: number
  centerY: number
  lineOffset: number
  angle: number
  size: number
  font: PDFFont
  color: ReturnType<typeof rgb>
}): void {
  const radians = (angle * Math.PI) / 180
  const advanceX = Math.cos(radians)
  const advanceY = Math.sin(radians)
  const upX = -Math.sin(radians)
  const upY = Math.cos(radians)
  const textWidth = font.widthOfTextAtSize(text, size)
  const lineCenterX = centerX - upX * lineOffset
  const lineCenterY = centerY - upY * lineOffset

  page.drawText(text, {
    x: lineCenterX - (advanceX * textWidth) / 2 - (upX * size) / 2,
    y: lineCenterY - (advanceY * textWidth) / 2 - (upY * size) / 2,
    size,
    font,
    color,
    rotate: degrees(angle)
  })
}

function drawFrame(
  page: PDFPage,
  zone: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  color: ReturnType<typeof rgb>
): void {
  page.drawRectangle({
    x: mmToPoints(zone.xMm + 8),
    y: page.getHeight() - mmToPoints(zone.yMm + zone.heightMm - 8),
    width: mmToPoints(zone.widthMm - 16),
    height: mmToPoints(zone.heightMm - 16),
    borderColor: color,
    borderWidth: 1
  })
}

function drawCentered(
  page: PDFPage,
  text: string,
  centerXMm: number,
  yMm: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>
): void {
  const displayText = preparePdfDisplayText(text)
  const width = font.widthOfTextAtSize(displayText, size)
  page.drawText(displayText, {
    x: mmToPoints(centerXMm) - width / 2,
    y: page.getHeight() - mmToPoints(yMm),
    size,
    font,
    color
  })
}

function drawTextAt(
  page: PDFPage,
  text: string,
  xMm: number,
  yMm: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>
): void {
  page.drawText(preparePdfDisplayText(text), {
    x: mmToPoints(xMm),
    y: page.getHeight() - mmToPoints(yMm),
    size,
    font,
    color
  })
}

function drawBindingEdgeMarks(
  page: PDFPage,
  dimensions: ReturnType<typeof calculateCoverDimensions>
): void {
  const color = rgb(0.88, 0.1, 0.28)
  for (const mark of dimensions.guideMarks) {
    page.drawLine({
      start: {
        x: mmToPoints(mark.xMm),
        y: page.getHeight() - mmToPoints(mark.yStartMm)
      },
      end: {
        x: mmToPoints(mark.xMm),
        y: page.getHeight() - mmToPoints(mark.yEndMm)
      },
      color,
      thickness: 0.6,
      dashArray: [4, 3]
    })
  }
}

function drawSafeZones(
  page: PDFPage,
  dimensions: ReturnType<typeof calculateCoverDimensions>
): void {
  const color = rgb(0.96, 0.62, 0.04)
  for (const zone of [dimensions.safeBack, dimensions.safeSpine, dimensions.safeFront]) {
    page.drawRectangle({
      x: mmToPoints(zone.xMm),
      y: page.getHeight() - mmToPoints(zone.yMm + zone.heightMm),
      width: mmToPoints(zone.widthMm),
      height: mmToPoints(zone.heightMm),
      borderColor: color,
      borderWidth: 0.5,
      borderDashArray: [3, 2]
    })
  }
}

function drawCropMarks(page: PDFPage): void {
  const color = rgb(0.05, 0.05, 0.05)
  const length = mmToPoints(4)
  const offset = mmToPoints(5)
  const width = page.getWidth()
  const height = page.getHeight()
  const lines = [
    [
      { x: 0, y: offset },
      { x: length, y: offset }
    ],
    [
      { x: offset, y: 0 },
      { x: offset, y: length }
    ],
    [
      { x: width - length, y: offset },
      { x: width, y: offset }
    ],
    [
      { x: width - offset, y: 0 },
      { x: width - offset, y: length }
    ],
    [
      { x: 0, y: height - offset },
      { x: length, y: height - offset }
    ],
    [
      { x: offset, y: height - length },
      { x: offset, y: height }
    ],
    [
      { x: width - length, y: height - offset },
      { x: width, y: height - offset }
    ],
    [
      { x: width - offset, y: height - length },
      { x: width - offset, y: height }
    ]
  ]
  for (const [start, end] of lines) page.drawLine({ start, end, color, thickness: 0.5 })
}

function parseHex(value: string): ReturnType<typeof rgb> {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value)
  if (!match) return rgb(0.1, 0.1, 0.1)
  return rgb(
    parseInt(match[1], 16) / 255,
    parseInt(match[2], 16) / 255,
    parseInt(match[3], 16) / 255
  )
}

function safePdfText(value: string): string {
  return value.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
}
