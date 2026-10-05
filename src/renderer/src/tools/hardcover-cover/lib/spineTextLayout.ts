import type { SpineContent, SpineTextLayout, SpineTextLayoutItem } from '../types'
import { wrapTextByCharacters } from './textFit'

const POINT_TO_MM = 0.352778
const AVERAGE_CHARACTER_WIDTH_MM_PER_POINT = 0.2
const LINE_HEIGHT = 1.18
const MIN_FONT_SIZE_PT = 6
const MAX_AUTO_FONT_SIZE_PT = 36
// A4-sized reference. Scale in both physical axes; the per-item fit limits
// below still enforce the actual text length and number of printed lines.
const REFERENCE_SPINE_WIDTH_MM = 20
const REFERENCE_SPINE_LENGTH_MM = 287
const REFERENCE_FONT_SIZE_PT = 16
const SPINE_END_INSET_MM = 2
const SPINE_ITEM_GAP_MM = 4

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
  const scale = Math.sqrt(
    (Math.max(spineWidthMm, 0) / REFERENCE_SPINE_WIDTH_MM) *
      (availableLength / REFERENCE_SPINE_LENGTH_MM)
  )
  const maxFontSize = spine.autoFit
    ? Math.min(MAX_AUTO_FONT_SIZE_PT, Math.max(MIN_FONT_SIZE_PT, REFERENCE_FONT_SIZE_PT * scale))
    : Math.max(MIN_FONT_SIZE_PT, spine.fontSizePt)
  const titleLineCount = Math.max(
    1,
    Math.min(3, Math.floor(safeWidthMm / (MIN_FONT_SIZE_PT * POINT_TO_MM * LINE_HEIGHT)))
  )
  const items = [
    createLayoutItem({
      role: 'year',
      text: spine.year,
      centerFromTopMm: availableLength * 0.13,
      maxLengthMm: availableLength,
      maxLines: 1,
      maxFontSize
    }),
    createLayoutItem({
      role: 'title',
      text: spine.shortTitle,
      centerFromTopMm: availableLength * 0.5,
      maxLengthMm: availableLength,
      maxLines: titleLineCount,
      maxFontSize
    }),
    createLayoutItem({
      role: 'studentName',
      text: spine.studentName,
      centerFromTopMm: availableLength * 0.87,
      maxLengthMm: availableLength,
      maxLines: 1,
      maxFontSize
    })
  ].filter((item): item is SpineTextLayoutCandidate => item.lines.length > 0)

  if (items.length === 0) {
    return { fontSizePt: Number(maxFontSize.toFixed(1)), lines: [''], items: [], fits: true }
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

  const widthConstrainedItems = items.map((item) => ({
    ...item,
    fontSizePt: constrainItemWidth(item, safeWidthMm)
  }))
  const group = fitSpineGroup(widthConstrainedItems, availableLength)
  const constrainedItems = group.items
  const fits = group.fits && constrainedItems.every((item) => itemFits(item, safeWidthMm))
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

/** Fit the whole spine instead of imposing a fixed 46% length on its title. */
function fitSpineGroup(
  items: SpineTextLayoutCandidate[],
  availableLength: number
): { items: SpineTextLayoutCandidate[]; fits: boolean } {
  const spaceForText = Math.max(
    0,
    availableLength - SPINE_END_INSET_MM * 2 - SPINE_ITEM_GAP_MM * Math.max(0, items.length - 1)
  )
  const totalLength = items.reduce(
    (sum, item) => sum + estimateLineLengthMm(getLongestLineLength(item.lines), item.fontSizePt),
    0
  )
  const scale = totalLength > 0 ? Math.min(1, spaceForText / totalLength) : 1
  const fitted = items.map((item) => ({
    ...item,
    fontSizePt: Math.max(
      MIN_FONT_SIZE_PT,
      Math.floor((item.fontSizePt * scale + Number.EPSILON) * 10) / 10
    ),
    maxLengthMm: spaceForText
  }))
  const lengthOf = (role: SpineTextLayoutItem['role']): number => {
    const item = fitted.find((candidate) => candidate.role === role)
    return item ? estimateLineLengthMm(getLongestLineLength(item.lines), item.fontSizePt) : 0
  }
  const yearLength = lengthOf('year')
  const nameLength = lengthOf('studentName')
  const year = fitted.find((item) => item.role === 'year')
  const title = fitted.find((item) => item.role === 'title')
  const student = fitted.find((item) => item.role === 'studentName')
  if (year)
    year.centerFromTopMm = Math.min(availableLength / 2, SPINE_END_INSET_MM + yearLength / 2)
  if (student)
    student.centerFromTopMm = Math.max(
      availableLength / 2,
      availableLength - SPINE_END_INSET_MM - nameLength / 2
    )
  if (title) {
    const start = SPINE_END_INSET_MM + (year ? yearLength + SPINE_ITEM_GAP_MM : 0)
    const end =
      availableLength - SPINE_END_INSET_MM - (student ? nameLength + SPINE_ITEM_GAP_MM : 0)
    title.centerFromTopMm = Math.max(0, Math.min(availableLength, (start + end) / 2))
    title.maxLengthMm = Math.max(0, end - start)
  }
  const usedLength = fitted.reduce(
    (sum, item) => sum + estimateLineLengthMm(getLongestLineLength(item.lines), item.fontSizePt),
    0
  )
  return { items: fitted, fits: usedLength <= spaceForText }
}

export function syncSpineAutoFitFontSize(
  spine: SpineContent,
  layout: SpineTextLayout
): SpineContent {
  if (!spine.autoFit || Math.abs(spine.fontSizePt - layout.fontSizePt) < 0.05) {
    return spine
  }

  return { ...spine, fontSizePt: layout.fontSizePt }
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
  const explicitLines =
    role === 'title' && /[\r\n]/.test(normalized)
      ? normalized
          .split(/\r\n|[\r\n]/)
          .map((line) => line.trim().replace(/\s+/g, ' '))
          .filter(Boolean)
      : undefined
  const wrappedLines = explicitLines ?? wrapTextByCharacters(normalized, maxCharacters)
  const lines =
    explicitLines || wrappedLines.length <= maxLines
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
  const lengthLimitedPt =
    item.maxLengthMm / (getLongestLineLength(item.lines) * AVERAGE_CHARACTER_WIDTH_MM_PER_POINT)
  const fontSizePt = Math.max(
    MIN_FONT_SIZE_PT,
    Math.min(item.fontSizePt, widthLimitedPt, lengthLimitedPt)
  )

  // Never round up past the fitted physical length/width boundary.
  return Math.floor((fontSizePt + Number.EPSILON) * 10) / 10
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
