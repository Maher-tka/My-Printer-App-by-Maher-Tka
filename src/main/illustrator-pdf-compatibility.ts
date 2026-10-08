import {
  PDFDocument,
  PDFArray,
  PDFDict,
  PDFName,
  PDFString,
  PDFHexString,
  PDFRawStream,
  decodePDFRawStream
} from 'pdf-lib'

/** Check the embedded editing format, not the newer application's producer metadata. */
export async function verifyCs6IllustratorPdf(bytes: Uint8Array): Promise<void> {
  const pdf = await PDFDocument.load(bytes)
  if (pdf.getPageCount() !== 1) throw new Error('verify saved sheet: Expected one PDF page.')
  const oc = pdf.catalog.lookup(PDFName.of('OCProperties'), PDFDict)
  const groups = oc.lookup(PDFName.of('OCGs'))
  if (!(groups instanceof PDFArray)) throw new Error('verify saved sheet: PDF layers are missing.')
  const names = groups.asArray().map((ref) => {
    const layer = pdf.context.lookup(ref, PDFDict)
    const name = layer.lookup(PDFName.of('Name'))
    return name instanceof PDFString || name instanceof PDFHexString ? name.decodeText() : ''
  })
  if (
    names.length !== 3 ||
    !['Artwork', 'CutContour', 'FC RegisterMark Layer1'].every((name) => names.includes(name))
  )
    throw new Error('verify saved sheet: PDF must contain all three production layers.')
  const defaults = oc.lookup(PDFName.of('D'), PDFDict)
  const off = defaults.lookup(PDFName.of('OFF'))
  const cutRef = groups.asArray()[names.indexOf('CutContour')]
  if (
    !(off instanceof PDFArray) ||
    !off.asArray().some((ref) => ref.toString() === cutRef.toString())
  )
    throw new Error('verify saved sheet: CutContour must be hidden in the PDF.')
  const page = pdf.getPages()[0]
  const pieceInfo =
    page.node.lookupMaybe(PDFName.of('PieceInfo'), PDFDict) ??
    pdf.catalog.lookupMaybe(PDFName.of('PieceInfo'), PDFDict)
  const illustrator = pieceInfo?.lookupMaybe(PDFName.of('Illustrator'), PDFDict)
  const privateData = illustrator?.lookupMaybe(PDFName.of('Private'), PDFDict)
  const streams = privateData
    ? ['AIMetaData', 'AIPrivateData1'].map((key) =>
        pdf.context.lookup(privateData.get(PDFName.of(key)))
      )
    : []
  if (!streams.some((stream) => stream instanceof PDFRawStream))
    throw new Error('verify saved sheet: Illustrator editing data is missing.')
  const header = streams
    .filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
    .map((stream) =>
      Buffer.from(decodePDFRawStream(stream).decode()).subarray(0, 2048).toString('latin1')
    )
    .join('\n')
  if (!/%%Creator:\s*Adobe Illustrator\(R\) 16\.0(?:\s|$)/.test(header))
    throw new Error('verify saved sheet: Illustrator editing data is not in CS6 format.')
}
