import type { SpineContent, SpineTextLayout, SpineTextLayoutItem } from '../types'
import { wrapTextByCharacters } from './textFit'

const POINT_TO_MM = 0.352778
const AVERAGE_CHARACTER_WIDTH_MM_PER_POINT = 0.2
const LINE_HEIGHT = 1.18
const MIN_FONT_SIZE_PT = 6

type SpineTextLayoutCandidate = SpineTextLayoutItem & {
  fits: boolean
  maxLengthMm: number
}

export function calculateSpineTextLayout(
  spine: SpineContent,
  spineWidthMm: number,
  availableLengthMm: number
): SpineTextLayout {
  const availableLength = Math.max(availableLengthMm, 0)
  const safeWidthMm = Math.max(spineWidthMm - 4, 0)
  const maxFontSize = spine.autoFit ? 16 : Math.max(MIN_FONT_SIZE_PT, spine.fontSizePt)
  const titleLineCount = Math.max(
    1,
    Math.min(3, Math.floor(safeWidthMm / (MIN_FONT_SIZE_PT * POINT_TO_MM * LINE_HEIGHT)))
  )
  const items = [
    createLayoutItem({
      role: 'year',
      text: spine.year,
      centerFromTopMm: availableLength * 0.13,
      maxLengthMm: availableLength * 0.24,
      maxLines: 1,
      maxFontSize
    }),
    createLayoutItem({
      role: 'title',
      text: spine.shortTitle,
      centerFromTopMm: availableLength * 0.5,
      maxLengthMm: availableLength * 0.46,
      maxLines: titleLineCount,
      maxFontSize
    }),
    createLayoutItem({
      role: 'studentName',
      text: spine.studentName,
      centerFromTopMm: availableLength * 0.87,
      maxLengthMm: availableLength * 0.24,
      maxLines: 1,
      maxFontSize
    })
  ].filter((item): item is SpineTextLayoutCandidate => item.lines.length > 0)

  if (items.length === 0) {
    return { fontSizePt: maxFontSize, lines: [''], items: [], fits: true }
  }

  if (safeWidthMm < 4) {
    return {
      fontSizePt: MIN_FONT_SIZE_PT,
      lines: items.flatMap((item) => item.lines),
      items: items.map(toPublicItem),
      fits: false,
      warning: 'Spine is too narrow for safe text.'
    }
  }

  const constrainedItems = items.map((item) => ({
    ...item,
    fontSizePt: constrainItemWidth(item, safeWidthMm)
  }))
  const fits = constrainedItems.every((item) => itemFits(item, safeWidthMm))
  const smallestFontSize = Math.min(...constrainedItems.map((item) => item.fontSizePt))

  return {
    fontSizePt: Number(smallestFontSize.toFixed(1)),
    lines: constrainedItems.flatMap((item) => item.lines),
    items: constrainedItems.map((item) =>
      toPublicItem({ ...item, fontSizePt: Number(item.fontSizePt.toFixed(1)) })
    ),
    fits,
    warning: fits ? undefined : 'Spine text is too long even at the minimum safe size.'
  }
}

function createLayoutItem({
  role,
  text,
  centerFromTopMm,
  maxLengthMm,
  maxLines,
  maxFontSize
}: {
  role: SpineTextLayoutItem['role']
  text: string
  centerFromTopMm: number
  maxLengthMm: number
  maxLines: number
  maxFontSize: number
}): SpineTextLayoutCandidate {
  const normalized = text.trim()
  if (!normalized) {
    return { role, lines: [], fontSizePt: maxFontSize, centerFromTopMm, fits: true, maxLengthMm }
  }

  const maxCharacters = Math.max(
    8,
    Math.floor(maxLengthMm / (maxFontSize * AVERAGE_CHARACTER_WIDTH_MM_PER_POINT))
  )
  const wrappedLines = wrapTextByCharacters(normalized, maxCharacters)
  const lines =
    wrappedLines.length <= maxLines
      ? wrappedLines
      : [...wrappedLines.slice(0, maxLines - 1), wrappedLines.slice(maxLines - 1).join(' ')]
  const longestLine = getLongestLineLength(lines)
  const lengthLimitedPt =
    longestLine > 0
      ? maxLengthMm / (longestLine * AVERAGE_CHARACTER_WIDTH_MM_PER_POINT)
      : maxFontSize
  const fontSizePt = Math.max(MIN_FONT_SIZE_PT, Math.min(maxFontSize, lengthLimitedPt))
  const fits =
    estimateLineLengthMm(longestLine, fontSizePt) <= maxLengthMm && fontSizePt >= MIN_FONT_SIZE_PT

  return {
    role,
    lines,
    fontSizePt: Number(fontSizePt.toFixed(1)),
    centerFromTopMm,
    fits,
    maxLengthMm
  }
}

function constrainItemWidth(item: SpineTextLayoutCandidate, safeWidthMm: number): number {
  const widthLimitedPt = safeWidthMm / Math.max(item.lines.length, 1) / LINE_HEIGHT / POINT_TO_MM
  const fontSizePt = Math.max(MIN_FONT_SIZE_PT, Math.min(item.fontSizePt, widthLimitedPt))

  return Number(fontSizePt.toFixed(1))
}

function itemFits(item: SpineTextLayoutCandidate, safeWidthMm: number): boolean {
  const longestLine = getLongestLineLength(item.lines)
  const textLengthFits = estimateLineLengthMm(longestLine, item.fontSizePt) <= item.maxLengthMm
  const textWidthFits =
    item.lines.length * item.fontSizePt * POINT_TO_MM * LINE_HEIGHT <= safeWidthMm

  return textLengthFits && textWidthFits
}

function toPublicItem({
  fits: _fits,
  maxLengthMm: _maxLengthMm,
  ...item
}: SpineTextLayoutCandidate): SpineTextLayoutItem {
  return item
}

function estimateLineLengthMm(characterCount: number, fontSizePt: number): number {
  return characterCount * fontSizePt * AVERAGE_CHARACTER_WIDTH_MM_PER_POINT
}

function getLongestLineLength(lines: string[]): number {
  return Math.max(...lines.map((line) => line.length), 1)
}
