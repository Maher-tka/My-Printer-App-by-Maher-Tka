import type { CutterProject } from '../types'
import type { FineCutHandoffRequest } from '../../../../../shared/finecut-handoff'
import { exportCutterSvg } from './svgExport'
import { getSingleProductionSheetProject } from './productionSheets'
export async function createFineCutHandoff(
  project: CutterProject,
  sheetIndex: number,
  includeProductionLabel = false
): Promise<FineCutHandoffRequest> {
  const sheet = getSingleProductionSheetProject(project, sheetIndex)
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
  const sources = new Map(sheet.sources.map((source) => [source.id, source]))
  const pieces = new Map(sheet.pieces.map((piece) => [piece.id, piece]))
  const usedSourceIds = new Set(
    sheet.placedPieces.map((placed) => pieces.get(placed.presetId)?.sourceId)
  )
  const estimatedBytes = Array.from(usedSourceIds).reduce((total, id) => {
    const source = sources.get(id ?? '')
    return (
      total + (source?.previewDataUrl?.length ?? Math.ceil(((source?.bytes.length ?? 0) * 4) / 3))
    )
  }, sheet.placedPieces.length * 2048)
  if (estimatedBytes > 100 * 1024 * 1024)
    throw new Error(
      'This layout is too large for Illustrator export. Use a smaller batch or smaller artwork files.'
    )
  const svg = await exportCutterSvg(
    {
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
        includeProductionLabel
      }
    },
    true
  )
  return {
    svg: await svg.blob.text(),
    widthMm: sheet.sheet.widthCm * 10,
    heightMm: sheet.sheet.heightCm * 10
  }
}
