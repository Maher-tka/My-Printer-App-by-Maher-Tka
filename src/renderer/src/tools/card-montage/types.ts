import type { NumberArtwork } from '../sequential-number/types'
import type { PdfPageThumbnail } from '../shared/PdfPageSelector'

export interface CardPdfFont {
  name: string
  embedded: boolean
}

export interface CardArtwork extends NumberArtwork {
  pagePreviews?: PdfPageThumbnail[]
  pdfInfo?: {
    sourceFormat: 'pdf' | 'illustrator'
    pages: { pageNumber: number; fonts: CardPdfFont[] }[]
  }
}
export type CardMontageMode = 'zero' | 'spaced' | 'auto'

export interface CardMontageSettings {
  mode: CardMontageMode
  widthMm: number
  heightMm: number
  horizontalGapMm: number
  autoHorizontalGapMm?: number
  verticalGapMm: number
  marginMm: number
  orientation: 'portrait' | 'landscape'
  artworkFit: 'stretch' | 'contain'
  cutMarks: boolean
  cropMarkColor?: string
  cardOutline?: boolean
  cardOutlineColor?: string
  includeBack?: boolean
  exportAllPdfPages?: boolean
}

export interface CardMontageDraft {
  artwork: CardArtwork | null
  back?: CardArtwork | null
  settings: CardMontageSettings
}

export const DEFAULT_CARD_SETTINGS: CardMontageSettings = {
  mode: 'auto',
  widthMm: 85,
  heightMm: 55,
  horizontalGapMm: 2,
  autoHorizontalGapMm: 10,
  verticalGapMm: 2,
  marginMm: 5,
  orientation: 'portrait',
  artworkFit: 'stretch',
  cutMarks: true,
  cropMarkColor: '#000000',
  cardOutline: false,
  cardOutlineColor: '#000000',
  includeBack: false
}
