export interface NumberArtwork {
  name: string
  kind: 'pdf' | 'png' | 'jpeg'
  bytesBase64: string
  pageNumber: number
  pageCount: number
  widthMm: number
  heightMm: number
  previewDataUrl: string
}

export interface NumberPosition {
  kind?: 'number' | 'text'
  text?: string
  id: string
  xMm: number
  yMm: number
  fontSizePt: number
  color: string
  align: 'left' | 'center' | 'right'
}

export interface SequentialSettings {
  sheetPreset: 'a4' | 'a3' | 'custom'
  sheetWidthMm: number
  sheetHeightMm: number
  ticketWidthMm: number
  ticketHeightMm: number
  marginMm: number
  gapMm: number
  startNumber: number
  quantity: number
  increment: number
  digits: number
  prefix: string
  suffix: string
  order: 'sheet' | 'stack'
  backMode: 'none' | 'blank' | 'artwork'
  duplexFlip: 'long-edge' | 'short-edge'
  numberBack: boolean
  cropMarks: boolean
  gutterCutLines?: boolean
  cuttingLineColor?: string
}

export interface SequentialProject {
  name: string
  settings: SequentialSettings
  positions: NumberPosition[]
  front: NumberArtwork | null
  back: NumberArtwork | null
}

export interface NumberSlot {
  slotIndex: number
  row: number
  column: number
  xMm: number
  yMm: number
  sequenceIndex: number | null
  number: number | null
  label: string | null
}

export interface SequentialLayout {
  columns: number
  rows: number
  capacity: number
  sheetCount: number
  pdfPageCount: number
  errors: string[]
  warnings: string[]
}
