import type { PiecePreset, PieceSourceFile } from '../types'
export interface ArtworkEditResult {
  bytes: Uint8Array
  previewDataUrl: string
  widthPx: number
  heightPx: number
}
export function createEditedArtwork(
  piece: PiecePreset,
  result: ArtworkEditResult,
  id: string
): { piece: PiecePreset; source: PieceSourceFile } {
  const fileName = `${piece.displayName}-edited.png`
  const source: PieceSourceFile = {
    id,
    sourceKind: 'image',
    fileName,
    displayName: piece.displayName,
    mimeType: 'image/png',
    bytes: result.bytes,
    previewUrl: result.previewDataUrl,
    previewDataUrl: result.previewDataUrl,
    naturalWidthPx: result.widthPx,
    naturalHeightPx: result.heightPx
  }
  return {
    source,
    piece: {
      ...piece,
      sourceId: id,
      sourceKind: 'image',
      sourceFileName: fileName,
      pdfPageNumber: undefined,
      pageCount: undefined,
      pdfProductionMetadata: undefined,
      pdfPageMetadata: undefined,
      previewUrl: result.previewDataUrl,
      naturalWidthPx: result.widthPx,
      naturalHeightPx: result.heightPx,
      artwork: {
        ...piece.artwork,
        sourceId: id,
        sourceFileName: fileName,
        previewUrl: result.previewDataUrl
      },
      objects: piece.objects.map((object) =>
        object.role === 'artwork' ? { ...object, sourceId: id } : object
      )
    }
  }
}
