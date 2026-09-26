import type { CutterExportResult, CutterProject } from '../types'
import { objectPath } from './pdfProductionLayers'
import { CUT_CONTOUR_NAME } from './colorSpot'
import { getPlacedEditorObjectRect } from './cutlineGenerator'
import { getCutterExportSemantics } from './exportPresets'
import { cmToPoints } from './units'
import { getCutterFileName } from './svgExport'

export function exportCutterEps(project: CutterProject): CutterExportResult {
  const widthPt = cmToPoints(project.sheet.widthCm)
  const heightPt = cmToPoints(project.sheet.heightCm)
  const pieceMap = new Map(project.pieces.map((piece) => [piece.id, piece]))
  const lines = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%BoundingBox: 0 0 ${Math.ceil(widthPt)} ${Math.ceil(heightPt)}`,
    `%%HiResBoundingBox: 0 0 ${widthPt} ${heightPt}`,
    `%%Title: Cutter Montage - ${CUT_CONTOUR_NAME} Only`,
    '%%Creator: My Printer App by Maher Tka',
    `%%Note: EPS ${CUT_CONTOUR_NAME} Only export. Artwork is intentionally excluded.`,
    `%%DocumentCustomColors: (${CUT_CONTOUR_NAME})`,
    `%%CMYKCustomColor: 0 1 0 0 (${CUT_CONTOUR_NAME})`,
    '%%EndComments',
    `/${CUT_CONTOUR_NAME} { 1 0 1 setrgbcolor } bind def`,
    CUT_CONTOUR_NAME
  ]

  if (getCutterExportSemantics(project.exportSettings).contourRenderKind === 'production') {
    for (const placed of project.placedPieces) {
      const piece = pieceMap.get(placed.presetId)
      if (!piece) continue
      for (const object of piece.objects.filter(
        (item) => item.role === 'cutline' && item.exportEnabled !== false
      )) {
        const rect = getPlacedEditorObjectRect(placed, piece, object)
        lines.push(
          `% ${CUT_CONTOUR_NAME} geometry ${placed.id} ${object.id}`,
          'gsave',
          CUT_CONTOUR_NAME,
          `${object.strokeWidthPt ?? 0.25} setlinewidth`,
          'newpath'
        )
        let current = [0, 0]
        for (const operator of objectPath(object, rect, project.sheet.heightCm)) {
          const tokens = operator.toString().trim().split(/\s+/)
          const command = tokens.pop()
          const values = tokens.map(Number)
          if (command === 'h') lines.push('closepath')
          else if (command === 'm' || command === 'l') {
            lines.push(`${values.join(' ')} ${command === 'm' ? 'moveto' : 'lineto'}`)
            current = values.slice(-2)
          } else if (command === 'c' || command === 'v' || command === 'y') {
            const cubic =
              command === 'v'
                ? [...current, ...values]
                : command === 'y'
                  ? [...values, ...values.slice(-2)]
                  : values
            lines.push(`${cubic.join(' ')} curveto`)
            current = values.slice(-2)
          } else throw new Error(`Unsupported cutter path operator: ${command}`)
        }
        lines.push('stroke', 'grestore')
      }
    }
  }

  lines.push('showpage', '%%EOF')

  return {
    blob: new Blob([lines.join('\n')], { type: 'application/postscript' }),
    fileName: getCutterFileName(project.sheet.widthCm, project.sheet.heightCm, 'eps')
  }
}
