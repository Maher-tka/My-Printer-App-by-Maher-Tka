import type { CutterPreflightReport } from './preflight'
import type { CutterProject } from '../types'
import { getProductionSheetLayoutGroups } from './productionSheetGroups'
import { getProductionSheetCount } from './productionSheets'
import { getSheetUsageStats } from './sheetUsage'

export function createProductionNotesText(
  project: CutterProject,
  report: CutterPreflightReport,
  generatedFiles: string[],
  date = new Date()
): string {
  const stats = getSheetUsageStats(project)
  const layoutGroups = getProductionSheetLayoutGroups(project)
  const physicalSheetCount = getProductionSheetCount(project.placedPieces)
  const jobName = project.productionInfo?.jobName || project.pieces[0]?.displayName || 'Cutter Job'

  return [
    'My Printer App by Maher Tka - Cutter Production Notes',
    '',
    `Job name: ${jobName}`,
    `Date: ${date.toISOString()}`,
    `Target cutter: ${project.productionInfo?.targetCutterLabel ?? 'Mimaki CG-130AR'}`,
    'Workflow: offline Mimaki package (Illustrator not required)',
    'Registration: app-generated Mimaki Type 1 marks, 4-point detection',
    'Important: registration marks are printed only and are excluded from knife paths',
    'Cutter connection: install/validate the official Mimaki driver or SDK adapter on the office PC',
    `Sheet size: ${project.sheet.widthCm} x ${project.sheet.heightCm} cm`,
    `Roll width: ${project.sheet.rollWidthCm} cm`,
    `Safe margin: ${project.sheet.safeMarginCm} cm`,
    `Placed pieces: ${project.placedPieces.length}`,
    `Designs: ${project.pieces.length}`,
    `Unique sheet layouts: ${layoutGroups.length}`,
    `Physical sheets to print: ${physicalSheetCount}`,
    `Used area: ${stats.usedAreaPercent.toFixed(1)}%`,
    `Waste: ${stats.wasteAreaPercent.toFixed(1)}%`,
    `Used height: ${stats.usedHeightCm.toFixed(1)} cm`,
    `Estimated material: ${stats.estimatedMaterialUsedMeters.toFixed(2)} m`,
    `Export preset: ${project.exportSettings.preset ?? project.exportSettings.mode ?? 'print-cut'}`,
    `CutContour stroke: ${project.exportSettings.strokeName}`,
    '',
    'Print and cut repetitions:',
    ...layoutGroups.map(
      (group, layoutIndex) =>
        `- Layout ${layoutIndex + 1}: print ${group.repeatCount} cop${group.repeatCount === 1 ? 'y' : 'ies'} and run ${group.repeatCount} cut pass${group.repeatCount === 1 ? '' : 'es'} (${group.copiesPerSheet} pieces per sheet, ${group.totalCopies} total)`
    ),
    '',
    'Generated files:',
    ...generatedFiles.map((fileName) => `- ${fileName}`),
    '',
    'Preflight:',
    ...(report.issues.length
      ? report.issues.map((issue) => `- ${issue.severity.toUpperCase()}: ${issue.message}`)
      : ['- Ready: no production issues reported.'])
  ].join('\n')
}

export function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}
