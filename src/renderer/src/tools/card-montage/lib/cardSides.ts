import type { CardArtwork, CardMontageDraft } from '../types'
import { suggestCardSize } from './cardSize'

export function shareCardPagePreviews(
  draft: CardMontageDraft,
  side: 'front' | 'back',
  next: CardArtwork
): CardMontageDraft {
  const other = side === 'front' ? draft.back : draft.artwork
  const result = side === 'front' ? { ...draft, artwork: next } : { ...draft, back: next }
  if (next.kind !== 'pdf' || other?.kind !== 'pdf' || next.bytesBase64 !== other.bytesBase64)
    return result
  const previews = [
    ...new Map(
      [...(other.pagePreviews ?? []), ...(next.pagePreviews ?? [])].map((page) => [
        page.pageNumber,
        page
      ])
    ).values()
  ].sort((a, b) => a.pageNumber - b.pageNumber)
  return {
    ...result,
    artwork: result.artwork ? { ...result.artwork, pagePreviews: previews } : null,
    back: result.back ? { ...result.back, pagePreviews: previews } : null
  }
}

export function assignCardFile(
  draft: CardMontageDraft,
  side: 'front' | 'back',
  artwork: CardArtwork,
  pairedBack?: CardArtwork | null
): CardMontageDraft {
  if (side === 'back')
    return {
      ...draft,
      back: artwork,
      settings: { ...draft.settings, includeBack: true, exportAllPdfPages: false }
    }
  const size = suggestCardSize(artwork.widthMm, artwork.heightMm)
  const back = pairedBack === undefined ? (draft.back ?? null) : pairedBack
  return {
    artwork,
    back,
    settings: {
      ...draft.settings,
      widthMm: size.widthMm,
      heightMm: size.heightMm,
      includeBack:
        pairedBack === undefined ? Boolean(back && draft.settings.includeBack) : Boolean(back),
      exportAllPdfPages: back ? false : draft.settings.exportAllPdfPages
    }
  }
}
