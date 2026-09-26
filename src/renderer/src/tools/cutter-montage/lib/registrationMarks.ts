import type { CutterProject, CutterRegistrationSettings, PlacedPiece } from '../types'
import { escapeXml } from './cutlineGenerator'

const CM_TO_MM = 10
export const MIMAKI_TYPE_1_STROKE_MM = 1
export const MIMAKI_DIRECTION_MARK_WIDTH_MM = 3
export const MIMAKI_DIRECTION_MARK_HEIGHT_MM = 2.6

export type RegistrationMarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'direction'

export interface RegistrationMark {
  id: string
  position: RegistrationMarkPosition
  xMm: number
  yMm: number
  sizeMm: number
  strokeWidthMm: number
  color: string
  type: CutterRegistrationSettings['type']
  boundsCm: {
    xCm: number
    yCm: number
    widthCm: number
    heightCm: number
  }
}

/**
 * Generate the marks on the final, per-sheet page size. Mimaki marks use the
 * same Type 1 layout found in the shop's proven FineCut PDFs: four 10 mm L
 * corners with a 1 mm line plus the bottom feed-direction triangle.
 */
export function getRegistrationMarks(project: CutterProject): RegistrationMark[] {
  const settings = project.sheet.registrationMarks

  if (!settings?.enabled) return []

  const widthMm = project.sheet.widthCm * CM_TO_MM
  const heightMm = project.sheet.heightCm * CM_TO_MM
  const sizeMm = clamp(settings.sizeMm, 5, Math.min(widthMm, heightMm) / 3)
  const marginMm = clamp(
    settings.marginMm,
    0,
    Math.max(Math.min(widthMm, heightMm) / 2 - sizeMm, 0)
  )
  const color = settings.type === 'mimaki' ? '#000000' : settings.color || '#000000'
  const strokeWidthMm = settings.type === 'mimaki' ? MIMAKI_TYPE_1_STROKE_MM : 0.35
  const points = [
    ['top-left', marginMm, marginMm],
    ['top-right', widthMm - marginMm - sizeMm, marginMm],
    ['bottom-left', marginMm, heightMm - marginMm - sizeMm],
    ['bottom-right', widthMm - marginMm - sizeMm, heightMm - marginMm - sizeMm]
  ] as const
  const marks: RegistrationMark[] = points.map(([position, xMm, yMm]) => ({
    id: `registration-${position}`,
    position,
    xMm,
    yMm,
    sizeMm,
    strokeWidthMm,
    color,
    type: settings.type,
    boundsCm: {
      xCm: xMm / CM_TO_MM,
      yCm: yMm / CM_TO_MM,
      widthCm: sizeMm / CM_TO_MM,
      heightCm: sizeMm / CM_TO_MM
    }
  }))

  if (settings.type === 'mimaki') {
    const triangleWidthMm = Math.min(MIMAKI_DIRECTION_MARK_WIDTH_MM, widthMm)
    const triangleHeightMm = Math.min(MIMAKI_DIRECTION_MARK_HEIGHT_MM, heightMm)
    const xMm = (widthMm - triangleWidthMm) / 2
    const yMm = heightMm - marginMm - triangleHeightMm

    marks.push({
      id: 'registration-direction',
      position: 'direction',
      xMm,
      yMm,
      sizeMm: triangleWidthMm,
      strokeWidthMm: 0,
      color,
      type: settings.type,
      boundsCm: {
        xCm: xMm / CM_TO_MM,
        yCm: yMm / CM_TO_MM,
        widthCm: triangleWidthMm / CM_TO_MM,
        heightCm: triangleHeightMm / CM_TO_MM
      }
    })
  }

  return marks
}

export function getRegistrationMarksSvgMarkup(project: CutterProject): string {
  return getRegistrationMarks(project).map(markToSvg).join('\n')
}

export function getRegistrationMarkOverlapIds(project: CutterProject): string[] {
  const marks = getRegistrationMarks(project)

  if (marks.length === 0) return []

  return project.placedPieces
    .filter((piece) => marks.some((mark) => rectanglesOverlap(mark.boundsCm, piece)))
    .map((piece) => piece.id)
}

export function getRegistrationMarkOutOfBoundsCount(project: CutterProject): number {
  const epsilonCm = 0.000001

  return getRegistrationMarks(project).filter((mark) => {
    const rightCm = mark.boundsCm.xCm + mark.boundsCm.widthCm
    const bottomCm = mark.boundsCm.yCm + mark.boundsCm.heightCm

    return (
      mark.boundsCm.xCm < -epsilonCm ||
      mark.boundsCm.yCm < -epsilonCm ||
      rightCm > project.sheet.widthCm + epsilonCm ||
      bottomCm > project.sheet.heightCm + epsilonCm
    )
  }).length
}

export function shouldIncludeRegistrationInArtwork(project: CutterProject): boolean {
  const mode = project.sheet.registrationMarks?.includeIn ?? 'artwork'

  return Boolean(
    project.sheet.registrationMarks?.enabled &&
    project.exportSettings.includeRegistrationMarks !== false &&
    (mode === 'artwork' || mode === 'both')
  )
}

export function shouldIncludeRegistrationLayer(project: CutterProject): boolean {
  const mode = project.sheet.registrationMarks?.includeIn ?? 'artwork'

  return Boolean(
    project.sheet.registrationMarks?.enabled &&
    project.exportSettings.includeRegistrationMarks !== false &&
    (mode === 'registration' || mode === 'both')
  )
}

function markToSvg(mark: RegistrationMark): string {
  if (mark.type === 'mimaki') return mimakiMarkToSvg(mark)

  const common = `data-registration-mark="${escapeXml(mark.id)}" fill="none" stroke="${escapeXml(mark.color)}" stroke-width="${formatNumber(mark.strokeWidthMm)}mm" vector-effect="non-scaling-stroke"`
  const cx = mark.xMm + mark.sizeMm / 2
  const cy = mark.yMm + mark.sizeMm / 2

  if (mark.type === 'corner-square') {
    return `<rect x="${formatNumber(mark.xMm)}" y="${formatNumber(mark.yMm)}" width="${formatNumber(mark.sizeMm)}" height="${formatNumber(mark.sizeMm)}" fill="${escapeXml(mark.color)}" data-registration-mark="${escapeXml(mark.id)}" />`
  }

  if (mark.type === 'circle') {
    return `<circle cx="${formatNumber(cx)}" cy="${formatNumber(cy)}" r="${formatNumber(mark.sizeMm / 2)}" ${common} />`
  }

  const half = mark.sizeMm / 2

  return [
    `<line x1="${formatNumber(cx - half)}" y1="${formatNumber(cy)}" x2="${formatNumber(cx + half)}" y2="${formatNumber(cy)}" ${common} />`,
    `<line x1="${formatNumber(cx)}" y1="${formatNumber(cy - half)}" x2="${formatNumber(cx)}" y2="${formatNumber(cy + half)}" ${common} />`
  ].join('')
}

function mimakiMarkToSvg(mark: RegistrationMark): string {
  if (mark.position === 'direction') {
    const halfWidth = mark.sizeMm / 2
    const centerX = mark.xMm + halfWidth
    const bottomY = mark.yMm + MIMAKI_DIRECTION_MARK_HEIGHT_MM

    return `<path id="MimakiFCRMDir" d="M ${formatNumber(centerX)} ${formatNumber(bottomY)} L ${formatNumber(mark.xMm)} ${formatNumber(mark.yMm)} L ${formatNumber(mark.xMm + mark.sizeMm)} ${formatNumber(mark.yMm)} Z" fill="${escapeXml(mark.color)}" stroke="none" data-registration-mark="${escapeXml(mark.id)}" data-mimaki-mark="direction" />`
  }

  const x = mark.xMm
  const y = mark.yMm
  const right = x + mark.sizeMm
  const bottom = y + mark.sizeMm
  const path =
    mark.position === 'top-left'
      ? `M ${formatNumber(x)} ${formatNumber(bottom)} H ${formatNumber(right)} V ${formatNumber(y)}`
      : mark.position === 'top-right'
        ? `M ${formatNumber(right)} ${formatNumber(bottom)} H ${formatNumber(x)} V ${formatNumber(y)}`
        : mark.position === 'bottom-left'
          ? `M ${formatNumber(x)} ${formatNumber(y)} H ${formatNumber(right)} V ${formatNumber(bottom)}`
          : `M ${formatNumber(right)} ${formatNumber(y)} H ${formatNumber(x)} V ${formatNumber(bottom)}`

  return `<path id="MimakiFCRM-${mark.position}" d="${path}" fill="none" stroke="${escapeXml(mark.color)}" stroke-width="${formatNumber(mark.strokeWidthMm)}mm" stroke-linecap="butt" stroke-linejoin="miter" vector-effect="non-scaling-stroke" data-registration-mark="${escapeXml(mark.id)}" data-mimaki-mark="type-1" />`
}

function rectanglesOverlap(
  left: { xCm: number; yCm: number; widthCm: number; heightCm: number },
  right: Pick<PlacedPiece, 'xCm' | 'yCm' | 'widthCm' | 'heightCm'>
): boolean {
  return (
    left.xCm < right.xCm + right.widthCm &&
    left.xCm + left.widthCm > right.xCm &&
    left.yCm < right.yCm + right.heightCm &&
    left.yCm + left.heightCm > right.yCm
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function formatNumber(value: number): string {
  return Number(value.toFixed(4)).toString()
}
