import type {
  BookletPage,
  BookletSource,
  SheetBoardState,
  SheetSettings
} from '@/tools/booklet-montage/types'
import type {
  CutterLayerVisibility,
  CutterSheetSettings,
  PiecePreset,
  PieceSourceFile,
  PlacedPiece
} from '@/tools/cutter-montage/types'

export function getBookletProjectStateKey({
  sources,
  pages,
  settings,
  sheetBoardState
}: {
  sources: BookletSource[]
  pages: BookletPage[]
  settings: SheetSettings
  sheetBoardState: SheetBoardState
}): string {
  return JSON.stringify({
    sources: sources.map((source) => omitSourceBytes(source)),
    pages: pages.map(({ thumbnailUrl: _thumbnailUrl, ...page }) => page),
    settings,
    sheetBoardState
  })
}

export function getCutterProjectStateKey({
  sources,
  pieces,
  placedPieces,
  sheet,
  layers
}: {
  sources: PieceSourceFile[]
  pieces: PiecePreset[]
  placedPieces: PlacedPiece[]
  sheet: CutterSheetSettings
  layers: CutterLayerVisibility
}): string {
  return JSON.stringify({
    sources: sources.map((source) => omitSourceBytes(source, true)),
    pieces: pieces.map(({ previewUrl: _previewUrl, artwork, ...piece }) => ({
      ...piece,
      artwork: omitPreviewUrl(artwork)
    })),
    placedPieces,
    sheet,
    layers
  })
}

function omitSourceBytes<T extends { bytes: Uint8Array }>(
  value: T,
  omitPreview = false
): Record<string, unknown> {
  const source = value as T & { bytesBase64?: string; previewUrl?: string }
  const {
    bytes,
    bytesBase64: _bytesBase64,
    previewUrl: temporaryPreviewUrl,
    ...rest
  } = source

  return {
    ...rest,
    ...(omitPreview ? {} : { previewUrl: temporaryPreviewUrl }),
    byteLength: bytes.byteLength
  }
}

function omitPreviewUrl<T extends { previewUrl: string }>(
  value: T
): Omit<T, 'previewUrl'> {
  const { previewUrl: _previewUrl, ...rest } = value

  return rest
}
