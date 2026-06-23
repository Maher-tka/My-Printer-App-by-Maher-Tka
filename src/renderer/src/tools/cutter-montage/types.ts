export type CutterUnit = 'cm' | 'mm'

export type CutterMode = 'piece-editor' | 'montage-sheet'

export type EditorObjectType = 'artwork' | 'mask' | 'cutline' | 'helper-shape'

export type EditorShapeType =
  | 'image'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'ellipse'
  | 'path'

export type EditorObjectRole = 'artwork' | 'clipping-mask' | 'cutline' | 'helper'

export type EditorTool =
  | 'select'
  | 'pan'
  | 'zoom'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'ellipse'
  | 'line'

export type CutlineShape = 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'custom-path'

export type MaskShape =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'ellipse'
  | 'square'
  | 'custom-polygon'

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

export interface EditorObject {
  id: string
  type: EditorObjectType
  shapeType: EditorShapeType
  role: EditorObjectRole
  name: string
  visible: boolean
  locked: boolean
  transform: ArtworkTransform
  fillColor?: string
  strokeColor?: string
  strokeWidthPt?: number
  strokeName?: string
  sourceId?: string
  pathData?: string
  offsetMm?: number
  exportEnabled?: boolean
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

export interface PieceMask {
  enabled: boolean
  shape: MaskShape
  transform: ArtworkTransform
}

export interface PieceHelperShape {
  id: string
  shape: MaskShape
  transform: ArtworkTransform
  role: 'helper'
  visible: boolean
  locked: boolean
}

export interface PieceObjectVisibility {
  artwork: boolean
  mask: boolean
  cutline: boolean
  helper: boolean
}

export interface PieceObjectLocks {
  artwork: boolean
  mask: boolean
  cutline: boolean
  helper: boolean
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
  mask: PieceMask
  cutline: PieceCutline
  helperShape?: PieceHelperShape
  artworkCutlineGrouped: boolean
  objectVisibility: PieceObjectVisibility
  objectLocks: PieceObjectLocks
  /** Canonical editor model. Legacy artwork/mask/cutline fields stay synchronized for old projects. */
  objects: EditorObject[]
  artworkObjectId: string
  maskObjectId?: string
  cutlineObjectId?: string
  helperObjectIds: string[]
  selectedObjectIds: string[]
  keyObjectId?: string
  groupLinked: boolean
  lockAspectRatio: boolean
  clippingMaskEnabled: boolean
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
  maskTransform: ArtworkTransform
  cutlineTransform: CutlineTransform
}

export interface CutterLayerVisibility {
  artwork: boolean
  cutlines: boolean
}

export interface SelectionState {
  placedPieceIds: string[]
  editorObjects: EditorObjectType[]
  editorObjectIds?: string[]
}

export interface KeyObjectState {
  object: EditorObjectType | null
  objectId?: string
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
