import type {
  IllustratorPdfExportRequest,
  IllustratorPdfBatchRequest
} from '../../../../../shared/illustrator-pdf-export'
import type { CutterProject } from '../types'
import { createFineCutHandoff } from './finecutHandoff'
import { getProductionSheetLayoutGroups } from './productionSheetGroups'

export async function createIllustratorPdfExport(
  project: CutterProject,
  sheetIndex = 0
): Promise<IllustratorPdfExportRequest> {
  const groups = getProductionSheetLayoutGroups(project)
  const groupIndex = groups.findIndex((group) => group.sheetIndices.includes(sheetIndex))
  if (groupIndex < 0) throw new Error('Select a production sheet before exporting.')
  const group = groups[groupIndex]
  const layout = await createFineCutHandoff(
    project,
    group.templateSheetIndex,
    project.exportSettings.includeProductionLabel !== false
  )
  return { layouts: [{ ...layout, repeatCount: group.repeatCount }], layoutNumber: groupIndex + 1 }
}

export async function createIllustratorPdfBatch(
  project: CutterProject
): Promise<IllustratorPdfBatchRequest> {
  const groups = getProductionSheetLayoutGroups(project)
  if (groups.length > 100)
    throw new Error(
      'Export up to 100 unique sheets at a time. Split this job into smaller batches.'
    )
  const sheets: IllustratorPdfExportRequest[] = []
  let bytes = 0
  for (const group of groups) {
    const sheet = await createIllustratorPdfExport(project, group.templateSheetIndex)
    bytes += sheet.layouts[0].svg.length
    if (bytes >= 100 * 1024 * 1024)
      throw new Error('This PDF batch is too large. Export smaller groups of sheets.')
    sheets.push(sheet)
  }
  return { sheets }
}
