import { PDFArray, PDFDict, PDFName, PDFStream, type PDFPage } from 'pdf-lib'
import type { CardPdfFont } from '../types'

const key = PDFName.of

export function inspectCardPageFonts(page: PDFPage): CardPdfFont[] {
  const fonts = new Map<string, CardPdfFont>()
  const visited = new Set<PDFDict>()
  const visit = (resources: PDFDict | undefined) => {
    if (!resources || visited.has(resources)) return
    visited.add(resources)
    const fontResources = resources.lookupMaybe(key('Font'), PDFDict)
    for (const [, value] of fontResources?.entries() ?? []) {
      const font = page.doc.context.lookup(value, PDFDict)
      const name = font.lookupMaybe(key('BaseFont'), PDFName)?.decodeText() ?? 'Unnamed font'
      const type = font.lookupMaybe(key('Subtype'), PDFName)?.decodeText()
      const descendants = font.lookupMaybe(key('DescendantFonts'), PDFArray)
      const descriptors = descendants
        ? descendants.asArray().map((entry) => page.doc.context.lookup(entry, PDFDict))
        : [font]
      const embedded =
        type === 'Type3'
          ? Boolean(font.lookupMaybe(key('CharProcs'), PDFDict)?.entries().length)
          : descriptors.every((entry) => {
              const descriptor = entry.lookupMaybe(key('FontDescriptor'), PDFDict)
              return ['FontFile', 'FontFile2', 'FontFile3'].some((fileKey) => {
                const stream = descriptor?.lookupMaybe(key(fileKey), PDFStream)
                return Boolean(stream && stream.getContentsSize() > 0)
              })
            })
      const existing = fonts.get(name)
      fonts.set(name, { name, embedded: embedded && (existing?.embedded ?? true) })
      visit(font.lookupMaybe(key('Resources'), PDFDict))
    }
    const objects = resources.lookupMaybe(key('XObject'), PDFDict)
    for (const [, value] of objects?.entries() ?? []) {
      const object = page.doc.context.lookup(value, PDFStream)
      visit(object.dict.lookupMaybe(key('Resources'), PDFDict))
    }
    // Pattern artwork can carry its own fonts and resources.
    const patterns = resources.lookupMaybe(key('Pattern'), PDFDict)
    for (const [, value] of patterns?.entries() ?? []) {
      const pattern = page.doc.context.lookup(value)
      const dict =
        pattern instanceof PDFStream
          ? pattern.dict
          : pattern instanceof PDFDict
            ? pattern
            : undefined
      visit(dict?.lookupMaybe(key('Resources'), PDFDict))
    }
    const states = resources.lookupMaybe(key('ExtGState'), PDFDict)
    for (const [, value] of states?.entries() ?? []) {
      const state = page.doc.context.lookup(value, PDFDict)
      const mask = page.doc.context.lookup(state.get(key('SMask')))
      if (mask instanceof PDFDict) {
        const group = mask.lookupMaybe(key('G'), PDFStream)
        visit(group?.dict.lookupMaybe(key('Resources'), PDFDict))
      }
    }
  }
  visit(page.node.Resources())
  return [...fonts.values()]
}

export function assertCardFontsEmbedded(page: PDFPage, pageNumber: number): void {
  const missing = inspectCardPageFonts(page).filter((font) => !font.embedded)
  if (missing.length)
    throw new Error(
      `Page ${pageNumber}: font data is not embedded for ${missing.map((font) => font.name).join(', ')}. Ask for a PDF-compatible AI or PDF with embedded fonts or outlined text. Exact font appearance cannot be preserved from this file; export was stopped to avoid substitution.`
    )
}
