import {
  PDFDocument,
  PDFName,
  PDFObjectCopier,
  PDFStream,
  pushGraphicsState,
  popGraphicsState,
  type PDFEmbeddedPage,
  type PDFImage
} from 'pdf-lib'
import type { BookletPage, BookletSheet, BookletSource } from '../types'
import { assertNotCanceled, yieldToUi } from './memoryCleanup'

export interface PdfPageAsset {
  page: PDFEmbeddedPage
  rotation: number
}

export interface PdfRenderAssets {
  pdf: PDFDocument
  sourceMap: Map<string, BookletSource>
  pdfPages: Map<string, PdfPageAsset>
  images: Map<string, PDFImage>
}

export function assertArtworkSources(sheets: BookletSheet[], sources: BookletSource[]): void {
  const sourceMap = new Map(sources.map((source) => [source.id, source]))
  for (const page of usedPages(sheets)) {
    if (page.kind === 'blank') continue
    const source = page.sourceId ? sourceMap.get(page.sourceId) : undefined
    if (!source || source.kind !== page.kind || !source.bytes.length) {
      throw new Error(
        `Missing artwork for ${page.displayName}. Import its source file again before exporting.`
      )
    }
    if (
      page.kind === 'pdf' &&
      (!Number.isInteger(page.sourcePageIndex) || page.sourcePageIndex! < 0)
    ) {
      throw new Error(`Invalid PDF page for ${page.displayName}. Import its source file again.`)
    }
  }
}

/** One parse and one object copier per source, so fonts/images are shared across pages. */
export async function preparePdfRenderAssets(
  pdf: PDFDocument,
  sheets: BookletSheet[],
  sources: BookletSource[],
  signal?: AbortSignal,
  onPrepared?: (sourceName: string, current: number, total: number) => void
): Promise<PdfRenderAssets> {
  assertNotCanceled(signal)
  assertArtworkSources(sheets, sources)
  const assets: PdfRenderAssets = {
    pdf,
    sourceMap: new Map(sources.map((source) => [source.id, source])),
    pdfPages: new Map(),
    images: new Map()
  }
  const indicesBySource = new Map<string, Set<number>>()
  for (const page of usedPages(sheets)) {
    if (page.kind !== 'pdf') continue
    const indices = indicesBySource.get(page.sourceId!) ?? new Set<number>()
    indices.add(page.sourcePageIndex!)
    indicesBySource.set(page.sourceId!, indices)
  }
  for (const [sourceId, indices] of indicesBySource) {
    assertNotCanceled(signal)
    const source = assets.sourceMap.get(sourceId)!
    onPrepared?.(source.name, 0, indices.size)
    let sourcePdf: PDFDocument
    try {
      sourcePdf = await PDFDocument.load(source.bytes, { updateMetadata: false })
    } catch (error) {
      assertNotCanceled(signal)
      throw new Error(
        `Could not prepare ${source.name} for export: ${error instanceof Error ? error.message : 'invalid PDF'}`
      )
    }
    assertNotCanceled(signal)
    const sourcePages = [...indices].map((index) => {
      if (index >= sourcePdf.getPageCount()) {
        throw new Error(
          `Page ${index + 1} is missing from ${source.name}. Import the source again.`
        )
      }
      const page = sourcePdf.getPage(index)
      // Valid empty PDF pages can have no Contents entry. pdf-lib cannot embed these as-is.
      if (!page.node.Contents()) page.pushOperators(pushGraphicsState(), popGraphicsState())
      return page
    })
    const boxes = sourcePages.map((page) => {
      const crop = page.getCropBox(),
        media = page.getMediaBox()
      const box = {
        left: Math.max(crop.x, media.x),
        bottom: Math.max(crop.y, media.y),
        right: Math.min(crop.x + crop.width, media.x + media.width),
        top: Math.min(crop.y + crop.height, media.y + media.height)
      }
      return box.right > box.left && box.top > box.bottom
        ? box
        : {
            left: media.x,
            bottom: media.y,
            right: media.x + media.width,
            top: media.y + media.height
          }
    })
    const embedded = await pdf.embedPages(sourcePages, boxes)
    const groupCopier = PDFObjectCopier.for(sourcePdf.context, pdf.context)
    let position = 0
    for (const index of indices) {
      assertNotCanceled(signal)
      const page = embedded[position],
        original = sourcePages[position]
      // Flush in small batches, allowing Cancel and progress to repaint before serialization.
      await page.embed()
      const group = original.node.get(PDFName.of('Group'))
      if (group)
        pdf.context
          .lookup(page.ref, PDFStream)
          .dict.set(PDFName.of('Group'), groupCopier.copy(group))
      assets.pdfPages.set(`${sourceId}:${index}`, {
        page,
        rotation: ((original.getRotation().angle % 360) + 360) % 360
      })
      position += 1
      onPrepared?.(source.name, position, indices.size)
      if (position % 8 === 0) await yieldToUi(0, signal)
    }
    await yieldToUi(0, signal)
  }
  return assets
}

function usedPages(sheets: BookletSheet[]): BookletPage[] {
  return sheets.flatMap((sheet) => [
    sheet.front.left.page,
    sheet.front.right.page,
    sheet.back.left.page,
    sheet.back.right.page
  ])
}
