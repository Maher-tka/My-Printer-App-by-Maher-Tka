import type { CutterExportResult, CutterProject } from '../types'
import { getPlacedCutlineRect } from './cutlineGenerator'
import { cmToPoints } from './units'
import { getCutterFileName } from './svgExport'

export function exportCutterEps(project: CutterProject): CutterExportResult {
  const widthPt = cmToPoints(project.sheet.widthCm)
  const heightPt = cmToPoints(project.sheet.heightCm)
  const pieceMap = new Map(project.pieces.map((piece) => [piece.id, piece]))
  const lines = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%BoundingBox: 0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}`,
    '%%Title: Cutter Montage',
    '%%Creator: My Printer App by Maher Tka',
    '%%Note: EPS layer preservation varies between apps. CutContour vector paths are included.',
    '%%EndComments',
    '/CutContour { 1 0 1 setrgbcolor 0.25 setlinewidth } bind def',
    'CutContour'
  ]

  for (const placed of project.placedPieces) {
    const piece = pieceMap.get(placed.presetId)

    if (!piece) {
      continue
    }

    const rect = getPlacedCutlineRect(placed, piece)
    const x = cmToPoints(rect.xCm)
    const y = cmToPoints(project.sheet.heightCm - rect.yCm - rect.heightCm)
    const width = cmToPoints(rect.widthCm)
    const height = cmToPoints(rect.heightCm)

    if (piece.cutline.shape === 'ellipse') {
      lines.push(
        'gsave',
        `${(x + width / 2).toFixed(2)} ${(y + height / 2).toFixed(2)} translate`,
        `${(width / 2).toFixed(2)} ${(height / 2).toFixed(2)} scale`,
        '0 0 1 0 360 arc stroke',
        'grestore'
      )
    } else {
      lines.push(
        'newpath',
        `${x.toFixed(2)} ${y.toFixed(2)} moveto`,
        `${width.toFixed(2)} 0 rlineto`,
        `0 ${height.toFixed(2)} rlineto`,
        `${(-width).toFixed(2)} 0 rlineto`,
        'closepath stroke'
      )
    }
  }

  lines.push('showpage', '%%EOF')

  return {
    blob: new Blob([lines.join('\n')], { type: 'application/postscript' }),
    fileName: getCutterFileName(project.sheet.widthCm, project.sheet.heightCm, 'eps')
  }
}
