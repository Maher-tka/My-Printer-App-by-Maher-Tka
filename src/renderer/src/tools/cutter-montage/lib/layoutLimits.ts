import type { PiecePreset } from '../types'

export const MAX_CUTTER_JOB_COPIES = 5000
export const CUTTER_QUANTITY_LIMIT_MESSAGE =
  'Use a whole number from 1 to 5,000 copies. Maximum 5,000 stickers per job; split larger orders into batches. Your existing sheet is kept.'

export function getCutterOrderLimitMessage(pieces: Pick<PiecePreset, 'quantity'>[]): string | null {
  let total = 0
  for (const piece of pieces) {
    // Zero is used internally when arranging only selected designs.
    if (!Number.isSafeInteger(piece.quantity) || piece.quantity < 0)
      return CUTTER_QUANTITY_LIMIT_MESSAGE
    total += piece.quantity
    if (total > MAX_CUTTER_JOB_COPIES) return CUTTER_QUANTITY_LIMIT_MESSAGE
  }
  return null
}
