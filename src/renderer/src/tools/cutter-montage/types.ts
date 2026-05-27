export type CutterUnit = 'cm' | 'mm'

export type CutterMode = 'piece-editor' | 'montage-sheet'

export type EditorObjectType = 'artwork' | 'cutline'

export type EditorTool = 'select' | 'pan' | 'zoom'

export type CutlineShape = 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'custom-path'

export type AlignmentCommand =
  | 'left'
  | 'center-horizontal'
  | 'right'
  | 'top'
  | 'center-vertical'
  | 'bottom'
  | 'distribute-horizontal'
  | 'distribute-vertical'

export interface CutterSheetSettings {
  widthCm: number
  heightCm: number
  rollWidthCm: number
  unit: CutterUnit
  safeMarginCm: number
  spacingMm: number
  snapToGrid: boolean
  gridStepCm: number
  allowRotation: boolean
  preserveManualPositions: boolean
  showGrid: boolean
}

export interface PieceSourceFile {
  id: string
  fileName: string
  displayName: string
  mimeType: string
  bytes: Uint8Array
  previewUrl: string
  naturalWidthPx: number
  naturalHeightPx: number
}

export interface ArtworkTransform {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotation: number
}

export interface CutlineTransform {
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotation: number
  offsetMm: number
}

export interface PieceArtwork {
  sourceId: string
  sourceFileName: string
  previewUrl: string
  transform: ArtworkTransform
}

export interface PieceCutline {
  shape: CutlineShape
  transform: CutlineTransform
  strokeName: string
  strokeColor: string
  strokeWidthPt: number
  customPathData?: string
}

export interface PiecePreset {
  id: string
  sourceId: string
  sourceFileName: string
  displayName: string
  previewUrl: string
  naturalWidthPx: number
  naturalHeightPx: number
  widthCm: number
  heightCm: number
  quantity: number
  rotationAllowed: boolean
  locked: boolean
  artwork: PieceArtwork
  cutline: PieceCutline
}

export interface PlacedPiece {
  id: string
  presetId: string
  sourceFileName: string
  displayName: string
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotation: 0 | 90 | 180 | 270
  locked: boolean
  artworkTransform: ArtworkTransform
  cutlineTransform: CutlineTransform
}

export interface CutterLayerVisibility {
  artwork: boolean
  cutlines: boolean
}

export interface SelectionState {
  placedPieceIds: string[]
  editorObjects: EditorObjectType[]
}

export interface KeyObjectState {
  object: EditorObjectType | null
}

export interface CutterExportSettings {
  strokeName: string
  includeArtwork: boolean
  includeCutlines: boolean
}

export interface CutterProject {
  sheet: CutterSheetSettings
  sources: PieceSourceFile[]
  pieces: PiecePreset[]
  placedPieces: PlacedPiece[]
  layers: CutterLayerVisibility
  exportSettings: CutterExportSettings
}

export interface CutterLayoutResult {
  placedPieces: PlacedPiece[]
  placedCount: number
  requestedCount: number
  usedHeightCm: number
  warning?: string
}

export interface CutterExportResult {
  blob: Blob
  fileName: string
}
