export type CoverUnit = 'mm' | 'cm'

export type CoverViewMode = 'layout' | 'clean' | 'print'

export type CoverMockupMode = 'flat' | 'folded' | 'spine' | 'front'

export type SpineDirection = 'bottom-to-top' | 'top-to-bottom'

export type HardcoverExportMode = 'print-final' | 'production-guide' | 'customer-preview'

export type CoverPresetId = 'a4' | 'a5' | 'custom'

export interface CoverMargins {
  topMm: number
  rightMm: number
  bottomMm: number
  leftMm: number
}

export interface CoverSetup {
  preset: CoverPresetId
  unit: CoverUnit
  bookWidthMm: number
  bookHeightMm: number
  spineWidthMm: number
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

export interface CoverDimensions {
  fullWidthMm: number
  fullHeightMm: number
  orientation: 'portrait' | 'landscape'
  back: CoverZone
  spine: CoverZone
  front: CoverZone
  safeBack: CoverZone
  safeSpine: CoverZone
  safeFront: CoverZone
  warnings: string[]
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
  fits: boolean
  warning?: string
}

export interface HardcoverExportResult {
  bytes: Uint8Array
  fileName: string
  mimeType: string
}
