export const CUT_CONTOUR_NAME = 'CutContour'
export const CUT_CONTOUR_COLOR = '#ff00ff'

export function normalizeSpotName(value: string): string {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : CUT_CONTOUR_NAME
}
