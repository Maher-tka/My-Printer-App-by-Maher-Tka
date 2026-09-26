import type { CutterPreflightReport } from './preflight'
import type { CutterExportResult, CutterProject } from '../types'
import { exportCutterEps } from './epsExport'
import { CUTTER_EXPORT_PRESETS } from './exportPresets'
import { exportCutterPdf } from './pdfCutExport'
import {
  createMimakiJobManifest,
  manifestToBytes,
  type MimakiPackageSheetFiles
} from './mimakiJobPackage'
import { createProductionNotesText, textToBytes } from './productionNotes'
import { getProductionSheetLayoutGroups } from './productionSheetGroups'
import { getProductionSheetProject } from './productionSheets'
import { exportCutterSvg } from './svgExport'

export interface CutterBatchExportFile {
  fileName: string
  blob: Blob
}

export interface CutterBatchExportResult {
  folderName: string
  files: CutterBatchExportFile[]
}

export async function exportCutterProductionBatch(
  project: CutterProject,
  report: CutterPreflightReport
): Promise<CutterBatchExportResult> {
  const folderName = getBatchFolderName(project)
  const files: CutterBatchExportFile[] = []
  const printOnly = getPresetProject(project, 'pdf-print-only')
  const printCut = getPresetProject(project, 'illustrator-print-cut-svg')
  const cutOnly = getPresetProject(project, 'svg-eps-cut-only')
  const preview = getPresetProject(project, 'customer-preview')
  const layoutGroups = getProductionSheetLayoutGroups(project)
  const packageFilesByLayout: MimakiPackageSheetFiles[] = []

  for (let layoutIndex = 0; layoutIndex < layoutGroups.length; layoutIndex += 1) {
    const group = layoutGroups[layoutIndex]
    const sheetIndex = group.templateSheetIndex
    const layoutNumber = String(layoutIndex + 1).padStart(2, '0')
    const printRepeat =
      group.repeatCount === 1 ? 'PRINT_1_COPY' : `PRINT_${group.repeatCount}_COPIES`
    const cutRepeat =
      group.repeatCount === 1 ? 'RUN_1_CUT_PASS' : `RUN_${group.repeatCount}_CUT_PASSES`
    const printPdf = `01_Mimaki_Marked_Print_Layout_${layoutNumber}_${printRepeat}.pdf`
    const layeredPdf = `06_Layered_PrintCut_Layout_${layoutNumber}_${printRepeat}.pdf`
    const printCutSvg = `02_Mimaki_PrintCut_Layout_${layoutNumber}_${printRepeat}.svg`
    const cutSvg = `03_CutOnly_CutContour_Layout_${layoutNumber}_${cutRepeat}.svg`
    const cutEps = `04_CutOnly_CutContour_Layout_${layoutNumber}_${cutRepeat}.eps`
    const previewPdf = `05_Customer_Preview_Layout_${layoutNumber}_${printRepeat}.pdf`
    const printSheetProject = getProductionSheetProject(printOnly, sheetIndex)
    const printCutSheetProject = getProductionSheetProject(printCut, sheetIndex)
    const cutOnlySheetProject = getProductionSheetProject(cutOnly, sheetIndex)
    const previewSheetProject = getProductionSheetProject(preview, sheetIndex)

    files.push(renameExport(await exportCutterPdf(printSheetProject), `${folderName}/${printPdf}`))
    files.push(
      renameExport(await exportCutterSvg(printCutSheetProject), `${folderName}/${printCutSvg}`)
    )
    files.push(renameExport(await exportCutterSvg(cutOnlySheetProject), `${folderName}/${cutSvg}`))
    files.push(renameExport(exportCutterEps(cutOnlySheetProject), `${folderName}/${cutEps}`))
    files.push(
      renameExport(await exportCutterPdf(previewSheetProject), `${folderName}/${previewPdf}`)
    )
    files.push(
      renameExport(await exportCutterPdf(printCutSheetProject), `${folderName}/${layeredPdf}`)
    )
    packageFilesByLayout.push({ printPdf, printCutSvg, cutSvg, cutEps, previewPdf, layeredPdf })
  }

  files.push({
    fileName: `${folderName}/mimaki_job_manifest.json`,
    blob: new Blob(
      [bytesToArrayBuffer(manifestToBytes(createMimakiJobManifest(project, packageFilesByLayout)))],
      { type: 'application/json' }
    )
  })

  const notesFileName = `${folderName}/production_notes.txt`
  const notes = createProductionNotesText(project, report, [
    ...files.map((file) => file.fileName.replace(`${folderName}/`, '')),
    'production_notes.txt'
  ])
  files.push({
    fileName: notesFileName,
    blob: new Blob([bytesToArrayBuffer(textToBytes(notes))], { type: 'text/plain' })
  })

  return { folderName, files }
}

function getPresetProject(
  project: CutterProject,
  presetId: NonNullable<CutterProject['exportSettings']['preset']>
): CutterProject {
  const preset = CUTTER_EXPORT_PRESETS.find((item) => item.id === presetId)

  if (!preset) {
    return project
  }

  return {
    ...project,
    exportSettings: {
      ...project.exportSettings,
      ...preset.settings
    }
  }
}

function renameExport(result: CutterExportResult, fileName: string): CutterBatchExportFile {
  return {
    fileName,
    blob: result.blob
  }
}

function getBatchFolderName(project: CutterProject): string {
  const jobName = project.productionInfo?.jobName || project.pieces[0]?.displayName || 'Cutter_Job'
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  return `Cutter_Job_${sanitizeFilePart(jobName)}_${date}`
}

function sanitizeFilePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
