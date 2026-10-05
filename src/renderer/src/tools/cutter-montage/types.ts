export type CutterUnit = 'cm' | 'mm'

export type CutterMode = 'piece-editor' | 'montage-sheet'

export type EditorObjectType = 'artwork' | 'mask' | 'cutline' | 'helper-shape'

export type EditorShapeType = 'image' | 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'path'

export type EditorObjectRole = 'artwork' | 'clipping-mask' | 'cutline' | 'helper'

export type PieceSourceKind = 'image' | 'svg' | 'pdf-page'

export type PdfProductionClassification = 'artwork-only' | 'likely-print-and-cut' | 'ambiguous'

export type PdfProductionSourceFormat = 'pdf' | 'pdf-compatible-ai'

export interface PdfPhysicalSize {
  widthMm: number
  heightMm: number
}

export interface PdfPageBox {
  xPt: number
  yPt: number
  widthPt: number
  heightPt: number
  widthMm: number
  heightMm: number
}

export interface PdfPageBoxSummary {
  media?: PdfPageBox
  crop?: PdfPageBox
  trim?: PdfPageBox
  bleed?: PdfPageBox
  art?: PdfPageBox
}

export interface PdfProductionLayer {
  id: string
  name: string
  defaultVisible: boolean
  intent?: string[]
}

export interface PdfProductionColorant {
  kind: 'Separation' | 'DeviceN'
  name: string
}

export interface PdfPageProductionMetadata {
  pageNumber: number
  physicalSizeMm?: PdfPhysicalSize
  boxes?: PdfPageBoxSummary
}

/** Read-only production structure preserved alongside the original PDF bytes. */
export interface PdfProductionMetadata {
  sourceFormat: PdfProductionSourceFormat
  classification: PdfProductionClassification
  pageCount?: number
  pageSizeMm?: PdfPhysicalSize
  pageBoxes?: PdfPageBoxSummary
  pages?: PdfPageProductionMetadata[]
  layers: PdfProductionLayer[]
  colorants: PdfProductionColorant[]
  warnings: string[]
  notes: string[]
  creator?: string
}

export type RegistrationMarkType = 'corner-square' | 'cross' | 'circle' | 'mimaki'

export type RegistrationMarkLayerMode = 'artwork' | 'registration' | 'both'

export type ProductionLabelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export type ProductionLabelSize = 'small' | 'medium'

export type CutterSheetLengthMode = 'auto-trim-last' | 'fixed'

export type PieceOrderMode = 'copies' | 'target-length'

export type EditorTool =
  | 'select'
  | 'pan'
  | 'zoom'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'ellipse'
  | 'line'

export type CutlineShape = 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'custom-path'

export type MaskShape = 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'square' | 'custom-polygon'

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
  showSafeArea?: boolean
  showRollGuides?: boolean
  registrationMarks?: CutterRegistrationSettings
  productionLabel?: CutterProductionLabelSettings
  preferSameDesignGrouping?: boolean
  fillDirection?: 'left-to-right' | 'top-to-bottom'
  sortStrategy?: 'largest-first' | 'smallest-first' | 'piece-name' | 'quantity'
  /** Full sheets keep this packing length. Auto mode trims only the final sheet. */
  lengthMode?: CutterSheetLengthMode
  autoExpandHeight?: boolean
}

export interface CutterRegistrationSettings {
  /** Marks projects created after app-owned Mimaki registration was introduced. */
  profileVersion?: 1
  enabled: boolean
  type: RegistrationMarkType
  sizeMm: number
  marginMm: number
  color: string
  includeIn: RegistrationMarkLayerMode
}

export interface CutterProductionLabelSettings {
  enabled: boolean
  position: ProductionLabelPosition
  size: ProductionLabelSize
  placement: 'margin' | 'inside-sheet'
}

export interface PieceSourceFile {
  id: string
  sourceKind?: PieceSourceKind
  fileName: string
  displayName: string
  originalFileName?: string
  mimeType: string
  bytes: Uint8Array
  previewUrl: string
  previewDataUrl?: string
  pdfPageNumber?: number
  pageCount?: number
  pdfProductionMetadata?: PdfProductionMetadata
  pdfPageMetadata?: PdfPageProductionMetadata
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
  /** Objects with the same group id move together in the piece editor. */
  groupId?: string
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
  /** Physical offset already baked into an AI Sticker Maker vector path. */
  stickerMakerOffsetMm?: number
  sourceId: string
  sourceKind?: PieceSourceKind
  sourceFileName: string
  originalFileName?: string
  pdfPageNumber?: number
  pageCount?: number
  pdfProductionMetadata?: PdfProductionMetadata
  pdfPageMetadata?: PdfPageProductionMetadata
  displayName: string
  previewUrl: string
  naturalWidthPx: number
  naturalHeightPx: number
  widthCm: number
  heightCm: number
  quantity: number
  /** Customer order can be an exact copy count or a material length to fill. */
  orderMode?: PieceOrderMode
  targetLengthCm?: number
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
  objectModelInitialized?: boolean
  artworkObjectId?: string
  maskObjectId?: string
  cutlineObjectId?: string
  helperObjectIds: string[]
  selectedObjectIds: string[]
  keyObjectId?: string
  groupLinked: boolean
  lockAspectRatio: boolean
  clippingMaskEnabled: boolean
  /** Explicit clipping-group isolation; artwork and mask can be edited independently. */
  maskEditingEnabled?: boolean
  /** Version of the normalized clipping-mask workflow, when a mask has been prepared. */
  maskWorkflowVersion?: 2 | 3
  /** Artwork lock state to restore when the active clipping mask is released. */
  artworkLockBeforeMask?: boolean
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
  sheetIndex?: number
  productionBoundsCm?: {
    xCm: number
    yCm: number
    widthCm: number
    heightCm: number
  }
}

export interface CutterLayerVisibility {
  artwork: boolean
  cutlines: boolean
  helpers?: boolean
  artworkLocked?: boolean
  cutlinesLocked?: boolean
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
  includeRegistrationMarks?: boolean
  includeProductionLabel?: boolean
  mode?: 'print-cut' | 'print-only' | 'cut-only' | 'test-cut' | 'customer-preview'
  preset?:
    | 'illustrator-print-cut-svg'
    | 'layered-print-cut-pdf'
    | 'mimaki-cutcontour-svg'
    | 'pdf-print-only'
    | 'svg-eps-cut-only'
    | 'customer-preview'
    | 'svg-illustrator'
    | 'eps-cut-only'
    | 'pdf-test-cut'
}

export interface CutterProject {
  sheet: CutterSheetSettings
  sources: PieceSourceFile[]
  pieces: PiecePreset[]
  placedPieces: PlacedPiece[]
  layers: CutterLayerVisibility
  exportSettings: CutterExportSettings
  productionInfo?: CutterProductionInfo
}

export interface CutterProductionInfo {
  jobName?: string
  appName?: string
  targetCutterProfileId?: string
  targetCutterLabel?: string
  integrationMode?: 'finecut-handoff' | 'offline-mimaki-package'
}

export interface CutterLayoutResult {
  placedPieces: PlacedPiece[]
  placedCount: number
  requestedCount: number
  usedHeightCm: number
  sheetCount?: number
  usedAreaPercent?: number
  wasteAreaPercent?: number
  warning?: string
}

export interface CutterExportResult {
  blob: Blob
  fileName: string
}
