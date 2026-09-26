import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFEmbeddedPage,
  type PDFImage,
  type PDFPage
} from 'pdf-lib'
import type { NumberArtwork, SequentialProject } from '../types'
import {
  formatSequenceNumber,
  getNumberSlots,
  getSequentialLayout,
  positionLabel,
  getGutterCutLines,
  GUTTER_LINE_WIDTH_PT
} from './layout'

const pt = (mm: number) => (mm * 72) / 25.4
const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export async function exportSequentialPdf(
  project: SequentialProject,
  options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}
): Promise<Uint8Array> {
  const checkAbort = () => {
    if (options.signal?.aborted) throw new DOMException('Export canceled.', 'AbortError')
  }
  checkAbort()
  const s = project.settings
  const layout = getSequentialLayout(s)
  if (layout.errors.length) throw new Error(layout.errors.join('\n'))
  if (!project.front) throw new Error('Import a front design before exporting.')
  if (s.backMode === 'artwork' && !project.back)
    throw new Error('Import a back design, or choose a blank back.')
  if (!project.positions.length || project.positions.length > 20)
    throw new Error('Add between 1 and 20 number positions.')
  if (s.quantity * project.positions.length > 500000)
    throw new Error(
      'This job has too many number impressions. Reduce quantity or split it into batches.'
    )
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const finalLabel = formatSequenceNumber(s, s.quantity - 1)
  for (const position of project.positions) {
    if (
      !Number.isFinite(position.xMm) ||
      !Number.isFinite(position.yMm) ||
      !Number.isFinite(position.fontSizePt) ||
      position.fontSizePt < 4 ||
      position.fontSizePt > 200 ||
      !/^#[0-9a-f]{6}$/i.test(position.color) ||
      !['left', 'center', 'right'].includes(position.align)
    )
      throw new Error(
        'Each number position needs a valid location, 4–200 pt font size, alignment and #RRGGBB color.'
      )
    if (
      position.kind === 'text' &&
      (!position.text?.trim() || position.text.length > 200 || /[^\x20-\x7e]/.test(position.text))
    )
      throw new Error(
        'Fixed text must contain 1�200 printable English letters, numbers or symbols.'
      )
    const width = font.widthOfTextAtSize(positionLabel(position, finalLabel), position.fontSizePt)
    const x =
      pt(position.xMm) -
      (position.align === 'center' ? width / 2 : position.align === 'right' ? width : 0)
    if (
      x < -0.01 ||
      x + width > pt(s.ticketWidthMm) + 0.01 ||
      position.yMm < 0 ||
      pt(position.yMm) + font.heightAtSize(position.fontSizePt) > pt(s.ticketHeightMm) + 0.01
    )
      throw new Error(
        'A number extends outside the ticket. Move its position, reduce its font size, or shorten the prefix/suffix.'
      )
  }
  const embed = async (art: NumberArtwork) => {
    checkAbort()
    if (art.bytesBase64.length > 70 * 1024 * 1024)
      throw new Error('Artwork exceeds the 50 MB limit. Use a smaller file.')
    let asset: PDFImage | PDFEmbeddedPage
    let rotation = 0
    if (art.kind === 'pdf') {
      const source = await PDFDocument.load(art.bytesBase64)
      if (
        !Number.isInteger(art.pageNumber) ||
        art.pageNumber < 1 ||
        art.pageNumber > source.getPageCount()
      )
        throw new Error('Choose a valid artwork PDF page.')
      const page = source.getPage(art.pageNumber - 1)
      rotation = ((page.getRotation().angle % 360) + 360) % 360
      const crop = page.getCropBox()
      const media = page.getMediaBox()
      const clipped = {
        left: Math.max(crop.x, media.x),
        bottom: Math.max(crop.y, media.y),
        right: Math.min(crop.x + crop.width, media.x + media.width),
        top: Math.min(crop.y + crop.height, media.y + media.height)
      }
      // PDF.js uses the MediaBox when the crop and media boxes do not intersect.
      const bounds =
        clipped.right > clipped.left && clipped.top > clipped.bottom
          ? clipped
          : {
              left: media.x,
              bottom: media.y,
              right: media.x + media.width,
              top: media.y + media.height
            }
      asset = await doc.embedPage(page, bounds)
    } else if (art.kind === 'png') asset = await doc.embedPng(art.bytesBase64)
    else if (art.kind === 'jpeg') asset = await doc.embedJpg(art.bytesBase64)
    else throw new Error('Use a PDF, PNG or JPEG design.')
    if (
      !Number.isFinite(asset.width) ||
      !Number.isFinite(asset.height) ||
      asset.width <= 0 ||
      asset.height <= 0
    )
      throw new Error('The artwork has invalid dimensions.')
    return { asset, rotation, pdf: art.kind === 'pdf' }
  }
  const front = await embed(project.front)
  const back = s.backMode === 'artwork' ? await embed(project.back!) : null
  const drawArtwork = (page: PDFPage, artwork: typeof front, x: number, y: number) => {
    const swapped = artwork.rotation === 90 || artwork.rotation === 270
    const width = swapped ? artwork.asset.height : artwork.asset.width
    const height = swapped ? artwork.asset.width : artwork.asset.height
    const scale = Math.min(pt(s.ticketWidthMm) / width, pt(s.ticketHeightMm) / height)
    const w = width * scale,
      h = height * scale
    const left = x + (pt(s.ticketWidthMm) - w) / 2,
      bottom = y + (pt(s.ticketHeightMm) - h) / 2
    const config = {
      x: left + (artwork.rotation === 180 || artwork.rotation === 270 ? w : 0),
      y: bottom + (artwork.rotation === 90 || artwork.rotation === 180 ? h : 0),
      width: artwork.asset.width * scale,
      height: artwork.asset.height * scale,
      rotate: degrees(-artwork.rotation)
    }
    if (artwork.pdf) page.drawPage(artwork.asset as PDFEmbeddedPage, config)
    else page.drawImage(artwork.asset as PDFImage, config)
  }
  let completed = 0
  options.onProgress?.(0, layout.pdfPageCount)
  for (let sheet = 0; sheet < layout.sheetCount; sheet++) {
    for (const side of (s.backMode === 'none' ? ['front'] : ['front', 'back']) as (
      | 'front'
      | 'back'
    )[]) {
      checkAbort()
      const page = doc.addPage([pt(s.sheetWidthMm), pt(s.sheetHeightMm)])
      if (!(side === 'back' && s.backMode === 'blank')) {
        const slots = getNumberSlots(s, sheet, side)
        for (let i = 0; i < slots.length; i++) {
          if (i % 100 === 0) {
            await yieldTask()
            checkAbort()
          }
          const slot = slots[i]
          if (slot.label === null) continue
          const x = pt(slot.xMm),
            y = pt(s.sheetHeightMm - slot.yMm - s.ticketHeightMm)
          drawArtwork(page, side === 'front' ? front : back!, x, y)
          if (side === 'front' || s.numberBack)
            for (const position of project.positions) {
              const label = positionLabel(position, slot.label)
              const textWidth = font.widthOfTextAtSize(label, position.fontSizePt)
              const alignOffset =
                position.align === 'center'
                  ? textWidth / 2
                  : position.align === 'right'
                    ? textWidth
                    : 0
              const hex = position.color.slice(1)
              page.drawText(label, {
                font,
                size: position.fontSizePt,
                x: x + pt(position.xMm) - alignOffset,
                y:
                  y +
                  pt(s.ticketHeightMm - position.yMm) -
                  font.heightAtSize(position.fontSizePt, { descender: false }),
                color: rgb(
                  parseInt(hex.slice(0, 2), 16) / 255,
                  parseInt(hex.slice(2, 4), 16) / 255,
                  parseInt(hex.slice(4, 6), 16) / 255
                )
              })
            }
          if (s.cropMarks) {
            const line = (x1: number, y1: number, x2: number, y2: number) =>
              page.drawLine({
                start: { x: pt(x1), y: pt(s.sheetHeightMm - y1) },
                end: { x: pt(x2), y: pt(s.sheetHeightMm - y2) },
                thickness: 0.25,
                color: rgb(0, 0, 0)
              })
            const left = slot.xMm,
              top = slot.yMm,
              right = left + s.ticketWidthMm,
              bottom = top + s.ticketHeightMm
            // Keep marks in empty margins/gutters; never extend over neighbouring artwork.
            const rooms = [
              slot.column === 0 ? left : s.gapMm / 2,
              slot.column === layout.columns - 1 ? s.sheetWidthMm - right : s.gapMm / 2,
              slot.row === 0 ? top : s.gapMm / 2,
              slot.row === layout.rows - 1 ? s.sheetHeightMm - bottom : s.gapMm / 2
            ]
            const lengths = rooms.map((room) => Math.min(3, room - 0.5))
            if (lengths[0] >= 0.5)
              for (const edge of [top, bottom])
                line(left - 0.5, edge, left - 0.5 - lengths[0], edge)
            if (lengths[1] >= 0.5)
              for (const edge of [top, bottom])
                line(right + 0.5, edge, right + 0.5 + lengths[1], edge)
            if (lengths[2] >= 0.5)
              for (const edge of [left, right]) line(edge, top - 0.5, edge, top - 0.5 - lengths[2])
            if (lengths[3] >= 0.5)
              for (const edge of [left, right])
                line(edge, bottom + 0.5, edge, bottom + 0.5 + lengths[3])
          }
        }
      }
      if (sheet === 0 && side === 'front') {
        const hex = (s.cuttingLineColor ?? '#000000').slice(1)
        for (const line of getGutterCutLines(s, getNumberSlots(s, sheet, side))) {
          page.drawLine({
            start: { x: pt(line.x1), y: pt(s.sheetHeightMm - line.y1) },
            end: { x: pt(line.x2), y: pt(s.sheetHeightMm - line.y2) },
            thickness: GUTTER_LINE_WIDTH_PT,
            color: rgb(
              parseInt(hex.slice(0, 2), 16) / 255,
              parseInt(hex.slice(2, 4), 16) / 255,
              parseInt(hex.slice(4, 6), 16) / 255
            )
          })
        }
      }
      options.onProgress?.(++completed, layout.pdfPageCount)
      await yieldTask()
    }
  }
  checkAbort()
  doc.setTitle(project.name || 'Sequential numbers')
  doc.setCreator('My Printer App by Maher Tka')
  const bytes = await doc.save()
  checkAbort()
  return bytes
}
