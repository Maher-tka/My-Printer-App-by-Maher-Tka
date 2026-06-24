import type { SpineContent, SpineTextLayout } from '../types'
import { wrapTextByCharacters } from './textFit'

export function calculateSpineTextLayout(
  spine: SpineContent,
  spineWidthMm: number,
  availableLengthMm: number
): SpineTextLayout {
  const text = [spine.studentName, spine.shortTitle, spine.year].filter(Boolean).join(' - ')
  const maxFontSize = spine.autoFit ? 18 : spine.fontSizePt
  const minFontSize = 6
  const safeWidthMm = Math.max(spineWidthMm - 4, 0)

  if (!text) {
    return { fontSizePt: maxFontSize, lines: [''], fits: true }
  }

  if (safeWidthMm < 4) {
    return {
      fontSizePt: minFontSize,
      lines: [text],
      fits: false,
      warning: 'Spine is too narrow for safe text.'
    }
  }

  const maxCharsPerLine = Math.max(10, Math.floor(availableLengthMm / 2.2))
  const lines = wrapTextByCharacters(text, maxCharsPerLine).slice(0, 2)
  const longestLine = Math.max(...lines.map((line) => line.length), 1)
  const widthLimitedPt = (safeWidthMm / Math.max(lines.length, 1)) * 2.2
  const lengthLimitedPt = (availableLengthMm / (longestLine * 0.42)) * 0.75
  const fontSizePt = Math.max(
    minFontSize,
    Math.min(maxFontSize, spine.autoFit ? widthLimitedPt : maxFontSize, lengthLimitedPt)
  )
  const estimatedLengthMm = longestLine * fontSizePt * 0.42
  const fits = fontSizePt >= minFontSize && estimatedLengthMm <= availableLengthMm

  return {
    fontSizePt: Number(fontSizePt.toFixed(1)),
    lines,
    fits,
    warning: fits ? undefined : 'Spine title is too long even at the minimum safe size.'
  }
}
