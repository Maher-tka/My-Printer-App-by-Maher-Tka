export type CoverUnit = 'mm' | 'cm'

export type CoverViewMode = 'layout' | 'clean' | 'print'

export type CoverMockupMode = 'flat' | 'folded' | 'spine' | 'front'

export type SpineDirection = 'bottom-to-top' | 'top-to-bottom'

export type HardcoverExportMode = 'print-final' | 'production-guide' | 'customer-preview'

export type CoverPresetId = 'a4' | 'a5' | 'custom'

export type BookDirection = 'ltr' | 'rtl'

export type HardcoverPdfFitMode = 'fit' | 'fill'

export interface CoverMargins {
  topMm: number
  rightMm: number
  bottomMm: number
  leftMm: number
}

export interface CoverSetup {
  preset: CoverPresetId
  unit: CoverUnit
  bookDirection: BookDirection
  boardWidthMm: number
  boardHeightMm: number
  bookWidthMm: number
  bookHeightMm: number
  spineWidthMm: number
  leftBandWidthMm: number
  rightBandWidthMm: number
  useSameBandWidth: boolean
  markLengthMm: number
  centerOnSheet: boolean
  wrap: CoverMargins
  hingeMm: number
  bleedMm: number
  paperWidthMm: number
  paperHeightMm: number
}

export interface CoverZone {
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export interface CoverGuideMark {
  xMm: number
  yStartMm: number
  yEndMm: number
  edge: 'top' | 'bottom'
}

export interface CoverDimensions {
  fullWidthMm: number
  fullHeightMm: number
  structureWidthMm: number
  structureHeightMm: number
  horizontalMarginMm: number
  verticalMarginMm: number
  orientation: 'portrait' | 'landscape'
  sheet: CoverZone
  leftBoard: CoverZone
  rightBoard: CoverZone
  leftBand: CoverZone
  rightBand: CoverZone
  back: CoverZone
  spine: CoverZone
  front: CoverZone
  safeBack: CoverZone
  safeSpine: CoverZone
  safeFront: CoverZone
  guideMarkPositionsMm: number[]
  guideMarks: CoverGuideMark[]
  warnings: string[]
}

export interface HardcoverPdfSource {
  fileName: string
  filePath?: string
  pageCount: number
  frontPageNumber: number
  backPageNumber?: number
  backCoverEnabled: boolean
  frontPageRotation?: number
  backPageRotation?: number
  fitMode: HardcoverPdfFitMode
  thumbnailDataUrl?: string
  backThumbnailDataUrl?: string
  pagePreviews?: HardcoverPdfPagePreview[]
  bytes?: Uint8Array
}

export interface HardcoverPdfPagePreview {
  pageNumber: number
  thumbnailDataUrl: string
  rotation: number
}

export interface HardcoverProductionPreset {
  id: string
  name: string
  paperWidthMm: number
  paperHeightMm: number
  boardWidthMm: number
  boardHeightMm: number
  spineWidthMm: number
  leftBandWidthMm: number
  rightBandWidthMm: number
  markLengthMm: number
  centerOnSheet: boolean
  cropMarks: boolean
  defaultDirection: BookDirection
}

export interface FrontCoverContent {
  studentName: string
  title: string
  degree: string
  university: string
  department: string
  supervisor: string
  academicYear: string
  logoDataUrl?: string
  backgroundDataUrl?: string
  showDecorativeLine: boolean
  direction: 'ltr' | 'rtl' | 'auto'
}

export interface SpineContent {
  studentName: string
  shortTitle: string
  year: string
  universityInitials: string
  direction: SpineDirection
  autoFit: boolean
  fontSizePt: number
}

export interface BackCoverContent {
  summary: string
  contactInfo: string
  qrText: string
  logoDataUrl?: string
  plain: boolean
  direction: 'ltr' | 'rtl' | 'auto'
}

export interface CoverContent {
  front: FrontCoverContent
  spine: SpineContent
  back: BackCoverContent
}

export interface CoverTemplate {
  id: string
  name: string
  description: string
  background: string
  backgroundAccent: string
  foreground: string
  mutedForeground: string
  fontFamily: string
  titleFontFamily: string
  decorativeStyle: 'line' | 'frame' | 'minimal' | 'foil' | 'leather'
  logoPlacement: 'top' | 'center' | 'bottom'
  safeInsetMm: number
  isCustom?: boolean
}

export interface BatchStudent {
  id: string
  studentName: string
  title: string
  year: string
  department: string
  supervisor: string
  spineTitle: string
}

export interface HardcoverExportSettings {
  mode: HardcoverExportMode
  includeFoldLines: boolean
  includeCropMarks: boolean
  includeSafeZones: boolean
  imageQuality: 'low' | 'balanced' | 'high'
}

export interface QuoteBreakdown {
  materialCost: number
  printCost: number
  finishingCost: number
  designCost: number
  quantity: number
  discount: number
  depositPaid: number
}

export interface QuoteSummary extends QuoteBreakdown {
  subtotal: number
  finalPrice: number
  remaining: number
}

export interface HardcoverJobDetails {
  customerName: string
  phoneNumber: string
  jobTitle: string
  notes: string
  status: 'draft' | 'ready-to-print' | 'printed' | 'delivered' | 'canceled'
  quote: QuoteBreakdown
}

export interface HardcoverProjectState {
  setup: CoverSetup
  sourcePdf?: HardcoverPdfSource
  productionPreset: HardcoverProductionPreset
  content: CoverContent
  template: CoverTemplate
  customTemplates: CoverTemplate[]
  batchStudents: BatchStudent[]
  exportSettings: HardcoverExportSettings
  viewMode: CoverViewMode
  mockupMode: CoverMockupMode
  showGuides: boolean
  showSafeZones: boolean
  snapToGuides: boolean
  zoom: number
  job: HardcoverJobDetails
}

export interface SpineTextLayout {
  fontSizePt: number
  lines: string[]
  items: SpineTextLayoutItem[]
  fits: boolean
  warning?: string
}

export interface SpineTextLayoutItem {
  role: 'year' | 'title' | 'studentName'
  lines: string[]
  fontSizePt: number
  centerFromTopMm: number
}

export interface HardcoverExportResult {
  bytes: Uint8Array
  fileName: string
  mimeType: string
}
