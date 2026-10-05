export const STANDARD_CARD_SIZES = [
  { widthMm: 85, heightMm: 55, label: '8.5 × 5.5 cm' },
  { widthMm: 80, heightMm: 50, label: '8 × 5 cm' }
] as const

export function suggestCardSize(widthMm: number, heightMm: number) {
  const longEdge = Math.max(widthMm, heightMm)
  const shortEdge = Math.min(widthMm, heightMm)
  // Keep a normal-sized original. A source over 20% larger than the larger
  // standard is treated as oversized (including high-resolution image imports).
  const oversized = longEdge > 85 * 1.2 || shortEdge > 55 * 1.2
  if (!oversized) return { widthMm, heightMm, adjusted: false }
  const ratio = longEdge / shortEdge
  const closest = [...STANDARD_CARD_SIZES].sort(
    (left, right) =>
      Math.abs(Math.log(ratio / (left.widthMm / left.heightMm))) -
      Math.abs(Math.log(ratio / (right.widthMm / right.heightMm)))
  )[0]
  return { widthMm: closest.widthMm, heightMm: closest.heightMm, adjusted: true }
}
