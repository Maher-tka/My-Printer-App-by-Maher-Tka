// CSS pixels have a physical size of 1/96 inch in the exported print layout.
export const CARD_CROP_LINE_WIDTH_PX = 0.25
export const CARD_CROP_LINE_WIDTH_PT = (CARD_CROP_LINE_WIDTH_PX * 72) / 96
export const CARD_CROP_LINE_WIDTH_MM = (CARD_CROP_LINE_WIDTH_PX * 25.4) / 96

export function getCardOutlineColor(color?: string): string {
  // Cutting guides must remain visible on white stock; never inherit the artwork fill.
  return !color || /^#ffffff$/i.test(color) ? '#000000' : color
}
