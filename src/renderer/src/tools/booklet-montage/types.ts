export type BookletPageKind = 'pdf' | 'image' | 'blank'

export type BookletSourceKind = 'pdf' | 'image'

export type PaperSizeOption = 'A4' | 'A3' | 'SRA3' | 'custom'

export type PaperOrientation = 'portrait' | 'landscape'

export type BookletScaleMode = 'fit' | 'fill' | 'stretch'

export type ExportImageFormat = 'png' | 'jpg'

export type ExportQuality = 'standard' | 'high'

export interface BookletSource {
  id: string
  kind: BookletSourceKind
  name: string
  mimeType: string
  bytes: Uint8Array
  pageCount?: number
}

export interface BookletPage {
  id: string
  kind: BookletPageKind
  sourceId?: string
  sourceName?: string
  sourcePageIndex?: number
  displayName: string
  thumbnailUrl?: string
  widthMm: number
  heightMm: number
}

export interface SheetSettings {
  paperSize: PaperSizeOption
  orientation: PaperOrientation
  outputMode: 'front-back-pairs'
  customWidthMm: number
  customHeightMm: number
  marginMm: number
  gapMm: number
  bleedMm: number
  scaleMode: BookletScaleMode
  cropMarks: boolean
  registrationMarks: boolean
  exportQuality: ExportQuality
}

export interface ImportProgress {
  phase:
    | 'idle'
    | 'reading'
    | 'loading-page'
    | 'generating-thumbnails'
    | 'rendering'
    | 'done'
    | 'canceled'
    | 'error'
  current: number
  total: number
  message: string
  warning?: string
}

export interface ExportProgress {
  phase:
    | 'idle'
    | 'preparing-pages'
    | 'rendering-page'
    | 'creating-pdf'
    | 'saving-file'
    | 'done'
    | 'canceled'
    | 'error'
  current: number
  total: number
  message: string
}

export interface ImportedPagesResult {
  sources: BookletSource[]
  pages: BookletPage[]
}

export interface BookletSlot<TPage = BookletPage> {
  pageNumber: number
  page: TPage
}

export interface BookletSide<TPage = BookletPage> {
  sheetNumber: number
  side: 'front' | 'back'
  left: BookletSlot<TPage>
  right: BookletSlot<TPage>
}

export interface BookletSheet<TPage = BookletPage> {
  sheetNumber: number
  front: BookletSide<TPage>
  back: BookletSide<TPage>
}

export interface SizeMm {
  widthMm: number
  heightMm: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
