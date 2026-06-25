import type {
  BookletPage,
  BookletSource,
  SheetBoardState,
  SheetSettings
} from '@/tools/booklet-montage/types'
import type {
  CutterExportSettings,
  CutterLayerVisibility,
  CutterMode,
  CutterSheetSettings,
  EditorObjectType,
  KeyObjectState,
  PieceArtwork,
  PiecePreset,
  PieceSourceFile,
  PlacedPiece
} from '@/tools/cutter-montage/types'
import { synchronizePieceEditorModel } from '@/tools/cutter-montage/lib/editorObjects'
import type { HardcoverProjectState } from '@/tools/hardcover-cover/types'
import {
  PRINTER_PROJECT_EXTENSIONS,
  PRINTER_PROJECT_SCHEMA,
  PRINTER_PROJECT_VERSION,
  type PrinterProjectFile,
  type ProjectMetadata,
  type ProjectToolId
} from '@/types/projects'

export const projectToolLabels: Record<ProjectToolId, string> = {
  'booklet-montage': 'Booklet Montage',
  'cutter-montage': 'Cutter Montage',
  'hardcover-cover': 'Hardcover Cover'
}

export interface SerializedBookletSource extends Omit<BookletSource, 'bytes'> {
  bytesBase64: string
}

export type SerializedBookletPage = Omit<BookletPage, 'thumbnailUrl'>

export interface BookletProjectPayload {
  settings: SheetSettings
  sheetBoardState: SheetBoardState
  sources: SerializedBookletSource[]
  pages: SerializedBookletPage[]
}

export interface SerializedPieceSourceFile extends Omit<PieceSourceFile, 'bytes' | 'previewUrl'> {
  bytesBase64: string
}

export type SerializedPieceArtwork = Omit<PieceArtwork, 'previewUrl'>

export interface SerializedPiecePreset extends Omit<PiecePreset, 'previewUrl' | 'artwork'> {
  artwork: SerializedPieceArtwork
}

export interface CutterProjectPayload {
  mode: CutterMode
  activePieceId: string | null
  selectedPlacedIds: string[]
  selectedEditorObjects: EditorObjectType[]
  keyObject: KeyObjectState
  sheet: CutterSheetSettings
  sources: SerializedPieceSourceFile[]
  pieces: SerializedPiecePreset[]
  placedPieces: PlacedPiece[]
  layers: CutterLayerVisibility
  exportSettings: CutterExportSettings
}

export interface RestoredCutterProject {
  mode: CutterMode
  activePieceId: string | null
  selectedPlacedIds: string[]
  selectedEditorObjects: EditorObjectType[]
  keyObject: KeyObjectState
  sheet: CutterSheetSettings
  sources: PieceSourceFile[]
  pieces: PiecePreset[]
  placedPieces: PlacedPiece[]
  layers: CutterLayerVisibility
}

export type HardcoverProjectPayload = HardcoverProjectState

interface MetadataInput {
  tool: ProjectToolId
  jobName: string
  sourceCount: number
  itemCount: number
  summary: string
  price?: number
  existingMetadata?: ProjectMetadata | null
}

export function createBookletProjectFile({
  sources,
  pages,
  settings,
  sheetBoardState,
  existingMetadata
}: {
  sources: BookletSource[]
  pages: BookletPage[]
  settings: SheetSettings
  sheetBoardState: SheetBoardState
  existingMetadata?: ProjectMetadata | null
}): PrinterProjectFile<BookletProjectPayload> {
  return {
    schema: PRINTER_PROJECT_SCHEMA,
    version: PRINTER_PROJECT_VERSION,
    metadata: createProjectMetadata({
      tool: 'booklet-montage',
      jobName: getBookletProjectName(sources, pages),
      sourceCount: sources.length,
      itemCount: pages.length,
      summary: getBookletProjectSummary(sources, pages, sheetBoardState),
      existingMetadata
    }),
    payload: {
      settings,
      sheetBoardState,
      sources: sources.map(serializeBookletSource),
      pages: pages.map(serializeBookletPage)
    }
  }
}

export function deserializeBookletProjectPayload(payload: BookletProjectPayload): {
  sources: BookletSource[]
  pages: BookletPage[]
  settings: SheetSettings
  sheetBoardState: SheetBoardState
} {
  return {
    settings: payload.settings,
    sheetBoardState: payload.sheetBoardState,
    sources: payload.sources.map((source) => ({
      ...source,
      bytes: base64ToUint8Array(source.bytesBase64)
    })),
    pages: payload.pages.map((page) => ({ ...page }))
  }
}

export function createCutterProjectFile({
  mode,
  activePieceId,
  selectedPlacedIds,
  selectedEditorObjects,
  keyObject,
  sheet,
  sources,
  pieces,
  placedPieces,
  layers,
  exportSettings,
  existingMetadata
}: {
  mode: CutterMode
  activePieceId: string | null
  selectedPlacedIds: string[]
  selectedEditorObjects: EditorObjectType[]
  keyObject: KeyObjectState
  sheet: CutterSheetSettings
  sources: PieceSourceFile[]
  pieces: PiecePreset[]
  placedPieces: PlacedPiece[]
  layers: CutterLayerVisibility
  exportSettings: CutterExportSettings
  existingMetadata?: ProjectMetadata | null
}): PrinterProjectFile<CutterProjectPayload> {
  return {
    schema: PRINTER_PROJECT_SCHEMA,
    version: PRINTER_PROJECT_VERSION,
    metadata: createProjectMetadata({
      tool: 'cutter-montage',
      jobName: getCutterProjectName(pieces, sources),
      sourceCount: sources.length,
      itemCount: placedPieces.length || pieces.length,
      summary: getCutterProjectSummary(sources, pieces, placedPieces),
      existingMetadata
    }),
    payload: {
      mode,
      activePieceId,
      selectedPlacedIds,
      selectedEditorObjects,
      keyObject,
      sheet,
      sources: sources.map(serializePieceSource),
      pieces: pieces.map(serializePiecePreset),
      placedPieces,
      layers,
      exportSettings
    }
  }
}

export function deserializeCutterProjectPayload(
  payload: CutterProjectPayload
): RestoredCutterProject {
  const sources = payload.sources.map((source) => {
    const bytes = base64ToUint8Array(source.bytesBase64)

    return {
      ...source,
      bytes,
      previewUrl: URL.createObjectURL(
        new Blob([bytesToArrayBuffer(bytes)], { type: source.mimeType })
      )
    }
  })
  const previewBySourceId = new Map(sources.map((source) => [source.id, source.previewUrl]))
  const pieces = payload.pieces.map((piece) => {
    const previewUrl = previewBySourceId.get(piece.sourceId) ?? ''

    return synchronizePieceEditorModel({
      ...piece,
      previewUrl,
      artwork: {
        ...piece.artwork,
        previewUrl
      }
    })
  })

  return {
    mode: payload.mode,
    activePieceId: payload.activePieceId,
    selectedPlacedIds: payload.selectedPlacedIds,
    selectedEditorObjects: payload.selectedEditorObjects,
    keyObject: payload.keyObject,
    sheet: payload.sheet,
    sources,
    pieces,
    placedPieces: payload.placedPieces,
    layers: payload.layers
  }
}

export function createHardcoverProjectFile({
  state,
  existingMetadata
}: {
  state: HardcoverProjectState
  existingMetadata?: ProjectMetadata | null
}): PrinterProjectFile<HardcoverProjectPayload> {
  return {
    schema: PRINTER_PROJECT_SCHEMA,
    version: PRINTER_PROJECT_VERSION,
    metadata: createProjectMetadata({
      tool: 'hardcover-cover',
      jobName:
        state.job.jobTitle.trim() ||
        state.content.front.studentName.trim() ||
        'Untitled Hardcover Cover',
      sourceCount:
        Number(Boolean(state.content.front.logoDataUrl)) +
        Number(Boolean(state.content.front.backgroundDataUrl)) +
        Number(Boolean(state.content.back.logoDataUrl)),
      itemCount: Math.max(1, state.batchStudents.length),
      summary: `${state.content.front.studentName || 'Unnamed student'}, ${state.setup.bookWidthMm} x ${state.setup.bookHeightMm} mm, ${state.setup.spineWidthMm} mm spine`,
      price: getHardcoverQuoteTotal(state),
      existingMetadata
    }),
    payload: state
  }
}

export function deserializeHardcoverProjectPayload(
  payload: HardcoverProjectPayload
): HardcoverProjectState {
  return structuredClone(payload)
}

export function isPrinterProjectFile(value: unknown): value is PrinterProjectFile {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<PrinterProjectFile>

  return (
    candidate.schema === PRINTER_PROJECT_SCHEMA &&
    candidate.version === PRINTER_PROJECT_VERSION &&
    Boolean(candidate.metadata) &&
    Boolean(candidate.payload) &&
    (candidate.metadata?.tool === 'booklet-montage' ||
      candidate.metadata?.tool === 'cutter-montage' ||
      candidate.metadata?.tool === 'hardcover-cover')
  )
}

export function getSuggestedProjectFileName(jobName: string, tool: ProjectToolId): string {
  return `${sanitizeProjectFileName(jobName || 'Untitled Project')}.${PRINTER_PROJECT_EXTENSIONS[tool]}`
}

function createProjectMetadata(input: MetadataInput): ProjectMetadata {
  const now = new Date().toISOString()

  return {
    id: input.existingMetadata?.id ?? createProjectId(),
    jobName: input.jobName,
    tool: input.tool,
    toolLabel: projectToolLabels[input.tool],
    createdAt: input.existingMetadata?.createdAt ?? now,
    updatedAt: now,
    sourceCount: input.sourceCount,
    itemCount: input.itemCount,
    summary: input.summary,
    ...(input.price !== undefined ? { price: input.price } : {})
  }
}

function serializeBookletSource(source: BookletSource): SerializedBookletSource {
  const { bytes, ...serializableSource } = source

  return {
    ...serializableSource,
    bytesBase64: uint8ArrayToBase64(bytes)
  }
}

function serializeBookletPage(page: BookletPage): SerializedBookletPage {
  const { thumbnailUrl: _thumbnailUrl, ...serializablePage } = page

  return serializablePage
}

function serializePieceSource(source: PieceSourceFile): SerializedPieceSourceFile {
  const { bytes, previewUrl: _previewUrl, ...serializableSource } = source

  return {
    ...serializableSource,
    bytesBase64: uint8ArrayToBase64(bytes)
  }
}

function serializePiecePreset(piece: PiecePreset): SerializedPiecePreset {
  const { previewUrl: _piecePreviewUrl, artwork, ...serializablePiece } = piece
  const { previewUrl: _artworkPreviewUrl, ...serializableArtwork } = artwork

  return {
    ...serializablePiece,
    artwork: serializableArtwork
  }
}

function getBookletProjectName(sources: BookletSource[], pages: BookletPage[]): string {
  const firstSourceName = sources[0]?.name

  if (firstSourceName) {
    return stripFileExtension(firstSourceName)
  }

  return pages.length > 0 ? 'Booklet Montage Project' : 'Untitled Booklet Project'
}

function getBookletProjectSummary(
  sources: BookletSource[],
  pages: BookletPage[],
  sheetBoardState: SheetBoardState
): string {
  const emptySheetCount = sheetBoardState.items.filter((item) => item.kind === 'empty-sheet').length
  const parts = [formatCount(pages.length, 'page'), formatCount(sources.length, 'source')]

  if (emptySheetCount > 0) {
    parts.push(formatCount(emptySheetCount, 'empty sheet'))
  }

  return parts.join(', ')
}

function getCutterProjectName(pieces: PiecePreset[], sources: PieceSourceFile[]): string {
  const firstPieceName = pieces[0]?.displayName

  if (firstPieceName) {
    return firstPieceName
  }

  const firstSourceName = sources[0]?.displayName ?? sources[0]?.fileName

  return firstSourceName ? stripFileExtension(firstSourceName) : 'Untitled Cutter Project'
}

function getCutterProjectSummary(
  sources: PieceSourceFile[],
  pieces: PiecePreset[],
  placedPieces: PlacedPiece[]
): string {
  return [
    formatCount(pieces.length, 'piece preset'),
    formatCount(placedPieces.length, 'placed piece'),
    formatCount(sources.length, 'source')
  ].join(', ')
}

function getHardcoverQuoteTotal(state: HardcoverProjectState): number {
  const quote = state.job.quote
  const subtotal =
    Math.max(0, quote.materialCost + quote.printCost + quote.finishingCost + quote.designCost) *
    Math.max(1, quote.quantity)
  return Math.max(0, subtotal - Math.max(0, quote.discount))
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

function base64ToUint8Array(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function sanitizeProjectFileName(name: string): string {
  const sanitized = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return sanitized || 'Untitled Project'
}

function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

function createProjectId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `project-${crypto.randomUUID()}`
  }

  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
