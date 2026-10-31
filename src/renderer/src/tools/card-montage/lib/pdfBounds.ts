import { PDFDocument, type PDFPage } from 'pdf-lib'

// TrimBox describes the finished page; CropBox and MediaBox limit what a PDF
// viewer can actually display. Missing TrimBox defaults to CropBox in pdf-lib.
export function cardPdfBounds(page: PDFPage) {
  const media = page.getMediaBox()
  const crop = page.getCropBox()
  const trim = page.getTrimBox()
  const intersect = (...boxes: (typeof media)[]) => ({
    left: Math.max(...boxes.map((box) => box.x)),
    bottom: Math.max(...boxes.map((box) => box.y)),
    right: Math.min(...boxes.map((box) => box.x + box.width)),
    top: Math.min(...boxes.map((box) => box.y + box.height))
  })
  const valid = (box: ReturnType<typeof intersect>) =>
    Object.values(box).every(Number.isFinite) && box.right > box.left && box.top > box.bottom
  const trimmed = intersect(media, crop, trim)
  if (valid(trimmed)) return trimmed
  const cropped = intersect(media, crop)
  if (valid(cropped)) return cropped
  return intersect(media)
}

// PDF.js renders CropBox, so supply a temporary copy with the same bounds used
// by export. The original PDF bytes are kept for vector output and projects.
export async function cardPdfPreviewBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes)
  for (const page of pdf.getPages()) {
    const bounds = cardPdfBounds(page)
    page.setCropBox(
      bounds.left,
      bounds.bottom,
      bounds.right - bounds.left,
      bounds.top - bounds.bottom
    )
  }
  return pdf.save()
}
