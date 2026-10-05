import type { CardMontageDraft } from '../types'
import { exportCardMontagePdf } from './exportPdf'

export type CardPrintSide = 'front' | 'back' | 'both'

export function getCardPrintSetupError(
  draft: CardMontageDraft,
  side: CardPrintSide,
  copies: number
): string | null {
  if (!['front', 'back', 'both'].includes(side)) return 'Choose a side to print.'
  if (!Number.isInteger(copies) || copies < 1 || copies > 999) return 'Enter 1 to 999 copies.'
  if ((side === 'front' || side === 'both') && !draft.artwork) return 'Import the front design.'
  if ((side === 'back' || side === 'both') && !draft.back) return 'Import the back design.'
  const artworks =
    side === 'both'
      ? [draft.artwork!, draft.back!]
      : [side === 'front' ? draft.artwork! : draft.back!]
  const missing = [
    ...new Set(
      artworks.flatMap(
        (art) =>
          art.pdfInfo?.pages
            .find((page) => page.pageNumber === art.pageNumber)
            ?.fonts.filter((font) => !font.embedded)
            .map((font) => font.name) ?? []
      )
    )
  ]
  if (missing.length) return `Font data is missing: ${missing.join(', ')}.`
  return null
}

export async function createCardPrintPdf(
  draft: CardMontageDraft,
  side: CardPrintSide
): Promise<Uint8Array> {
  const error = getCardPrintSetupError(draft, side, 1)
  if (error) throw new Error(error)
  return exportCardMontagePdf(
    side === 'back' ? draft.back! : draft.artwork!,
    { ...draft.settings, includeBack: side === 'both', exportAllPdfPages: false },
    side === 'both' ? draft.back : null
  )
}
