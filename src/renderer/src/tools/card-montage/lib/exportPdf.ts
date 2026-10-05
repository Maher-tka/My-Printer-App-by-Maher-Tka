import { PDFDocument, degrees, rgb, type PDFEmbeddedPage, type PDFImage } from 'pdf-lib'
import type { CardArtwork, CardMontageSettings } from '../types'
import { getCardLayout } from './layout'
import { assertCardFontsEmbedded } from './pdfFonts'
import { CARD_CROP_LINE_WIDTH_PT } from './cropMarks'

const pt = (mm: number) => (mm * 72) / 25.4

export async function exportCardMontagePdf(
  artwork: CardArtwork,
  settings: CardMontageSettings,
  back?: CardArtwork | null,
  singleSide: 'front' | 'back' = 'front'
): Promise<Uint8Array> {
  const layout = getCardLayout(settings)
  if (layout.errors.length) throw new Error(layout.errors.join('\n'))
  if (settings.includeBack && !back)
    throw new Error('Import or select the back-side design before exporting both sides.')
  const doc = await PDFDocument.create()
  const assets: {
    asset: PDFEmbeddedPage | PDFImage
    rotation: number
    kind: 'pdf' | 'image'
    side: 'front' | 'back'
  }[] = []
  const sides = settings.includeBack
    ? [
        { artwork, side: 'front' as const },
        { artwork: back!, side: 'back' as const }
      ]
    : [{ artwork, side: singleSide }]
  for (const { artwork: sideArtwork, side } of sides) {
    if (sideArtwork.kind === 'pdf') {
      const source = await PDFDocument.load(sideArtwork.bytesBase64)
      if (
        !Number.isInteger(sideArtwork.pageNumber) ||
        sideArtwork.pageNumber < 1 ||
        sideArtwork.pageNumber > source.getPageCount()
      )
        throw new Error('Choose a valid PDF page.')
      const indices =
        !settings.includeBack && settings.exportAllPdfPages
          ? source.getPageIndices()
          : [sideArtwork.pageNumber - 1]
      if (indices.length > 200) throw new Error('Export up to 200 card sides at a time.')
      for (const index of indices) {
        const sourcePage = source.getPage(index)
        assertCardFontsEmbedded(sourcePage, index + 1)
        const rotation = ((sourcePage.getRotation().angle % 360) + 360) % 360
        const crop = sourcePage.getCropBox()
        const media = sourcePage.getMediaBox()
        const clipped = {
          left: Math.max(crop.x, media.x),
          bottom: Math.max(crop.y, media.y),
          right: Math.min(crop.x + crop.width, media.x + media.width),
          top: Math.min(crop.y + crop.height, media.y + media.height)
        }
        const asset = await doc.embedPage(
          sourcePage,
          clipped.right > clipped.left && clipped.top > clipped.bottom
            ? clipped
            : {
                left: media.x,
                bottom: media.y,
                right: media.x + media.width,
                top: media.y + media.height
              }
        )
        assets.push({ asset, rotation, kind: 'pdf', side })
      }
    } else if (sideArtwork.kind === 'png')
      assets.push({
        asset: await doc.embedPng(sideArtwork.bytesBase64),
        rotation: 0,
        kind: 'image',
        side
      })
    else if (sideArtwork.kind === 'jpeg')
      assets.push({
        asset: await doc.embedJpg(sideArtwork.bytesBase64),
        rotation: 0,
        kind: 'image',
        side
      })
    else throw new Error('Choose a PDF, PNG or JPEG design.')
  }
  for (const { asset, rotation, kind, side } of assets) {
    const layout = getCardLayout(settings, side)
    if (![asset.width, asset.height].every((value) => Number.isFinite(value) && value > 0))
      throw new Error('The artwork has invalid dimensions.')
    const swapped = rotation === 90 || rotation === 270
    const nativeWidth = swapped ? asset.height : asset.width
    const nativeHeight = swapped ? asset.width : asset.height
    const targetWidth = pt(layout.widthMm)
    const targetHeight = pt(layout.heightMm)
    const fitScale = Math.min(targetWidth / nativeWidth, targetHeight / nativeHeight)
    const w = layout.artworkFit === 'stretch' ? targetWidth : nativeWidth * fitScale
    const h = layout.artworkFit === 'stretch' ? targetHeight : nativeHeight * fitScale
    const page = doc.addPage([pt(layout.sheetWidthMm), pt(layout.sheetHeightMm)])
    for (const slot of layout.slots) {
      const left = pt(slot.xMm) + (targetWidth - w) / 2
      const bottom = pt(layout.sheetHeightMm - slot.yMm - layout.heightMm) + (targetHeight - h) / 2
      const config = {
        x: left + (rotation === 180 || rotation === 270 ? w : 0),
        y: bottom + (rotation === 90 || rotation === 180 ? h : 0),
        width: swapped ? h : w,
        height: swapped ? w : h,
        rotate: degrees(-rotation)
      }
      if (kind === 'pdf') page.drawPage(asset as PDFEmbeddedPage, config)
      else page.drawImage(asset as PDFImage, config)
    }
    const color = layout.lineColor
    for (const mark of layout.marks)
      page.drawLine({
        start: { x: pt(mark.x1), y: pt(layout.sheetHeightMm - mark.y1) },
        end: { x: pt(mark.x2), y: pt(layout.sheetHeightMm - mark.y2) },
        thickness: CARD_CROP_LINE_WIDTH_PT,
        color: rgb(
          parseInt(color.slice(1, 3), 16) / 255,
          parseInt(color.slice(3, 5), 16) / 255,
          parseInt(color.slice(5, 7), 16) / 255
        )
      })
    for (const outline of layout.outlines)
      page.drawRectangle({
        x: pt(outline.xMm),
        y: pt(layout.sheetHeightMm - outline.yMm - outline.heightMm),
        width: pt(outline.widthMm),
        height: pt(outline.heightMm),
        borderWidth: CARD_CROP_LINE_WIDTH_PT,
        borderColor: rgb(
          parseInt(color.slice(1, 3), 16) / 255,
          parseInt(color.slice(3, 5), 16) / 255,
          parseInt(color.slice(5, 7), 16) / 255
        )
      })
  }
  doc.setTitle(`Card Montage — ${artwork.name}`)
  doc.setCreator('My Printer App by Maher Tka')
  return doc.save()
}
