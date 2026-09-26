import type { CutterProject } from '../types'
import type { FineCutHandoffRequest } from '../../../../../shared/finecut-handoff'
import { exportCutterSvg } from './svgExport'
import { getProductionSheetProject } from './productionSheets'
export async function createFineCutHandoff(
  project: CutterProject,
  sheetIndex: number
): Promise<FineCutHandoffRequest> {
  const sheet = getProductionSheetProject(project, sheetIndex)
  if (!sheet.placedPieces.length)
    throw new Error('Arrange a production sheet before preparing a cutting job.')
  if (!sheet.sheet.registrationMarks?.enabled || sheet.sheet.registrationMarks.type !== 'mimaki')
    throw new Error('Enable Mimaki Type 1 registration marks before preparing the job.')
  const validPieces = new Set(
    sheet.pieces
      .filter((piece) =>
        piece.objects.some((object) => object.role === 'cutline' && object.exportEnabled !== false)
      )
      .map((piece) => piece.id)
  )
  if (sheet.placedPieces.some((piece) => !validPieces.has(piece.presetId)))
    throw new Error('Every placed sticker needs an enabled vector cut path.')
  const svg = await exportCutterSvg({
    ...sheet,
    layers: { artwork: true, cutlines: true },
    sheet: {
      ...sheet.sheet,
      registrationMarks: {
        ...sheet.sheet.registrationMarks,
        includeIn: 'registration',
        color: '#000000'
      }
    },
    exportSettings: {
      ...sheet.exportSettings,
      mode: 'print-cut',
      includeArtwork: true,
      includeCutlines: true,
      includeRegistrationMarks: true,
      includeProductionLabel: false
    }
  })
  return {
    svg: await svg.blob.text(),
    widthMm: sheet.sheet.widthCm * 10,
    heightMm: sheet.sheet.heightCm * 10
  }
}
