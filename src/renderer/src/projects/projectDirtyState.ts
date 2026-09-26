import type {
  BookletPage,
  BookletSource,
  SheetBoardState,
  SheetSettings
} from '@/tools/booklet-montage/types'
import type {
  CutterExportSettings,
  CutterLayerVisibility,
  CutterSheetSettings,
  PiecePreset,
  PieceSourceFile,
  PlacedPiece
} from '@/tools/cutter-montage/types'
import type { HardcoverProjectState } from '@/tools/hardcover-cover/types'

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
  layers,
  exportSettings
}: {
  sources: PieceSourceFile[]
  pieces: PiecePreset[]
  placedPieces: PlacedPiece[]
  sheet: CutterSheetSettings
  layers: CutterLayerVisibility
  exportSettings?: CutterExportSettings
}): string {
  return JSON.stringify({
    sources: sources.map((source) => omitSourceBytes(source, true)),
    pieces: pieces.map(({ previewUrl: _previewUrl, artwork, ...piece }) => ({
      ...piece,
      artwork: omitPreviewUrl(artwork)
    })),
    placedPieces,
    sheet,
    layers,
    exportSettings
  })
}

export function getHardcoverProjectStateKey(state: HardcoverProjectState): string {
  const sourcePdf = state.sourcePdf
    ? {
        ...state.sourcePdf,
        bytes: undefined,
        thumbnailDataUrl: undefined,
        backThumbnailDataUrl: undefined,
        pagePreviews: undefined,
        frontSource: state.sourcePdf.frontSource
          ? {
              ...state.sourcePdf.frontSource,
              thumbnailDataUrl: undefined,
              pagePreviews: undefined
            }
          : undefined,
        backSource: state.sourcePdf.backSource
          ? {
              ...state.sourcePdf.backSource,
              thumbnailDataUrl: undefined,
              pagePreviews: undefined
            }
          : undefined
      }
    : undefined

  return JSON.stringify({
    ...state,
    content: {
      ...state.content,
      spine: {
        ...state.content.spine,
        // Auto-fit size is derived from the text and dimensions, not a user edit.
        fontSizePt: state.content.spine.autoFit ? undefined : state.content.spine.fontSizePt
      }
    },
    sourcePdf
  })
}

function omitSourceBytes<T extends { bytes: Uint8Array }>(
  value: T,
  omitPreview = false
): Record<string, unknown> {
  const source = value as T & {
    bytesBase64?: string
    previewUrl?: string
    previewDataUrl?: string
  }
  const {
    bytes,
    bytesBase64: _bytesBase64,
    previewUrl: temporaryPreviewUrl,
    previewDataUrl: _previewDataUrl,
    ...rest
  } = source

  return {
    ...rest,
    ...(omitPreview ? {} : { previewUrl: temporaryPreviewUrl }),
    byteLength: bytes.byteLength
  }
}

function omitPreviewUrl<T extends { previewUrl: string }>(value: T): Omit<T, 'previewUrl'> {
  const { previewUrl: _previewUrl, ...rest } = value

  return rest
}
