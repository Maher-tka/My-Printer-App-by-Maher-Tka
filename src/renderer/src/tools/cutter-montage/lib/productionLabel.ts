import type { CutterProject, ProductionLabelPosition, ProductionLabelSize } from '../types'
import { escapeXml } from './cutlineGenerator'

const CM_TO_MM = 10

export interface ProductionLabelLayout {
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  fontSizePt: number
  lines: string[]
}

export function getProductionLabelLayout(
  project: CutterProject,
  date = new Date()
): ProductionLabelLayout | null {
  const label = project.sheet.productionLabel

  if (!label?.enabled || project.exportSettings.includeProductionLabel === false) {
    return null
  }

  const lines = getProductionLabelLines(project, date)
  const fontSizePt = label.size === 'medium' ? 8 : 6
  const widthMm = label.size === 'medium' ? 74 : 58
  const heightMm = Math.max((fontSizePt * 0.36 + 1.2) * lines.length + 4, 14)
  const marginMm = project.sheet.productionLabel?.placement === 'inside-sheet' ? 8 : 2
  const safeMm = Math.max(project.sheet.safeMarginCm * CM_TO_MM, 0)
  const sheetWidthMm = project.sheet.widthCm * CM_TO_MM
  const sheetHeightMm = project.sheet.heightCm * CM_TO_MM
  const insetMm = label.placement === 'inside-sheet' ? safeMm + marginMm : marginMm
  const position = label.position

  return {
    xMm: position.endsWith('right') ? sheetWidthMm - insetMm - widthMm : insetMm,
    yMm: position.startsWith('bottom') ? sheetHeightMm - insetMm - heightMm : insetMm,
    widthMm,
    heightMm,
    fontSizePt,
    lines
  }
}

export function getProductionLabelSvgMarkup(project: CutterProject, date = new Date()): string {
  const layout = getProductionLabelLayout(project, date)

  if (!layout) return ''

  const lineHeightMm = layout.fontSizePt * 0.36 + 1.2
  const textX = layout.xMm + 2
  const firstY = layout.yMm + 4

  return [
    `<g id="ProductionInfo" data-production-label="true">`,
    `<rect x="${formatNumber(layout.xMm)}" y="${formatNumber(layout.yMm)}" width="${formatNumber(layout.widthMm)}" height="${formatNumber(layout.heightMm)}" fill="white" fill-opacity="0.86" stroke="#475569" stroke-width="0.2" />`,
    ...layout.lines.map(
      (line, index) =>
        `<text x="${formatNumber(textX)}" y="${formatNumber(firstY + index * lineHeightMm)}" font-size="${formatNumber(layout.fontSizePt)}pt" fill="#0f172a">${escapeXml(line)}</text>`
    ),
    '</g>'
  ].join('\n')
}

export function getProductionLabelLines(project: CutterProject, date = new Date()): string[] {
  const jobName = project.productionInfo?.jobName || project.pieces[0]?.displayName || 'Cutter Job'
  const designCount = new Set(project.pieces.map((piece) => piece.sourceId)).size

  return [
    `Job: ${jobName}`,
    `Date: ${formatDate(date)}`,
    `Sheet: ${project.sheet.widthCm} x ${project.sheet.heightCm} cm`,
    `Roll: ${project.sheet.rollWidthCm} cm`,
    `Pieces: ${project.placedPieces.length} placed / ${project.pieces.length} designs`,
    `Mode: ${project.exportSettings.preset ?? project.exportSettings.mode ?? 'print-cut'}`,
    `Spot: ${project.exportSettings.strokeName}`,
    `App: ${project.productionInfo?.appName ?? 'My Printer App by Maher Tka'}`,
    `Designs: ${designCount}`
  ]
}

export function getProductionLabelPositionLabel(position: ProductionLabelPosition): string {
  if (position === 'top-left') return 'Top left'
  if (position === 'top-right') return 'Top right'
  if (position === 'bottom-right') return 'Bottom right'
  return 'Bottom left'
}

export function getProductionLabelSizeLabel(size: ProductionLabelSize): string {
  return size === 'medium' ? 'Medium' : 'Small'
}

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 16)
}

function formatNumber(value: number): string {
  return Number(value.toFixed(4)).toString()
}
